package deploy

import (
	"context"
	"devops-canvas-backend/internal/deploy/translator"
	"devops-canvas-backend/internal/workspace"
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

	// 2. Initialize aggregated structures
	composeServices := make(map[string]translator.ComposeService)
	helmValues := make(map[string]interface{})
	configs := make(map[string]string)

	for _, node := range canvas.Nodes {
        // Skip group nodes
        if node.Type == "group" {
            continue
        }

        // Generate manifest for this node
        manifests, err := s.generator.GenerateManifests(node, canvas.Nodes)
        if err != nil {
            // Log error or skip? For now, we skip nodes that fail translation (e.g. file nodes might not have translator)
            continue 
        }

        if manifests == nil {
            continue
        }

        // Merge Configs
        for k, v := range manifests.Configs {
            configs[k] = v
        }

        // Add to Docker Compose Services
        if manifests.DockerCompose != nil {
            // Use node label or type+ID as service name?
            // Generator doesn't return service name, it returns the struct.
            // We usually name services by type-shortID.
            serviceName := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
            composeServices[serviceName] = *manifests.DockerCompose
        }

        // Merge Helm Values
        if manifests.HelmValues != nil {
             // Namespace values under the service name to support umbrella chart pattern
             // and avoid collisions between components (e.g. both having "image" or "auth").
             serviceName := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
             helmValues[serviceName] = *manifests.HelmValues
        }
        
        // Add Extra Compose Services (for bundled components like Monitoring Stack)
        if len(manifests.ExtraComposeServices) > 0 {
            for suffix, svc := range manifests.ExtraComposeServices {
                // Name format: suffix-shortID (e.g. grafana-7a2b)
                 name := fmt.Sprintf("%s-%s", suffix, node.ID[:4])
                 composeServices[name] = svc
            }
        }
    }
    
    // 3. Collect Top-Level Volumes
    volumes := make(map[string]interface{})
    for _, service := range composeServices {
        for _, vol := range service.Volumes {
            // Check if it's a named volume (simple check: doesn't start with . or /)
            // Volume format: "name:path" or "./path:path"
            parts := []rune(vol)
            if len(parts) > 0 && parts[0] != '.' && parts[0] != '/' {
                // It's likely a named volume, split by colon if present to get name
                 // e.g. "postgres_data:/var/lib/postgresql/data" -> "postgres_data"
                 volParts := splitString(vol, ':') // Helper or inline
                 if len(volParts) > 0 {
                     volName := volParts[0]
                     // Verify again it's not a path (absolute path on windows?)
                     // Just assuming safe check for linux/unix style paths (.) and (/)
                     if len(volName) > 0 && volName[0] != '.' && volName[0] != '/' {
                         volumes[volName] = map[string]interface{}{}
                     }
                 }
            }
        }
    }

    // 4. Generate Chart.yaml Dependencies
    chartDependencies := []translator.ChartDependency{}
    for _, node := range canvas.Nodes {
        var dep translator.ChartDependency
        serviceName := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
        
        // Define mapping for known types
        switch node.Type {
        case "postgres":
            dep = translator.ChartDependency{
                Name:       "postgresql",
                Version:    "12.12.10", // Example stable version, should ideally match what translator expects
                Repository: "https://charts.bitnami.com/bitnami",
                Alias:      serviceName,
            }
        case "redis":
            dep = translator.ChartDependency{
                Name:       "redis",
                Version:    "17.15.6",
                Repository: "https://charts.bitnami.com/bitnami",
                Alias:      serviceName,
            }
        case "mysql":
            dep = translator.ChartDependency{
                Name:       "mysql",
                Version:    "9.12.2",
                Repository: "https://charts.bitnami.com/bitnami",
                Alias:      serviceName,
            }
        case "kafka":
            dep = translator.ChartDependency{
                Name:       "kafka",
                Version:    "26.4.2",
                Repository: "https://charts.bitnami.com/bitnami",
                Alias:      serviceName,
            }
        case "prometheus":
             dep = translator.ChartDependency{
                Name:       "prometheus",
                Version:    "25.4.0", // kube-prometheus-stack usually
                Repository: "https://prometheus-community.github.io/helm-charts",
                Alias:      serviceName,
            }
        case "alertmanager":
             dep = translator.ChartDependency{
                Name:       "alertmanager",
                Version:    "1.3.0",
                Repository: "https://prometheus-community.github.io/helm-charts",
                Alias:      serviceName,
            }
        case "valkey":
            dep = translator.ChartDependency{
                Name:       "valkey",
                Version:    "1.0.0", // Assuming initial stable chart
                Repository: "https://charts.bitnami.com/bitnami", // Valkey is available in Bitnami
                Alias:      serviceName,
            }
        case "grafana":
            dep = translator.ChartDependency{
                Name:       "grafana",
                Version:    "8.0.0", // Recent stable version
                Repository: "https://grafana.github.io/helm-charts",
                Alias:      serviceName,
            }
        case "monitoring_stack":
             dep = translator.ChartDependency{
                Name:       "kube-prometheus-stack",
                Version:    "56.0.0", // Stable version as per user request
                Repository: "https://prometheus-community.github.io/helm-charts",
                Alias:      serviceName,
            }
        // Add others as needed
        }
        
        if dep.Name != "" {
            chartDependencies = append(chartDependencies, dep)
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
        "docker_compose": map[string]interface{}{
            "version": "3.8",
            "services": composeServices,
            "volumes":  volumes,
        },
        "helm_values": helmValues,
        "chart_yaml":  chartMetadata,
        "configs":     configs,
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
