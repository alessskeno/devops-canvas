package translator

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/semver/v3"
)

// HelmChartEntry represents an entry in `helm search repo ... -o json`
type HelmChartEntry struct {
	Name       string `json:"name"`
	Version    string `json:"version"`
	AppVersion string `json:"app_version"`
}

// ChartCache holds cached version lookups to avoid expensive CLI calls
type ChartCache struct {
	sync.RWMutex
	Entries map[string][]HelmChartEntry // Key: chartName (e.g. "bitnami/postgresql")
	LastUpdate time.Time
}

var (
	cache    = &ChartCache{Entries: make(map[string][]HelmChartEntry)}
	repoInit = false
	initLock sync.Mutex
)

// VersionGroupingStrategy defines how versions should be rolled up
type VersionGroupingStrategy string

const (
    StrategyMajor      VersionGroupingStrategy = "major"      // e.g. rollup 16.x.x -> 16
    StrategyMajorMinor VersionGroupingStrategy = "majorminor" // e.g. rollup 3.12.x -> 3.12
)

// ComponentToChartMap maps internal component type to Helm Chart Name
var ComponentToChartMap = map[string]struct{
    RepoURL string
    ChartName string
    Strategy VersionGroupingStrategy
}{
    "postgres":   {"https://charts.bitnami.com/bitnami", "bitnami/postgresql", StrategyMajor},
    "redis":      {"https://charts.bitnami.com/bitnami", "bitnami/redis", StrategyMajor},
    "mysql":      {"https://charts.bitnami.com/bitnami", "bitnami/mysql", StrategyMajor},
    "kafka":      {"https://charts.bitnami.com/bitnami", "bitnami/kafka", StrategyMajor},
    "rabbitmq":   {"https://charts.bitnami.com/bitnami", "bitnami/rabbitmq", StrategyMajor},
    "clickhouse": {"https://charts.bitnami.com/bitnami", "bitnami/clickhouse", StrategyMajor}, // ClickHouse versions are like 23.11, 23.8
    "valkey":     {"https://charts.bitnami.com/bitnami", "bitnami/valkey", StrategyMajor},
    "monitoring_stack": {"https://prometheus-community.github.io/helm-charts", "prometheus-community/kube-prometheus-stack", StrategyMajor},
}

// EnsureHelmRepos initializes the required helm repositories.
// Should be called on service startup or lazily.
func EnsureHelmRepos() error {
    initLock.Lock()
    defer initLock.Unlock()

    if repoInit {
        return nil
    }

    // Add repositories
    for _, info := range ComponentToChartMap {
        // Extract repo name from chart name (e.g. "bitnami" from "bitnami/postgresql")
        parts := strings.Split(info.ChartName, "/")
        if len(parts) != 2 {
             continue
        }
        repoName := parts[0]
        
        // Check if repo exists to avoid error, or just force add
        cmd := exec.Command("helm", "repo", "add", repoName, info.RepoURL)
        if output, err := cmd.CombinedOutput(); err != nil {
            return fmt.Errorf("failed to add helm repo %s: %s, %v", repoName, string(output), err)
        }
    }

    // Update repos
    cmd := exec.Command("helm", "repo", "update")
    if output, err := cmd.CombinedOutput(); err != nil {
        return fmt.Errorf("failed to update helm repos: %s, %v", string(output), err)
    }

    repoInit = true
    return nil
}

