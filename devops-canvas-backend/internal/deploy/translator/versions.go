package translator

import (
	"fmt"
	"sort"
	"strings"

	"github.com/Masterminds/semver/v3"
)

// VersionOption represents a selectable version for the frontend
type VersionOption struct {
	Label string `json:"label"` // e.g. "16.1"
	Value string `json:"value"` // e.g. "16.1"
}

// DockerHubVersionMap maps component types to their Docker Hub image names
// and known stable version tags.
var DockerHubVersionMap = map[string]struct {
	Image    string
	Versions []string // Known stable versions, newest first
}{
	"postgres":   {"postgres", []string{"17.2", "17.1", "17.0", "16.6", "16.5", "16.4", "15.10", "15.9", "14.15", "13.18"}},
	"redis":      {"redis", []string{"7.4", "7.2", "7.0", "6.2"}},
	"mysql":      {"mysql", []string{"9.1", "9.0", "8.4", "8.0", "5.7"}},
	"kafka":      {"bitnami/kafka", []string{"3.9", "3.8", "3.7", "3.6"}},
	"clickhouse": {"clickhouse/clickhouse-server", []string{"24.12", "24.11", "24.10", "24.8", "24.3", "23.12", "23.8"}},
	"rabbitmq":   {"rabbitmq", []string{"4.0", "3.13", "3.12"}},
	"valkey":     {"valkey/valkey", []string{"8.0", "7.2"}},
}

// GetAvailableVersions returns a list of selectable versions for a component.
func GetAvailableVersions(componentType string) ([]VersionOption, error) {
	info, ok := DockerHubVersionMap[componentType]
	if !ok {
		return nil, fmt.Errorf("no version info available for component type: %s", componentType)
	}

	var options []VersionOption
	for _, ver := range info.Versions {
		options = append(options, VersionOption{
			Label: ver,
			Value: ver,
		})
	}

	// Sort descending by semver
	sort.Slice(options, func(i, j int) bool {
		v1, err1 := semver.NewVersion(options[i].Value)
		v2, err2 := semver.NewVersion(options[j].Value)
		if err1 != nil || err2 != nil {
			return options[i].Value > options[j].Value
		}
		return v1.GreaterThan(v2)
	})

	return options, nil
}

// SanitizeDockerVersion strips the patch version from a SemVer string to match standard Docker Image tagging conventions (X.Y).
// e.g. "16.1.0" -> "16.1", "7.4.3" -> "7.4"
// If the version is not valid SemVer, it returns it as is.
func SanitizeDockerVersion(version string) string {
	// If already in X.Y format, return as is
	parts := strings.Split(version, ".")
	if len(parts) <= 2 {
		return version
	}
	v, err := semver.NewVersion(version)
	if err != nil {
		return version
	}
	return fmt.Sprintf("%d.%d", v.Major(), v.Minor())
}
