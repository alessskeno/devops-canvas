package deploy

import (
    "encoding/json"
    "log"
    "os/exec"
    "strconv"
    "strings"
    "time"

    "devops-canvas-backend/internal/realtime"
)

type ContainerStat struct {
    Name      string `json:"Name"`
    CPUPerc   string `json:"CPUPerc"`
    MemUsage  string `json:"MemUsage"`
    MemPerc   string `json:"MemPerc"`
    NetIO     string `json:"NetIO"`
    BlockIO   string `json:"BlockIO"`
    PIDs      string `json:"PIDs"`
}

type WorkspaceStats struct {
    Type        string                   `json:"type"`          // "workspace_stats"
    WorkspaceID string                   `json:"workspace_id"`
    Containers  []ContainerStat          `json:"containers"`
    TotalCPU    float64                  `json:"total_cpu"`     // Sum of %
    TotalMem    float64                  `json:"total_memory"`  // Estimated bytes/MB? Docker stats gives human readable "10MiB / 1GiB". Hard to parse properly without SDK.
    // For now, let's just send the raw ContainerStats and let Frontend parse/display.
}

type DockerMonitor struct {
    Hub *realtime.Hub
}

func NewDockerMonitor(hub *realtime.Hub) *DockerMonitor {
    return &DockerMonitor{Hub: hub}
}

func (m *DockerMonitor) Start() {
    ticker := time.NewTicker(1 * time.Second)
    go func() {
        for range ticker.C {
            m.collectAndBroadcast()
        }
    }()
}

func (m *DockerMonitor) collectAndBroadcast() {
    // Fetch all stats as JSON
    // format: {{json .}} with explicit fields if needed, or default json structure
    // Docker 1.13+ supports {{json .}}
    cmd := exec.Command("docker", "stats", "--format", "{{json .}}", "--no-stream")
    output, err := cmd.Output()
    if err != nil {
        log.Printf("Error fetching docker stats: %v", err)
        return
    }

    // Output is line-delimited JSON objects
    lines := strings.Split(string(output), "\n")
    
    // Group by Workspace (Project Name)
    // We assume project name == workspaceID (used in `DeployWorkspace` with -p flag)
    // But `docker stats` output JSON might not contain labels directly in default formatter...
    // Name is usually `project-service-1`.
    // We might need `docker ps` to map names to labels if we want to be robust.
    // OR, we just assume `workspaceID` is the prefix of the container name?
    // In `service.go` we used `-p workspaceID`. Docker Compose names containers `project-service-N`.
    // So container names will look like `workspaceID-service-1` (if no custom name)
    // OR `project_service_1` (underscore/dash depends on version).
    // `docker compose` v2 usually uses dashes.
    
    // Let's use `docker ps --format "{{.Details}}"` ? No.
    
    // Simpler: Just map container names to stats.
    // But `docker stats` doesn't give us the Project Label easily in the JSON output unless we do complex formatting.
    // Let's rely on naming convention or project prefix?
    // If I use `-p workspaceID`, the containers are usually named `workspaceID-service-1`.
    
    // Actually, let's try to get labels from `docker ps` first? Too many calls.
    
    // Let's stick to parsing `Name`.
    workspaceMap := make(map[string][]ContainerStat)
    
    for _, line := range lines {
        if strings.TrimSpace(line) == "" {
            continue
        }
        var stat ContainerStat
        if err := json.Unmarshal([]byte(line), &stat); err != nil {
            continue
        }
        
        // Infer Workspace ID from Name?
        // If we ran `docker compose -p {uuid} ...`, names are `{uuid}-{service}-{num}`.
        // UUIDs are unique enough.
        // But wait, `docker compose` might use underscores.
        // Also UUIDs are long.
        
        // Alternative: Broadcast ALL stats to EVERYONE and let frontend filter?
        // That leaks info if we have multi-tenancy.
        // But for this single-user(ish) MVP, passing all container stats might be "okay" but heavy.
        
        // Better: We know valid workspace IDs from... nowhere here.
        // Let's try to grab the label `com.docker.compose.project`.
        // `docker stats` output usually doesn't include labels.
        
        // We can run `docker ps --format "{{.Names}}\t{{.Label \"com.docker.compose.project\"}}"` separately to build a mapping?
        // This is cheap.
    }
    
    // Mapping approach
    nameToProject, err := m.getContainerProjectMapping()
    if err != nil {
        // Log but don't crash
        return 
    }
    
    for _, line := range lines {
         if strings.TrimSpace(line) == "" { continue }
         var stat ContainerStat
         if err := json.Unmarshal([]byte(line), &stat); err != nil { continue }
         
         project, ok := nameToProject[stat.Name]
         if ok && project != "" {
             workspaceMap[project] = append(workspaceMap[project], stat)
         }
    }
    
    // Broadcast per workspace
    for wsID, stats := range workspaceMap {
        var totalCPU float64
        var totalMem float64

        for _, s := range stats {
            totalCPU += parseCPUPercentage(s.CPUPerc)
            totalMem += parseMemoryUsage(s.MemUsage)
        }

        msg := WorkspaceStats{
            Type:        "workspace_stats",
            WorkspaceID: wsID,
            Containers:  stats,
            TotalCPU:    totalCPU,
            TotalMem:    totalMem,
        }
        
        bytes, _ := json.Marshal(msg)
        m.Hub.BroadcastToLocal(bytes) // This broadcasts to ALL clients.
    }
}

func parseCPUPercentage(s string) float64 {
    // "0.05%"
    s = strings.ReplaceAll(s, "%", "")
    val, _ := strconv.ParseFloat(s, 64)
    return val // Return as percentage (e.g. 0.05)
}

func parseMemoryUsage(s string) float64 {
    // "15.73MiB / 15.5GiB"
    parts := strings.Split(s, " / ")
    if len(parts) == 0 {
        return 0
    }
    usageStr := parts[0] // "15.73MiB"
    
    // Normalize units to Bytes
    var multiplier float64 = 1
    if strings.Contains(usageStr, "GiB") {
        multiplier = 1024 * 1024 * 1024
        usageStr = strings.ReplaceAll(usageStr, "GiB", "")
    } else if strings.Contains(usageStr, "MiB") {
        multiplier = 1024 * 1024
        usageStr = strings.ReplaceAll(usageStr, "MiB", "")
    } else if strings.Contains(usageStr, "KiB") {
        multiplier = 1024
        usageStr = strings.ReplaceAll(usageStr, "KiB", "")
    } else if strings.Contains(usageStr, "B") {
        usageStr = strings.ReplaceAll(usageStr, "B", "")
    }

    val, _ := strconv.ParseFloat(strings.TrimSpace(usageStr), 64)
    return val * multiplier
}


func (m *DockerMonitor) getContainerProjectMapping() (map[string]string, error) {
    cmd := exec.Command("docker", "ps", "--format", "{{.Names}}\t{{.Label \"com.docker.compose.project\"}}")
    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }
    
    mapping := make(map[string]string)
    lines := strings.Split(string(output), "\n")
    for _, line := range lines {
        if strings.TrimSpace(line) == "" { continue }
        parts := strings.Split(line, "\t")
        if len(parts) >= 2 {
            name := strings.TrimSpace(parts[0])
            project := strings.TrimSpace(parts[1])
            if project != "" {
                mapping[name] = project
            }
        }
    }
    return mapping, nil
}
