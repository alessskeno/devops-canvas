package deploy

import (
    "context"
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "time"
    "log"

    "helm.sh/helm/v3/pkg/action"
    "helm.sh/helm/v3/pkg/chart/loader"
    "helm.sh/helm/v3/pkg/cli"
    "sigs.k8s.io/kind/pkg/cluster"
    "gopkg.in/yaml.v3"
)

func (s *Service) DeployKubernetes(ctx context.Context, workspaceID string, manifests map[string]interface{}, baseDir string) (string, error) {
    // 1. Write Helm Chart Files
    if chartMeta, ok := manifests["chart_yaml"]; ok {
        chartData, err := yaml.Marshal(chartMeta)
        if err != nil {
            return "", fmt.Errorf("failed to marshal Chart.yaml: %w", err)
        }
        if err := os.WriteFile(filepath.Join(baseDir, "Chart.yaml"), chartData, 0644); err != nil {
            return "", fmt.Errorf("failed to write Chart.yaml: %w", err)
        }
    }

    if values, ok := manifests["helm_values"]; ok {
        valuesData, err := yaml.Marshal(values)
        if err != nil {
            return "", fmt.Errorf("failed to marshal values.yaml: %w", err)
        }
        if err := os.WriteFile(filepath.Join(baseDir, "values.yaml"), valuesData, 0644); err != nil {
            return "", fmt.Errorf("failed to write values.yaml: %w", err)
        }
    }

    // 2. Determine Cluster Name
    clusterName := fmt.Sprintf("ws-%s", workspaceID)

    // 3. Create Kind Cluster (SDK)
    s.broadcastStep(workspaceID, "provisioning", "in-progress", "Checking Kind Cluster", "")
    
    provider := cluster.NewProvider(cluster.ProviderWithDocker())
    
    // Check if exists
    nodeList, err := provider.List()
    if err != nil {
        return "", fmt.Errorf("failed to list kind clusters: %w", err)
    }
    
    exists := false
    for _, n := range nodeList {
        if n == clusterName {
            exists = true
            break
        }
    }
    
    if !exists {
        s.broadcastStep(workspaceID, "provisioning", "in-progress", "Creating Kind Cluster (SDK - this may take a while)", "")
        
        var options []cluster.CreateOption
        options = append(options, cluster.CreateWithNodeImage("kindest/node:v1.27.3")) // Pin version
        options = append(options, cluster.CreateWithWaitForReady(5*time.Minute))
        options = append(options, cluster.CreateWithDisplayUsage(true))
        options = append(options, cluster.CreateWithDisplaySalutation(true))
        
        // Use config file if present
        configFile := filepath.Join(baseDir, "configs", "kind-config.yaml")
        if _, err := os.Stat(configFile); err == nil {
             cfgBytes, err := os.ReadFile(configFile)
             if err == nil {
                 options = append(options, cluster.CreateWithRawConfig(cfgBytes))
             }
        }
        
        if err := provider.Create(clusterName, options...); err != nil {
            return "", fmt.Errorf("failed to create kind cluster: %w", err)
        }
    }

    // 4. Install/Upgrade Helm Chart
    s.broadcastStep(workspaceID, "provisioning", "in-progress", "Building Helm Dependencies", "")
    
    // Run Dependency Update (Keep CLI for now as it handles repo interaction robustly)
    depCmd := exec.CommandContext(ctx, "helm", "dependency", "build", ".") // build is safer than update sometimes
    depCmd.Dir = baseDir
    if out, err := depCmd.CombinedOutput(); err != nil {
        return "", fmt.Errorf("helm dependency build failed: %s, %w", string(out), err)
    }

    // Install using Helm SDK
    s.broadcastStep(workspaceID, "provisioning", "in-progress", "Deploying Helm Chart (SDK)", "")
    
    // Settings logic
    settings := cli.New()
    settings.KubeContext = fmt.Sprintf("kind-%s", clusterName)
    // Assuming KUBECONFIG env var is picked up by cli.New() or default location
    
    actionConfig := new(action.Configuration)
    // Initialize action config
    // Log function that bridges helm logs to our system? For now just stdout/stderr via log.Printf
    if err := actionConfig.Init(settings.RESTClientGetter(), fmt.Sprintf("ws-%s", workspaceID), os.Getenv("HELM_DRIVER"), log.Printf); err != nil {
         return "", fmt.Errorf("failed to init helm config: %w", err)
    }
    
    // Load Chart
    chart, err := loader.LoadDir(baseDir)
    if err != nil {
        return "", fmt.Errorf("failed to load chart from dir: %w", err)
    }
    
    releaseName := fmt.Sprintf("rel-%s", workspaceID)
    
    // Create Namespace manually since action.Upgrade doesn't support CreateNamespace option for the internal install fallback
    // and we want to ensure it exists.
    createNsCmd := exec.CommandContext(ctx, "kubectl", "create", "namespace", fmt.Sprintf("ws-%s", workspaceID), "--context", fmt.Sprintf("kind-%s", clusterName))
    // command checks if exists? kind of.
    // simpler: ignore error or check.
    // "kubectl create ns X" fails if exists.
    // we can use "kubectl apply -f" with yaml or just ignore error?
    // "kubectl create ns X --dry-run=client -o yaml | kubectl apply -f -" is robust.
    // Or just run it and ignore "AlreadyExists".
    _ = createNsCmd.Run() // Ignore error (likely already exists)

    // Create Upgrade Action
    client := action.NewUpgrade(actionConfig)
    client.Install = true
    client.Namespace = fmt.Sprintf("ws-%s", workspaceID)
    // client.CreateNamespace = true // Removed: Not available in Upgrade struct
    client.Wait = true
    client.Timeout = 10 * time.Minute
    
    // Parse Values
    // We already wrote values.yaml, we can load it back to map[string]interface{}
    // OR just use the `manifests["helm_values"]` map directly!
    // action.Upgrade.Run takes `vals map[string]interface{}`.
    vals, ok := manifests["helm_values"].(map[string]interface{})
    if !ok {
        vals = make(map[string]interface{})
    }

    // Run Upgrade
    if _, err := client.Run(releaseName, chart, vals); err != nil {
         return "", fmt.Errorf("helm upgrade failed: %w", err)
    }

    return "deployed_kubernetes", nil
}
