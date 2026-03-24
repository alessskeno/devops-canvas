package deploy

import (
	"context"
	"encoding/json"
	"log"

	"devops-canvas-backend/internal/deploy/translator"
	"devops-canvas-backend/internal/models"
	"devops-canvas-backend/internal/realtime"
	"devops-canvas-backend/internal/tenant"
	"devops-canvas-backend/internal/workspace"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"gopkg.in/yaml.v3"
)

type Service struct {
	repo          *Repository
	workspaceRepo *workspace.Repository
	generator     *ManifestGenerator
	hub           *realtime.Hub
	dockerClient  *client.Client
	provisioner   tenant.TenantProvisioner
}

func NewService(repo *Repository, workspaceRepo *workspace.Repository, generator *ManifestGenerator, hub *realtime.Hub, dockerClient *client.Client, provisioner tenant.TenantProvisioner) *Service {
	return &Service{
		repo:          repo,
		workspaceRepo: workspaceRepo,
		generator:     generator,
		hub:           hub,
		dockerClient:  dockerClient,
		provisioner:   provisioner,
	}
}

// resolveServiceNameForNode returns the Docker Compose service name for a node (default type-id4, or custom from component settings).
func resolveServiceNameForNode(node models.Node) string {
	name := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
	var uConfig translator.UniversalNodeConfig
	if err := json.Unmarshal(node.Data, &uConfig); err == nil && uConfig.ServiceName != "" {
		name = uConfig.ServiceName
	}
	return name
}

func (s *Service) DeployWorkspace(ctx context.Context, workspaceID string) (string, error) {
	var baseDir string

	// Defer Cleanup on Cancellation
	defer func() {
		if ctx.Err() != nil {
			if baseDir == "" {
				return
			}

			s.broadcastStep(workspaceID, "provisioning", "error", "Deployment Cancelled", "Rolling back changes...")

			cleanupCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			s.cleanupDeployment(cleanupCtx, workspaceID, baseDir)
		}
	}()

	// 0. Provision Infrastructure (SaaS / OSS)
	tenantID := "default"
	if err := s.provisioner.Provision(ctx, tenantID); err != nil {
		s.broadcastStep(workspaceID, "initializing", "error", "Provisioning Infrastructure Failed", err.Error())
		return "", fmt.Errorf("failed to provision infrastructure: %w", err)
	}

	// 1. Initializing
	s.broadcastStep(workspaceID, "initializing", "in-progress", "Initializing Deployment", "")
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-time.After(1500 * time.Millisecond):
	}

	// 2. Generate Manifests
	s.broadcastStep(workspaceID, "initializing", "completed", "Initializing Deployment", "")
	s.broadcastStep(workspaceID, "generating", "in-progress", "Generating Manifests", "")
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-time.After(1500 * time.Millisecond):
	}

	manifests, err := s.GenerateManifests(ctx, workspaceID)
	if err != nil {
		s.broadcastStep(workspaceID, "generating", "error", "Generating Manifests Failed", err.Error())
		return "", fmt.Errorf("failed to generate manifests: %w", err)
	}
	s.broadcastStep(workspaceID, "generating", "completed", "Generating Manifests", "")

	// Check if manifest implies an empty deployment
	hasServices := false
	if compose, ok := manifests["docker_compose"].(map[string]interface{}); ok {
		if services, ok := compose["services"].(map[string]translator.ComposeService); ok && len(services) > 0 {
			hasServices = true
		}
	}

	if !hasServices {
		s.broadcastStep(workspaceID, "provisioning", "in-progress", "Cleaning up resources (nothing to deploy)", "")
		if err := s.TeardownWorkspace(ctx, workspaceID); err != nil {
			s.broadcastStep(workspaceID, "provisioning", "error", "Cleanup Failed", err.Error())
			return "", err
		}
		s.broadcastStep(workspaceID, "provisioning", "completed", "Cleanup Complete", "")
		s.broadcastStep(workspaceID, "verified", "completed", "Workspace Stopped", "")
		return "stopped", nil
	}

	// 3. Prepare Directory
	baseDir = fmt.Sprintf("/tmp/workspaces/%s", workspaceID)
	_ = os.RemoveAll(baseDir)

	if err := os.MkdirAll(filepath.Join(baseDir, "configs"), 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	// 4. Write Config Files
	if configs, ok := manifests["configs"].(map[string]string); ok {
		for filename, content := range configs {
			cleanContent := strings.ReplaceAll(content, "\t", "  ")
			path := filepath.Join(baseDir, "configs", filename)
			if st, err := os.Stat(path); err == nil && st.IsDir() {
				_ = os.RemoveAll(path)
			}
			if err := os.WriteFile(path, []byte(cleanContent), 0644); err != nil {
				return "", fmt.Errorf("failed to write config %s: %w", filename, err)
			}
		}
	}

	// 5. Write Docker Compose
	if composeData, ok := manifests["docker_compose"]; ok {
		yamlData, err := yaml.Marshal(composeData)
		if err != nil {
			return "", fmt.Errorf("failed to marshal docker compose: %w", err)
		}
		if err := os.WriteFile(filepath.Join(baseDir, "docker-compose.yaml"), yamlData, 0644); err != nil {
			return "", fmt.Errorf("failed to write docker-compose.yaml: %w", err)
		}

		s.broadcastStep(workspaceID, "provisioning", "in-progress", "Provisioning Containers", "")
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(1500 * time.Millisecond):
		}

		// Cleanup previous containers
		cleanupCmd := exec.CommandContext(ctx, "docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "down", "--remove-orphans")
		cleanupCmd.Dir = baseDir
		_ = cleanupCmd.Run()

		if ctx.Err() != nil {
			return "", ctx.Err()
		}

		// 6. Execute Docker Compose Up
		cmd := exec.CommandContext(ctx, "docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "up", "-d", "--remove-orphans", "--build")
		cmd.Dir = baseDir
		output, err := cmd.CombinedOutput()
		if err != nil {
			if ctx.Err() != nil {
				return "", ctx.Err()
			}
			short, full := SummarizeDockerComposeError(output, err)
			log.Printf("[deploy] workspace=%s compose up failed: %s", workspaceID, full)
			s.broadcastStep(workspaceID, "provisioning", "error", "Provisioning Failed", short)
			return "", &ComposeUpError{Summary: short, Full: full}
		}
		s.broadcastStep(workspaceID, "provisioning", "completed", "Provisioning Containers", "")
	}

	// Verification Step
	s.broadcastStep(workspaceID, "verified", "in-progress", "Verifying Health", "")

	if err := s.verifyDockerHealth(ctx, workspaceID, baseDir); err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		s.broadcastStep(workspaceID, "verified", "error", "Verification Failed", err.Error())
		return "", fmt.Errorf("health check failed: %w", err)
	}

	s.broadcastStep(workspaceID, "verified", "completed", "Deployment Healthy", "")
	return "deployed", nil
}