// GetChartDependency dynamically finds the latest Chart Version for the given App Version.
func GetChartDependency(componentType, targetAppVersion string) ChartDependency {
    // Default Fallback
    fallback := ChartDependency{
        Name: componentType, // Dummy
    }

    info, ok := ComponentToChartMap[componentType]
    if !ok {
        return fallback
    }
    
    // Ensure Repos are ready (Lazy init if not already done, though better do it at startup)
    if err := EnsureHelmRepos(); err != nil {
        fmt.Fprintf(os.Stderr, "Helm repo init failed: %v\n", err)
        // If repo init fails (e.g. no internet), we can't do dynamic lookup.
        // In a real scenario we might have a hardcoded fallback list here.
        // For now, return empty which might cause issues if not handled upstream, 
        // or return a safe default.
        return ChartDependency{Name: info.ChartName, Version: "latest", Repository: info.RepoURL}
    }

    // Fetch entries (Cached)
    entries, err := getEntriesForChart(info.ChartName)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Failed to get chart entries: %v\n", err)
         return ChartDependency{Name: info.ChartName, Version: "latest", Repository: info.RepoURL}
    }

    // Filter and Find Best Match
    var bestMatchStr string
    
    // Sort entries by Version (Chart Version) DESC so we find the latest chart version first
    sort.Slice(entries, func(i, j int) bool {
        v1, err1 := semver.NewVersion(entries[i].Version)
        v2, err2 := semver.NewVersion(entries[j].Version)
        if err1 != nil || err2 != nil {
            return entries[i].Version > entries[j].Version // Fallback string sort
        }
        return v1.GreaterThan(v2)
    })

    // Iterate through sorted entries
    for _, entry := range entries {
        // Validation: Target App Version Match
        if targetAppVersion == "latest" || targetAppVersion == "" {
             // Since sorted DESC, first valid semantic version is best
             bestMatchStr = entry.Version
             break
        }

        // Check App Version Match
        // We use string equality for AppVersion because app versions are often loose (e.g. "1.2.3-debian-10")
        // But if user requested "1.2.3", and chart has "1.2.3", we match.
        if entry.AppVersion == targetAppVersion || (strings.HasPrefix(entry.AppVersion, targetAppVersion)) {
            bestMatchStr = entry.Version
            break
        }
    }
    
    // Fallback: Use latest from sorted list if no specific match
    if bestMatchStr == "" && len(entries) > 0 {
         bestMatchStr = entries[0].Version
    } else if bestMatchStr == "" {
        bestMatchStr = "latest"
    }

    // Split ChartName to get pure name
    name := info.ChartName
    parts := strings.Split(info.ChartName, "/")
    if len(parts) == 2 {
        name = parts[1]
    }

    return ChartDependency{
        Name:       name,
        Version:    bestMatchStr,
        Repository: info.RepoURL,
    }
}

func getEntriesForChart(chartName string) ([]HelmChartEntry, error) {
    cache.RLock()
    entries, hit := cache.Entries[chartName]
    cache.RUnlock()
    
    if hit && len(entries) > 0 {
        return entries, nil
    }
    
    cache.Lock()
    defer cache.Unlock()
    
    // Double check
    if entries, hit := cache.Entries[chartName]; hit && len(entries) > 0 {
        return entries, nil
    }

    // Exec Helm Search
    // helm search repo bitnami/postgresql --versions -o json
    cmd := exec.Command("helm", "search", "repo", chartName, "--versions", "-o", "json")
    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }
    
    if err := json.Unmarshal(output, &entries); err != nil {
        return nil, err
    }
    
    // Sort logic? Helm usually returns sorted by version desc.
    // We trust helm output for now.
    
    cache.Entries[chartName] = entries
    return entries, nil
}

// VersionOption represents a selectable version for the frontend
type VersionOption struct {
    Label string `json:"label"` // e.g. "16.1 (Chart 13.2.24)"
    Value string `json:"value"` // e.g. "16.1.0"
}

// GetAvailableVersions returns a list of "Main App Versions" for a component
func GetAvailableVersions(componentType string) ([]VersionOption, error) {
    if componentType == "kind-cluster" {
        return fetchKindVersionsFromGitHub()
    }

    info, ok := ComponentToChartMap[componentType]
    if !ok {
        return nil, fmt.Errorf("unknown component type: %s", componentType)
    }

    if err := EnsureHelmRepos(); err != nil {
        return nil, fmt.Errorf("helm repo error: %v", err)
    }

    entries, err := getEntriesForChart(info.ChartName)
    if err != nil {
        return nil, err
    }

    // Helper function to group entries
    groupEntries := func(strategy VersionGroupingStrategy) map[string]HelmChartEntry {
        bestEntries := make(map[string]HelmChartEntry)
        for _, entry := range entries {
            // Parse App Version
            v, err := semver.NewVersion(entry.AppVersion)
            if err != nil {
                continue // Skip non-semver app versions
            }

            var groupKey string
            switch strategy {
            case StrategyMajor:
                groupKey = fmt.Sprintf("%d", v.Major())
            case StrategyMajorMinor:
                groupKey = fmt.Sprintf("%d.%d", v.Major(), v.Minor())
            default:
                groupKey = fmt.Sprintf("%d", v.Major())
            }

            // Check if existing best is strictly older
            if existing, exists := bestEntries[groupKey]; exists {
                vExist, _ := semver.NewVersion(existing.AppVersion)
                // If current entry is newer App Version
                if v.GreaterThan(vExist) {
                    bestEntries[groupKey] = entry
                } else if v.Equal(vExist) {
                    // Same App Version? Check Chart Version
                    c1, _ := semver.NewVersion(entry.Version)
                    c2, _ := semver.NewVersion(existing.Version)
                    if c1 != nil && c2 != nil && c1.GreaterThan(c2) {
                        bestEntries[groupKey] = entry
                    }
                }
            } else {
                bestEntries[groupKey] = entry
            }
        }
        return bestEntries
    }

    // Initial Grouping
    bestEntries := groupEntries(info.Strategy)

    // Smart Fallback Logic:
    // If we used Major strategy and got only 1 or 0 results (e.g. all 0.x),
    // try to expand by using MajorMinor to show more granularity.
    limitResults := 0
    if info.Strategy == StrategyMajor && len(bestEntries) <= 1 {
        bestEntries = groupEntries(StrategyMajorMinor)
        limitResults = 5 // Limit to top 5 if we fell back
    }

    // Convert map to slice and sort
    var options []VersionOption
    for _, entry := range bestEntries {
        label := fmt.Sprintf("%s (Chart %s)", entry.AppVersion, entry.Version)
        options = append(options, VersionOption{
            Label: label,
            Value: entry.AppVersion,
        })
    }

    // Sort Descending by Value (App Version)
    sort.Slice(options, func(i, j int) bool {
        v1, err1 := semver.NewVersion(options[i].Value)
        v2, err2 := semver.NewVersion(options[j].Value)
        if err1 != nil || err2 != nil {
            return options[i].Value > options[j].Value
        }
        return v1.GreaterThan(v2)
    })

    // Apply limit if requested
    if limitResults > 0 && len(options) > limitResults {
        options = options[:limitResults]
    }

    return options, nil
}

