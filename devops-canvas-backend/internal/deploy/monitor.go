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
	Name     string `json:"Name"`
	CPUPerc  string `json:"CPUPerc"`
	MemUsage string `json:"MemUsage"`
	MemPerc  string `json:"MemPerc"`
	NetIO    string `json:"NetIO"`
	BlockIO  string `json:"BlockIO"`
	PIDs     string `json:"PIDs"`
}

type WorkspaceStats struct {
	Type        string          `json:"type"` // "workspace_stats"
	WorkspaceID string          `json:"workspace_id"`
	Containers  []ContainerStat `json:"containers"`
	TotalCPU    float64         `json:"total_cpu"`    // Sum of %
	TotalMem    float64         `json:"total_memory"` // Estimated bytes/MB? Docker stats gives human readable "10MiB / 1GiB". Hard to parse properly without SDK.
	// For now, let's just send the raw ContainerStats and let Frontend parse/display.
}

type DockerMonitor struct {
	Hub                 *realtime.Hub
	lastKnownWorkspaces map[string]bool
}

func NewDockerMonitor(hub *realtime.Hub) *DockerMonitor {
	return &DockerMonitor{
		Hub:                 hub,
		lastKnownWorkspaces: make(map[string]bool),
	}
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
	cmd := exec.Command("docker", "stats", "--format", "{{json .}}", "--no-stream")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Error fetching docker stats: %v", err)
		return
	}

	lines := strings.Split(string(output), "\n")
	workspaceMap := make(map[string][]ContainerStat)
	currentWorkspaces := make(map[string]bool)

	// Mapping approach
	nameToProject, err := m.getContainerProjectMapping()
	if err != nil {
		// Fallback or just continue, but map might be empty
		nameToProject = make(map[string]string)
	}

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var stat ContainerStat
		if err := json.Unmarshal([]byte(line), &stat); err != nil {
			continue
		}

		// 1. Check Docker Compose Project Label
		project, ok := nameToProject[stat.Name]
		if ok && project != "" {
			workspaceMap[project] = append(workspaceMap[project], stat)
			currentWorkspaces[project] = true
		}
	}

	// Broadcast per workspace (Active ones)
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
		m.Hub.BroadcastToLocal(bytes)

		// Mark as known
		m.lastKnownWorkspaces[wsID] = true
	}

	// Check for Workspaces that disappeared (Transition to 0 containers)
	for wsID := range m.lastKnownWorkspaces {
		if !currentWorkspaces[wsID] {
			// Workspace was active, now gone. Send empty stats.
			msg := WorkspaceStats{
				Type:        "workspace_stats",
				WorkspaceID: wsID,
				Containers:  []ContainerStat{},
				TotalCPU:    0,
				TotalMem:    0,
			}
			bytes, _ := json.Marshal(msg)
			m.Hub.BroadcastToLocal(bytes)

			// Remove from known
			delete(m.lastKnownWorkspaces, wsID)
		}
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
		if strings.TrimSpace(line) == "" {
			continue
		}
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