func (s *Service) TeardownWorkspace(ctx context.Context, workspaceID string) error {
	baseDir := fmt.Sprintf("/tmp/workspaces/%s", workspaceID)

	// 1. Clean up Docker Compose
	configPath := filepath.Join(baseDir, "docker-compose.yaml")
	if _, err := os.Stat(configPath); err == nil {
		cmd := exec.CommandContext(ctx, "docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "down", "--remove-orphans", "--volumes")
		cmd.Dir = baseDir
		if err := cmd.Run(); err != nil {
			fmt.Printf("Standard docker compose down failed: %v\n", err)
		}
	}

	// 2. Force Cleanup via Docker Client (Safety Net)
	if s.dockerClient != nil {
		filterArgs := filters.NewArgs()
		filterArgs.Add("label", fmt.Sprintf("com.docker.compose.project=%s", workspaceID))

		containers, err := s.dockerClient.ContainerList(ctx, container.ListOptions{All: true, Filters: filterArgs})
		if err == nil {
			for _, c := range containers {
				_ = s.dockerClient.ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true, RemoveVolumes: true})
			}
		}
	}

	// 3. Clean up temp directory
	_ = os.RemoveAll(baseDir)

	return nil
}

func (s *Service) cleanupDeployment(ctx context.Context, workspaceID, baseDir string) {
	s.TeardownWorkspace(ctx, workspaceID)
}

func (s *Service) GetLogs(ctx context.Context, workspaceID string, componentID string) ([]string, error) {
	baseDir := fmt.Sprintf("/tmp/workspaces/%s", workspaceID)
	if _, err := os.Stat(baseDir); os.IsNotExist(err) {
		return []string{"No deployment found (directory missing)"}, nil
	}

	// Determine target service name (same as in compose: default type-id4 or custom ServiceName)
	targetServiceName := ""
	if componentID != "" {
		canvas, err := s.workspaceRepo.GetCanvas(ctx, workspaceID)
		if err == nil {
			for _, node := range canvas.Nodes {
				if node.ID == componentID {
					targetServiceName = resolveServiceNameForNode(node)
					break
				}
			}
		}
	}

	// Docker Compose logs
	if s.dockerClient == nil {
		return []string{"Docker client not initialized"}, nil
	}

	filterArgs := filters.NewArgs()
	filterArgs.Add("label", fmt.Sprintf("com.docker.compose.project=%s", workspaceID))

	containers, err := s.dockerClient.ContainerList(ctx, container.ListOptions{Filters: filterArgs})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	if len(containers) == 0 {
		return []string{"No running containers found"}, nil
	}

	var allLogs []string

	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}

		if targetServiceName != "" {
			if !strings.Contains(name, targetServiceName) {
				continue
			}
		}

		options := container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Tail:       "50",
		}

		out, err := s.dockerClient.ContainerLogs(ctx, c.ID, options)
		if err != nil {
			allLogs = append(allLogs, fmt.Sprintf("[%s] Error fetching logs: %v", name, err))
			continue
		}

		configBytes, _ := io.ReadAll(out)
		out.Close()

		logStr := string(configBytes)
		lines := strings.Split(logStr, "\n")

		for _, l := range lines {
			if strings.TrimSpace(l) != "" {
				cleanLine := l
				if len(l) > 8 {
					if l[0] < 32 {
						cleanLine = l[8:]
					}
				}
				allLogs = append(allLogs, fmt.Sprintf("[%s] %s", name, cleanLine))
			}
		}
	}

	if len(allLogs) == 0 && targetServiceName != "" {
		return []string{fmt.Sprintf("No logs found for component %s", targetServiceName)}, nil
	}

	return allLogs, nil
}

