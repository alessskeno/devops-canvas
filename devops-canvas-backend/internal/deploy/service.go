package deploy

import (
	"context"
	"devops-canvas-backend/internal/deploy/translator"
	"devops-canvas-backend/internal/workspace"
	"encoding/json"
    "fmt"
)

type Service struct {
	repo          *Repository
	workspaceRepo *workspace.Repository
	generator     *ManifestGenerator
}

func NewService(repo *Repository, workspaceRepo *workspace.Repository, generator *ManifestGenerator) *Service {
	return &Service{
		repo:          repo,
		workspaceRepo: workspaceRepo,
		generator:     generator,
	}
}

func (s *Service) DeployWorkspace(ctx context.Context, workspaceID string) (string, error) {
	return s.repo.DeployWorkspace(ctx, workspaceID)
}

func (s *Service) GetLogs(ctx context.Context, deployID string) ([]string, error) {
	return s.repo.GetLogs(ctx, deployID)
}

func (s *Service) GenerateManifests(ctx context.Context, workspaceID string) (map[string]interface{}, error) {
	// 1. Fetch Canvas State
	canvas, err := s.workspaceRepo.GetCanvas(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch canvas: %w", err)
	}

	// 2. Build Adjacency List for Graph Traversal
    adj := make(map[string][]string)
    for _, conn := range canvas.Connections {
        adj[conn.SourceID] = append(adj[conn.SourceID], conn.TargetID)
        adj[conn.TargetID] = append(adj[conn.TargetID], conn.SourceID)
    }

    // 3. Identify Infrastructure Contexts
    kindNodes := []string{}
    composeNodes := []string{}
    for _, node := range canvas.Nodes {
        if node.Type == "kind-cluster" {
            kindNodes = append(kindNodes, node.ID)
        } else if node.Type == "docker-compose" {
            composeNodes = append(composeNodes, node.ID)
        }
    }

    // 4. Determine Reachability
    // If no infrastructure nodes exist, we default to "All Enabled" mode for backward compatibility
    enableAll := len(kindNodes) == 0 && len(composeNodes) == 0
    
    inKindContext := make(map[string]bool)
    inComposeContext := make(map[string]bool)

    if enableAll {
        // Mark all nodes as effectively in both contexts (or strictly, we just don't filter)
        // But to keep logic simple, let's mark all as reachable
        for _, node := range canvas.Nodes {
            inKindContext[node.ID] = true
            inComposeContext[node.ID] = true
        }
    } else {
        // BFS for Kind Cluster
        queue := append([]string{}, kindNodes...)
        visited := make(map[string]bool)
        for _, id := range kindNodes { visited[id] = true; inKindContext[id] = true }
        
        for len(queue) > 0 {
            curr := queue[0]
            queue = queue[1:]
            
            for _, neighbor := range adj[curr] {
                if !visited[neighbor] {
                    visited[neighbor] = true
                    inKindContext[neighbor] = true
                    queue = append(queue, neighbor)
                }
            }
        }

        // BFS for Docker Compose
        queue = append([]string{}, composeNodes...)
        visited = make(map[string]bool) // reset visited
        for _, id := range composeNodes { visited[id] = true; inComposeContext[id] = true }
        
        for len(queue) > 0 {
            curr := queue[0]
            queue = queue[1:]
            
            for _, neighbor := range adj[curr] {
                if !visited[neighbor] {
                    visited[neighbor] = true
                    inComposeContext[neighbor] = true
                    queue = append(queue, neighbor)
                }
            }
        }
    }

	// 5. Generate and Filter Manifests
	composeServices := make(map[string]translator.ComposeService)
	helmValues := make(map[string]interface{})
	configs := make(map[string]string)
    chartDependencies := []translator.ChartDependency{}

	for _, node := range canvas.Nodes {
        if node.Type == "group" || node.Type == "kind-cluster" || node.Type == "docker-compose" {
            continue
        }

        // Check if node is relevant for either context
        relevantToCompose := inComposeContext[node.ID]
        relevantToHelm := inKindContext[node.ID]

        // Skip if not relevant to anything (orphaned node in infra-aware mode)
        if !relevantToCompose && !relevantToHelm {
            // Optional: Include strictly configured nodes? 
            // For now, if you are not connected to Infra, you are not exported.
            continue
        }

        manifests, err := s.generator.GenerateManifests(node, canvas.Nodes, canvas.Connections)
        if err != nil {
            continue 
        }
        if manifests == nil {
            continue
        }

        // Merge Configs (Include if relevant to either)
        for k, v := range manifests.Configs {
            configs[k] = v
        }

        // Add to Docker Compose Services (Only if relevant to Compose)
        if relevantToCompose && manifests.DockerCompose != nil {
            serviceName := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
            composeServices[serviceName] = *manifests.DockerCompose
        }

        // Add Extra Compose Services (Only if relevant to Compose)
        if relevantToCompose && len(manifests.ExtraComposeServices) > 0 {
             for suffix, svc := range manifests.ExtraComposeServices {
                 name := fmt.Sprintf("%s-%s", suffix, node.ID[:4])
                 composeServices[name] = svc
            }
        }

        // Merge Helm Values (Only if relevant to Helm)
        if relevantToHelm && manifests.HelmValues != nil {
             serviceName := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
             helmValues[serviceName] = *manifests.HelmValues
             
             // Extract App Version from Node Data
             var rawData map[string]interface{}
             // We unmarshal again here purely for extracting the "version" field generically
             // Optimization: We could have the Generator return the app version or pass it in context,
             // but unmarshalling map is cheap enough for this loop.
             // Actually, `node.Data` is `[]byte` JSON.
             // We can do a quick check.
             appVersion := "latest"
             if err := json.Unmarshal(node.Data, &rawData); err == nil {
                 if v, ok := rawData["version"].(string); ok && v != "" {
                     appVersion = v
                 }
             }

             // Get Dependency
             dep := translator.GetChartDependency(node.Type, appVersion)
             dep.Alias = serviceName
             
             if dep.Name != "" {
                 chartDependencies = append(chartDependencies, dep)
             }
        }
    }
    
    // 6. Collect Top-Level Volumes (From filtered services)
    volumes := make(map[string]interface{})
    for _, service := range composeServices {
        for _, vol := range service.Volumes {
            parts := []rune(vol)
            if len(parts) > 0 && parts[0] != '.' && parts[0] != '/' {
                 volParts := splitString(vol, ':')
                 if len(volParts) > 0 {
                     volName := volParts[0]
                     if len(volName) > 0 && volName[0] != '.' && volName[0] != '/' {
                         volumes[volName] = map[string]interface{}{}
                     }
                 }
            }
        }
    }

    chartMetadata := translator.ChartMetadata{
        ApiVersion:   "v2",
        Name:         "devops-canvas-chart",
        Version:      "0.1.0",
        Description:  "Generated by DevOps Canvas",
        Dependencies: chartDependencies,
    }

    // Construct final result
    result := map[string]interface{}{
        "configs":     configs,
    }

    // Only include Docker Compose if we have content or if explicitly in compose mode (and empty?)
    // User requested: "preview manifest must show Chart.yaml and helm values... docker compose component... must show Docker compose"
    // So if I am in Kind mode, I should probably omit docker_compose?
    // Let's rely on content. But if enableAll is true, we output both.
    
    if len(composeServices) > 0 || (enableAll || len(composeNodes) > 0) {
         result["docker_compose"] = map[string]interface{}{
            "version": "3.8",
            "services": composeServices,
            "volumes":  volumes,
        }
    }

    if len(helmValues) > 0 || (enableAll || len(kindNodes) > 0) {
        result["helm_values"] = helmValues
        result["chart_yaml"] = chartMetadata
    }

    return result, nil
}

// Helper for splitting strings without importing strings package everywhere if simple
func splitString(s string, sep byte) []string {
    var parts []string
    current := ""
    for i := 0; i < len(s); i++ {
        if s[i] == sep {
            parts = append(parts, current)
            current = ""
        } else {
            current += string(s[i])
        }
    }
    parts = append(parts, current)
    return parts
}
