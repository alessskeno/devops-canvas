package deploy

import (
	"context"

	"devops-canvas-backend/internal/deploy/translator"
    "devops-canvas-backend/internal/realtime"
	"devops-canvas-backend/internal/workspace"
	"encoding/json"
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "time"
    "io"

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
}

func NewService(repo *Repository, workspaceRepo *workspace.Repository, generator *ManifestGenerator, hub *realtime.Hub, dockerClient *client.Client) *Service {
	return &Service{
		repo:          repo,
		workspaceRepo: workspaceRepo,
		generator:     generator,
        hub:           hub,
        dockerClient:  dockerClient,
	}
}

func (s *Service) DeployWorkspace(ctx context.Context, workspaceID string) (string, error) {
    // Variables for cleanup (captured by defer)
    var baseDir string
    var isKind bool
    
    // Defer Cleanup on Cancellation
    defer func() {
        if ctx.Err() != nil {
             // Only cleanup if baseDir is set (meaning we proceeded enough)
             if baseDir == "" { return }
             
             s.broadcastStep(workspaceID, "provisioning", "error", "Deployment Cancelled", "Rolling back changes...")
             
             // Run cleanup in background
             cleanupCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
             defer cancel()
             
             s.cleanupDeployment(cleanupCtx, workspaceID, baseDir, isKind)
        }
    }()

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

    // Check if manifest implies an empty deployment (i.e., all components disabled)
    hasServices := false
    
    // Check Docker Compose Services
    if compose, ok := manifests["docker_compose"].(map[string]interface{}); ok {
        if services, ok := compose["services"].(map[string]translator.ComposeService); ok && len(services) > 0 {
            hasServices = true
        }
    }
    
    // Check Kind/Helm Dependencies
    if chart, ok := manifests["chart_yaml"].(translator.ChartMetadata); ok {
        if len(chart.Dependencies) > 0 {
            hasServices = true
        }
    }

    // Fix: Allow deployment if Kind config exists (Infrastructure only deployment)
    if configs, ok := manifests["configs"].(map[string]string); ok {
        if _, exists := configs["kind-config.yaml"]; exists {
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
    
    // Clean up previous run configs to prevent stale state (e.g. old kind-config.yaml)
    _ = os.RemoveAll(baseDir)
    
    if err := os.MkdirAll(filepath.Join(baseDir, "configs"), 0755); err != nil {
        return "", fmt.Errorf("failed to create directory: %w", err)
    }

    // 3. Write Config Files
    if configs, ok := manifests["configs"].(map[string]string); ok {
        for filename, content := range configs {
            // Sanitize Config: Replace tabs with spaces to avoid YAML errors
            // especially for user-provided Kind configs.
            cleanContent := strings.ReplaceAll(content, "\t", "  ")
            
            if err := os.WriteFile(filepath.Join(baseDir, "configs", filename), []byte(cleanContent), 0644); err != nil {
                return "", fmt.Errorf("failed to write config %s: %w", filename, err)
            }
        }
    }

    // Check for Kind Config to determine deployment mode
    // (isKind is already declared at top)
    
    // Safely cast configs map
    configs, configsOk := manifests["configs"].(map[string]string)
    
    if configsOk {
        if _, exists := configs["kind-config.yaml"]; exists {
            isKind = true
        }
    }
    
    // Also check for helm values
    if _, ok := manifests["chart_yaml"]; ok {
         if configsOk {
             if _, exists := configs["kind-config.yaml"]; exists {
                 isKind = true
             }
         }
    }

    if isKind {
        s.broadcastStep(workspaceID, "provisioning", "in-progress", "Provisioning Kind Cluster", "")
        status, err := s.DeployKubernetes(ctx, workspaceID, manifests, baseDir)
        if err != nil {
             // If error was context canceled, the defer block will handle cleanup
             // If standard error, we return generic error
             if ctx.Err() != nil {
                 return "", ctx.Err()
             }
             s.broadcastStep(workspaceID, "provisioning", "error", "Provisioning Failed", err.Error())
             return status, err
        }
        s.broadcastStep(workspaceID, "provisioning", "completed", "Provisioning Kind Cluster", "")
        s.broadcastStep(workspaceID, "verified", "completed", "Cluster Healthy", "")
        return status, nil
    } else {
        // If not deploying Kind, ensure any existing Kind cluster for this workspace is removed.
        // This handles cases where user switches from Kind -> Docker Compose or disables Kind.
        // We do this asynchronously or simply run it.
        // Using "kind delete cluster" is safe even if it doesn't exist.
        clusterName := fmt.Sprintf("ws-%s", workspaceID)
        _ = exec.CommandContext(ctx, "kind", "delete", "cluster", "--name", clusterName).Run()
    }

    // 4. Write Docker Compose
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

        // Cleanup: Ensure previous containers for this project are removed to free up ports
        // Ignore errors if project doesn't exist yet
        cleanupCmd := exec.CommandContext(ctx, "docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "down", "--remove-orphans")
        cleanupCmd.Dir = baseDir
        _ = cleanupCmd.Run() 
        
        // Check ctx again
        if ctx.Err() != nil { return "", ctx.Err() }

        // 5. Execute Docker Compose Up
        // Project name = workspaceID
        cmd := exec.CommandContext(ctx, "docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "up", "-d", "--remove-orphans", "--build")
        cmd.Dir = baseDir
        output, err := cmd.CombinedOutput()
        if err != nil {
            if ctx.Err() != nil { return "", ctx.Err() }
            s.broadcastStep(workspaceID, "provisioning", "error", "Provisioning Failed", string(output))
            return "", fmt.Errorf("docker compose up failed: %s, output: %s", err, string(output))
        }
        s.broadcastStep(workspaceID, "provisioning", "completed", "Provisioning Containers", "")
    }

    // Verification Step (Real health check)
    s.broadcastStep(workspaceID, "verified", "in-progress", "Verifying Health", "")
    
    // Check for container stability (Docker Compose)
    if !isKind {
        if err := s.verifyDockerHealth(ctx, workspaceID, baseDir); err != nil {
             if ctx.Err() != nil { return "", ctx.Err() }
            s.broadcastStep(workspaceID, "verified", "error", "Verification Failed", err.Error())
            return "", fmt.Errorf("health check failed: %w", err)
        }
    } else {
        // For Kind, we did a basic check in DeployKubernetes, but we could add more logic here locally if needed.
        // For now, we trust DeployKubernetes's "wait" flag + minimal check.
        select {
        case <-ctx.Done():
            return "", ctx.Err()
        case <-time.After(2000 * time.Millisecond):
        }
    }
    
    s.broadcastStep(workspaceID, "verified", "completed", "Deployment Healthy", "")
    return "deployed", nil
}

func (s *Service) TeardownWorkspace(ctx context.Context, workspaceID string) error {
    baseDir := fmt.Sprintf("/tmp/workspaces/%s", workspaceID)
    
    // 1. Clean up Kind Cluster (Always try)
    // Cluster name convention: ws-{workspaceID}
    clusterName := fmt.Sprintf("ws-%s", workspaceID)
    // We suppress output/error because if it doesn't exist, that's fine.
    _ = exec.CommandContext(ctx, "kind", "delete", "cluster", "--name", clusterName).Run()

    // 2. Clean up Docker Compose
    // Attempt standard down if file exists
    configPath := filepath.Join(baseDir, "docker-compose.yaml")
    if _, err := os.Stat(configPath); err == nil {
        cmd := exec.CommandContext(ctx, "docker", "compose", "-p", workspaceID, "-f", "docker-compose.yaml", "down", "--remove-orphans", "--volumes")
        cmd.Dir = baseDir
        if err := cmd.Run(); err != nil {
             // Log error but continue to Force Cleanup
             fmt.Printf("Standard docker compose down failed: %v\n", err)
        }
    }

    // 3. Force Cleanup via Docker Client (Safety Net)
    // Remove any containers labeled with this project, in case file was missing or down failed
    if s.dockerClient != nil {
        filterArgs := filters.NewArgs()
        filterArgs.Add("label", fmt.Sprintf("com.docker.compose.project=%s", workspaceID))
        
        containers, err := s.dockerClient.ContainerList(ctx, container.ListOptions{All: true, Filters: filterArgs})
        if err == nil {
            for _, c := range containers {
                // Force remove
                _ = s.dockerClient.ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true, RemoveVolumes: true})
            }
        }
    }

    // 4. Clean up temp directory
    _ = os.RemoveAll(baseDir)

    return nil
}

func (s *Service) cleanupDeployment(ctx context.Context, workspaceID, baseDir string, isKind bool) {
    // Legacy helper, now forwarding to TeardownWorkspace for consistency if needed, 
    // or keep simple for internal rollback. 
    // Actually, let's make cleanupDeployment just call TeardownWorkspace to DRY.
    s.TeardownWorkspace(ctx, workspaceID)
}

func (s *Service) GetLogs(ctx context.Context, workspaceID string, componentID string) ([]string, error) {
    // Check if directory exists (deployment check)
    baseDir := fmt.Sprintf("/tmp/workspaces/%s", workspaceID)
    if _, err := os.Stat(baseDir); os.IsNotExist(err) {
        return []string{"No deployment found (directory missing)"}, nil
    }

    // Determine target service name if componentID is provided
    targetServiceName := ""
    if componentID != "" {
        // We need to look up the node to match the naming convention: "{type}-{id[:4]}"
        // We can fetch the canvas.
        canvas, err := s.workspaceRepo.GetCanvas(ctx, workspaceID)
        if err == nil {
            for _, node := range canvas.Nodes {
                if node.ID == componentID {
                     // Infrastructure nodes (docker-compose, kind-cluster) imply "show all" logic usually,
                     // but if user specifically asked for them, we might treat them as "all" or specific?
                     // Request says: "component configuration tab > log" -> specific.
                     // "docker compose or kind cluster configuration tab > log" -> all.
                     if node.Type == "docker-compose" || node.Type == "kind-cluster" {
                         targetServiceName = "" // Fetch all
                     } else {
                         targetServiceName = fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
                     }
                     break
                }
            }
        }
    }

    // Check for Kind Config
    isKind := false
    if _, err := os.Stat(filepath.Join(baseDir, "configs", "kind-config.yaml")); err == nil {
        isKind = true
    }

    if isKind {
        // Kind / Kubernetes Logic
        namespace := fmt.Sprintf("ws-%s", workspaceID)
        clusterName := fmt.Sprintf("ws-%s", workspaceID)
        contextName := fmt.Sprintf("kind-%s", clusterName)

        // If targetServiceName is set, we find the specific pod(s) first
        // Pods are typically named like "release-alias-deployment-hash"
        // Our alias is targetServiceName.
        // So we want pods where name contains targetServiceName.
        
        // 0. Always get Node Status for Context
        nodesCmd := exec.Command("kubectl", "get", "nodes", "--context", contextName)
        nodesOutput, _ := nodesCmd.CombinedOutput()
        
        var allLogs []string
        if len(nodesOutput) > 0 {
             allLogs = append(allLogs, fmt.Sprintf("[Cluster Nodes]\n%s", string(nodesOutput)))
        }

        // 1. Get All Pods in Namespace
        cmd := exec.Command("kubectl", "get", "pods", 
            "--namespace", namespace,
            "--context", contextName,
            "-o", "jsonpath={.items[*].metadata.name}",
        )
        output, err := cmd.CombinedOutput()
        if err != nil {
             // If we have node status, return that at least
             if len(allLogs) > 0 {
                 allLogs = append(allLogs, fmt.Sprintf("Error listing pods: %v", err))
                 return allLogs, nil
             }
             return []string{fmt.Sprintf("Error listing pods: %v", err)}, nil
        }
        
        allPods := strings.Fields(string(output))
        if len(allPods) == 0 {
            if len(allLogs) > 0 {
                return allLogs, nil
            }
            return []string{"No pods found (Cluster is ready but empty)"}, nil
        }
        
        var targetPods []string
        if targetServiceName != "" {
            for _, podName := range allPods {
                if strings.Contains(podName, targetServiceName) {
                    targetPods = append(targetPods, podName)
                }
            }
            if len(targetPods) == 0 {
                return []string{fmt.Sprintf("No pods found for component %s (%s)", componentID, targetServiceName)}, nil
            }
        } else {
            targetPods = allPods
        }
        
        // 2. Fetch logs for target pods
        
        // Parallelize or sequential? Sequential is safer for now.
        // Limit total pods to avoid timeouts?
        if len(targetPods) > 10 {
            targetPods = targetPods[:10]
            allLogs = append(allLogs, "[System] Log output limited to first 10 pods...")
        }
        
        for _, pod := range targetPods {
            cmd := exec.Command("kubectl", "logs", pod,
                "--all-containers",
                "--namespace", namespace,
                "--context", contextName,
                "--tail", "50",
            )
            out, err := cmd.CombinedOutput()
            if err != nil {
                allLogs = append(allLogs, fmt.Sprintf("[%s] Error: %v", pod, err))
            } else {
                lines := strings.Split(string(out), "\n")
                for _, l := range lines {
                    if strings.TrimSpace(l) != "" {
                        allLogs = append(allLogs, fmt.Sprintf("[%s] %s", pod, l))
                    }
                }
            }
        }
        
        return allLogs, nil

    } else {
         // Docker Compose Logic
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
            // Determine name
            name := ""
            if len(c.Names) > 0 { 
                name = strings.TrimPrefix(c.Names[0], "/")
            }
            
            // Filter
            if targetServiceName != "" {
                 // Container matching: project-service-1
                 // Service name in manifest: targetServiceName
                 // Match if name contains targetServiceName
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
                         // Very basic binary header stripping (docker stdcopy)
                         // Header is 8 bytes.
                         // But we readAll... Wait, if using TTY=false (default), we get header.
                         // Let's strip first 8 bytes if they look binary?
                         // Actually, standard approach: stdcopy.StdCopy.
                         // But for simplicity in this MVP string handling:
                         if l[0] < 32 { // Binary-ish
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
        if node.Type == "group" || node.Type == "docker-compose" {
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

    // Only generate Chart structure if we actually have dependencies or values to deploy.
    // If we only have a Kind cluster and no services, we should NOT generate a chart,
    // to prevent the Helm installer from running against an empty chart.
    if len(helmValues) > 0 || len(chartDependencies) > 0 {
        result["helm_values"] = helmValues
        result["chart_yaml"] = translator.ChartMetadata{
            ApiVersion:   "v2",
            Name:         "devops-canvas-chart",
            Version:      "0.1.0",
            Description:  "Generated by DevOps Canvas",
            Dependencies: chartDependencies,
        }
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