func (s *Service) GenerateManifests(ctx context.Context, workspaceID string) (map[string]interface{}, error) {
	// 1. Fetch Canvas State
	canvas, err := s.workspaceRepo.GetCanvas(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch canvas: %w", err)
	}

	// 1b. Validate required tool-option fields so deployment fails with a clear error
	if err := ValidateCanvasForDeploy(canvas); err != nil {
		return nil, err
	}

	// 2. Generate Manifests for all nodes (Docker Compose only)
	composeServices := make(map[string]translator.ComposeService)
	configs := make(map[string]string)
	composeTopConfigs := make(map[string]interface{})
	nodeIDToServiceName := make(map[string]string)

	for _, node := range canvas.Nodes {
		if node.Type == "group" {
			continue
		}

		manifests, err := s.generator.GenerateManifests(node, canvas.Nodes, canvas.Connections)
		if err != nil {
			log.Printf("[manifests] skipping node %s (type=%s): %v", node.ID, node.Type, err)
			continue
		}
		if manifests == nil {
			continue
		}

		// Merge Configs
		for k, v := range manifests.Configs {
			configs[k] = v
		}
		for name, body := range manifests.ComposeConfigInline {
			composeTopConfigs[name] = map[string]string{"content": body}
		}

		// Add to Docker Compose Services
		if manifests.DockerCompose != nil {
			serviceName := resolveServiceNameForNode(node)

			var uConfig translator.UniversalNodeConfig
			if err := json.Unmarshal(node.Data, &uConfig); err == nil {
				if len(uConfig.PortMappings) > 0 {
					var valid []string
					for _, p := range uConfig.PortMappings {
						if p != "" && p != ":" {
							valid = append(valid, p)
						}
					}
					if len(valid) > 0 {
						manifests.DockerCompose.Ports = valid
					}
				}
			}

			composeServices[serviceName] = *manifests.DockerCompose
			nodeIDToServiceName[node.ID] = serviceName
		}

		// Add Extra Compose Services
		if len(manifests.ExtraComposeServices) > 0 {
			for suffix, svc := range manifests.ExtraComposeServices {
				name := fmt.Sprintf("%s-%s", suffix, node.ID[:4])
				composeServices[name] = svc
			}
		}
	}

	// 2b. Apply connection-based depends_on: source service depends on target service
	for _, conn := range canvas.Connections {
		sourceName, hasSource := nodeIDToServiceName[conn.SourceID]
		targetName, hasTarget := nodeIDToServiceName[conn.TargetID]
		if !hasSource || !hasTarget || sourceName == targetName {
			continue
		}
		svc := composeServices[sourceName]
		// Deduplicate: only add if not already present
		seen := make(map[string]bool)
		if svc.DependsOn != nil {
			for _, d := range svc.DependsOn.Started {
				seen[d] = true
			}
			for _, d := range svc.DependsOn.Completed {
				seen[d] = true
			}
		}
		if !seen[targetName] {
			if svc.DependsOn == nil {
				svc.DependsOn = &translator.DependsOnSpec{}
			}
			svc.DependsOn.AppendStarted(targetName)
			composeServices[sourceName] = svc
		}
	}

	// 3. Collect Top-Level Volumes
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

	// Construct final result
	result := map[string]interface{}{
		"configs": configs,
	}

	if len(composeServices) > 0 {
		// Compose file format v2+ ignores top-level `version`; omit it to avoid CLI warnings.
		dc := map[string]interface{}{
			"services": composeServices,
			"volumes":  volumes,
		}
		if len(composeTopConfigs) > 0 {
			dc["configs"] = composeTopConfigs
		}
		result["docker_compose"] = dc
	}

	return result, nil
}

// Helper for splitting strings
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
