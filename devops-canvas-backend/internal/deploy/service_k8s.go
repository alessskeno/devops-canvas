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
    "strings"
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

	// Upgrade Logic: Check if requested version differs from running version
	if exists {
		// 1. Get Requested Version from Config
		configFile := filepath.Join(baseDir, "configs", "kind-config.yaml")
		configBytes, err := os.ReadFile(configFile)
		if err == nil {
			configStr := string(configBytes)
			// Simple check for image tag: kindest/node:(v[0-9.]+)
			// We iterate lines to find the first image definition
			requestedVersion := ""
			for _, line := range strings.Split(configStr, "\n") {
				if strings.Contains(line, "image: kindest/node:") {
					parts := strings.Split(line, "image: kindest/node:")
					if len(parts) > 1 {
						requestedVersion = strings.TrimSpace(parts[1])
						break
					}
				}
			}

			if requestedVersion != "" {
				fmt.Printf("[Debug] Requested Version from Config: %s\n", requestedVersion)
				
				// 2. Get Running Version
				// We need to ensure we can talk to the cluster. Export config first (temp) or use provider.
				// provider.KubeConfig might fail if not exported? No, it fetches from container.
				
				// Use provider.KubeConfig with internal=true for container-to-container access
				kcfg, err := provider.KubeConfig(clusterName, true) 
				if err != nil {
					fmt.Printf("[Debug] Failed to get internal kubeconfig for version check: %v\n", err)
				}
				
				if kcfg != "" {
					tmpKube := filepath.Join(baseDir, "kubeconfig.check")
					_ = os.WriteFile(tmpKube, []byte(kcfg), 0600)
					
					// Check Version
					verCmd := exec.Command("kubectl", "get", "nodes", "-o", "jsonpath={.items[0].status.nodeInfo.kubeletVersion}", "--kubeconfig", tmpKube)
					out, err := verCmd.CombinedOutput()
					if err == nil {
						runningVersion := strings.TrimSpace(string(out)) // e.g., v1.31.2
						fmt.Printf("[Debug] Running Version from Cluster: %s\n", runningVersion)
						
						// Compare
						if runningVersion != "" && !strings.Contains(requestedVersion, runningVersion) {
							fmt.Printf("[Debug] Version mismatch detected! Triggering upgrade.\n")
							s.broadcastStep(workspaceID, "provisioning", "in-progress", fmt.Sprintf("Upgrading Cluster (%s -> %s)...", runningVersion, requestedVersion), "")
							
							// Delete Cluster
							_ = provider.Delete(clusterName, "")
							exists = false // Force recreation
						} else {
							fmt.Printf("[Debug] Versions match or overlap. No upgrade needed.\n")
						}
					} else {
						fmt.Printf("[Debug] Failed to get running version: %v, output: %s\n", err, string(out))
					}
					_ = os.Remove(tmpKube)
				}
			} else {
				fmt.Printf("[Debug] Could not parse requested version from kind-config.yaml\n")
			}
		}
	}
    
    if !exists {
        s.broadcastStep(workspaceID, "provisioning", "in-progress", "Creating Kind Cluster (SDK - this may take a while)", "")
        
        var options []cluster.CreateOption
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

    // Ensure the Kubeconfig is exported to the default location (~/.kube/config)
    // This ensures that subsequent 'kubectl' commands (like GetLogs) work correctly
    // even if the backend container was restarted while the cluster persisted.
    // We use --internal to ensure the kubeconfig uses the container/network IP, not localhost.
    exportCmd := exec.CommandContext(ctx, "kind", "export", "kubeconfig", "--name", clusterName, "--internal")
    if out, err := exportCmd.CombinedOutput(); err != nil {
        fmt.Printf("Warning: failed to export kubeconfig: %v, output: %s\n", err, string(out))
        // We don't return error here, as we might still succeed with internal config for Helm
    }

    // New: Manually Wait for Cluster Readiness using Internal Network
    // The SDK's WaitForReady used localhost (unreachable), so we do it here after export.
    s.broadcastStep(workspaceID, "provisioning", "in-progress", "Waiting for API Server (Internal)...", "")
    ready := false
    for i := 0; i < 60; i++ { // Wait up to 2-3 minutes (usually takes 10s)
        time.Sleep(2 * time.Second)
        // We use the default kubeconfig location which was just updated by kind export
        cmd := exec.CommandContext(ctx, "kubectl", "get", "nodes")
        if err := cmd.Run(); err == nil {
            ready = true
            break
        }
    }
    if !ready {
         fmt.Printf("Warning: Timed out waiting for API server to be reachable internally.\n")
    }

    // 4. Install/Upgrade Helm Chart
	if _, ok := manifests["chart_yaml"]; ok {
		s.broadcastStep(workspaceID, "provisioning", "in-progress", "Building Helm Dependencies", "")

		// Retrieve Internal Kubeconfig for Backend -> Kind access
		internalCfg, err := provider.KubeConfig(clusterName, true)
		if err != nil {
			return "", fmt.Errorf("failed to get internal kubeconfig: %w", err)
		}
		internalKubeConfigPath := filepath.Join(baseDir, "kubeconfig.internal")
		if err := os.WriteFile(internalKubeConfigPath, []byte(internalCfg), 0600); err != nil {
			return "", fmt.Errorf("failed to write internal kubeconfig: %w", err)
		}
		
		// Run Dependency Update (Keep CLI robust)
		depCmd := exec.CommandContext(ctx, "helm", "dependency", "build", ".") 
		depCmd.Dir = baseDir
		if out, err := depCmd.CombinedOutput(); err != nil {
			return "", fmt.Errorf("helm dependency build failed: %s, %w", string(out), err)
		}

		// Install using Helm SDK
		s.broadcastStep(workspaceID, "provisioning", "in-progress", "Deploying Helm Chart (SDK)", "")
		
		// Configure Helm to use the internal kubeconfig
		settings := cli.New()
		settings.KubeConfig = internalKubeConfigPath
		
		actionConfig := new(action.Configuration)
		if err := actionConfig.Init(settings.RESTClientGetter(), fmt.Sprintf("ws-%s", workspaceID), os.Getenv("HELM_DRIVER"), log.Printf); err != nil {
			 return "", fmt.Errorf("failed to init helm config: %w", err)
		}
		
		// Load Chart
		chart, err := loader.LoadDir(baseDir)
		if err != nil {
			return "", fmt.Errorf("failed to load chart from dir: %w", err)
		}
		
		releaseName := fmt.Sprintf("rel-%s", workspaceID)
		
		// Create Namespace manually using the internal kubeconfig
		createNsCmd := exec.CommandContext(ctx, "kubectl", "create", "namespace", fmt.Sprintf("ws-%s", workspaceID))
		createNsCmd.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", internalKubeConfigPath))
		_ = createNsCmd.Run() // Ignore error if exists

		// Create Upgrade Action
		client := action.NewUpgrade(actionConfig)
		client.Install = true
		client.Namespace = fmt.Sprintf("ws-%s", workspaceID)
		client.Wait = true
		client.Timeout = 10 * time.Minute
		
		// Parse Values
		vals, ok := manifests["helm_values"].(map[string]interface{})
		if !ok {
			vals = make(map[string]interface{})
		}

		// Run Upgrade
		if _, err := client.Run(releaseName, chart, vals); err != nil {
			 return "", fmt.Errorf("helm upgrade failed: %w", err)
		}
	} else {
		s.broadcastStep(workspaceID, "provisioning", "completed", "Kind Cluster Details", "Skipping Helm deployment (no charts found). Cluster is ready.")
	}

    return "deployed_kubernetes", nil
}
