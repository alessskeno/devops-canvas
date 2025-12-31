package deploy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"
)

type ContainerStatus struct {
	ID       string `json:"ID"`
	Name     string `json:"Name"`
	State    string `json:"State"`    // running, exited, restarting
	Status   string `json:"Status"`   // Up 2 minutes, Restarting (1) ...
	ExitCode int    `json:"ExitCode"` 
	Health   string `json:"Health"`   // healthy, starting, unhealthy, ""
    Service  string `json:"Service"`
}

func (s *Service) verifyDockerHealth(ctx context.Context, workspaceID, baseDir string) error {
    // We verify for a certain duration to catch crash loops (e.g. 5-10 seconds)
    // If a container exits with non-zero code during this time, we fail.
    
    checkCount := 5
    for i := 0; i < checkCount; i++ {
        // Sleep between checks
        if i > 0 {
            time.Sleep(2 * time.Second)
        }

        cmd := exec.Command("docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "ps", "--format", "json")
        cmd.Dir = baseDir
        output, err := cmd.Output()
        if err != nil {
            return fmt.Errorf("failed to run docker compose ps: %w", err)
        }

        containers, err := parseDockerComposePs(output)
        if err != nil {
            return fmt.Errorf("failed to parse container status: %w", err)
        }
        
        if len(containers) == 0 {
             return fmt.Errorf("no containers found for workspace")
        }

        for _, c := range containers {
            // Check State
            if c.State == "exited" || c.State == "dead" {
                if c.ExitCode != 0 {
                    return fmt.Errorf("container %s exited with error (code %d)", c.Service, c.ExitCode)
                }
                // If exit code is 0, maybe it's a one-off task? 
                // In our context (databases/services), they should stay running.
                // But let's be strict for now.
                 return fmt.Errorf("container %s is not running (state: %s)", c.Service, c.State)
            }
            
            if c.State == "restarting" {
                 return fmt.Errorf("container %s is in a restart loop", c.Service)
            }

            // Check Health (if configured)
            if c.Health == "unhealthy" {
                 return fmt.Errorf("container %s is unhealthy", c.Service)
            }
        }
    }

    return nil
}

func parseDockerComposePs(output []byte) ([]ContainerStatus, error) {
    if len(output) == 0 {
        return nil, nil // No containers
    }

    var containers []ContainerStatus
    
    // 1. Try extracting as JSON Array (Docker Compose V2 default)
    // Trim whitespace to ensure check works
    trimmed := bytes.TrimSpace(output)
    if len(trimmed) > 0 && trimmed[0] == '[' {
        if err := json.Unmarshal(trimmed, &containers); err == nil {
            return containers, nil
        }
        // If array unmarshal failed but started with [, usually malformed JSON
        // fallback to line-delimited incase it was just a coincidence?
    }

    // 2. Fallback to Line-Delimited JSON (NDJSON)
    // (Older versions or specific flags sometimes do this)
    lines := bytes.Split(output, []byte("\n"))
    for _, line := range lines {
        if len(bytes.TrimSpace(line)) == 0 {
            continue
        }
        var c ContainerStatus
        if err := json.Unmarshal(line, &c); err != nil {
            // If both approaches fail, return error
            return nil, fmt.Errorf("failed to parse json line: %v (content: %s)", err, string(line))
        }
        containers = append(containers, c)
    }
    return containers, nil
}