// Cache for GitHub Releases
type GitHubReleaseCache struct {
    sync.RWMutex
    Versions   []VersionOption
    LastUpdate time.Time
}

var kindCache = &GitHubReleaseCache{}

func fetchKindVersionsFromGitHub() ([]VersionOption, error) {
    kindCache.RLock()
    if len(kindCache.Versions) > 0 && time.Since(kindCache.LastUpdate) < 1*time.Hour {
        defer kindCache.RUnlock()
        return kindCache.Versions, nil
    }
    kindCache.RUnlock()

    kindCache.Lock()
    defer kindCache.Unlock()

    // Double check
    if len(kindCache.Versions) > 0 && time.Since(kindCache.LastUpdate) < 1*time.Hour {
        return kindCache.Versions, nil
    }

    // Call GitHub API
    // We use kubernetes/kubernetes to get K8s versions
    // Fetch 100 to ensure we cover enough minor versions history despite many patch releases
    url := "https://api.github.com/repos/kubernetes/kubernetes/releases?per_page=100"
    
    client := http.Client{Timeout: 10 * time.Second}
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, err
    }
    // Add User-Agent as required by GitHub API
    req.Header.Set("User-Agent", "DevOps-Canvas")

    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to call github api: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("github api failed with status: %d", resp.StatusCode)
    }

    var releases []struct {
        TagName string `json:"tag_name"`
        Name    string `json:"name"`
        Draft   bool   `json:"draft"`
        Prerelease bool `json:"prerelease"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
        return nil, fmt.Errorf("failed to decode github response: %v", err)
    }

    // Group by Major.Minor -> Keep Max Patch
    bestVersions := make(map[string]*semver.Version)
    
    for _, rel := range releases {
        if rel.Draft || rel.Prerelease {
            continue
        }
        
        // Clean tag (v1.30.0 -> 1.30.0)
        cleanVal := strings.TrimPrefix(rel.TagName, "v")
        v, err := semver.NewVersion(cleanVal)
        if err != nil {
            continue
        }

        groupKey := fmt.Sprintf("%d.%d", v.Major(), v.Minor())
        
        if existing, exists := bestVersions[groupKey]; exists {
            if v.GreaterThan(existing) {
                bestVersions[groupKey] = v
            }
        } else {
            bestVersions[groupKey] = v
        }
    }
    
    // Collect
    var options []VersionOption
    for _, v := range bestVersions {
        // Re-add 'v' prefix for Kind consistency
        val := fmt.Sprintf("v%s", v.String())
        options = append(options, VersionOption{
            Label: val,
            Value: val,
        })
    }
    
    // Sort Descending by SemVer
    sort.Slice(options, func(i, j int) bool {
        v1, err1 := semver.NewVersion(options[i].Value)
        v2, err2 := semver.NewVersion(options[j].Value)
        if err1 != nil || err2 != nil {
             return options[i].Value > options[j].Value
        }
        return v1.GreaterThan(v2)
    })
    
    // Take Top 5
    if len(options) > 5 {
        options = options[:5]
    }

    kindCache.Versions = options
    kindCache.LastUpdate = time.Now()
    
    return options, nil
}
