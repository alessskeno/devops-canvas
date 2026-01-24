package deploy

import (
    "context"
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "time"

    "helm.sh/helm/v3/pkg/action"
    "helm.sh/helm/v3/pkg/chart/loader"
    "helm.sh/helm/v3/pkg/cli"
    "sigs.k8s.io/kind/pkg/cluster"
    "gopkg.in/yaml.v3"
    "strings"
    "strconv"
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
        // Prepare map for modification (robust against custom types/pointers)
        // We round-trip via YAML to ensure we have a clean map[string]interface{}
        tempBytes, err := yaml.Marshal(values)
        if err != nil {
             return "", fmt.Errorf("failed to marshal original values: %w", err)
        }
        
        var valuesMap map[string]interface{}
        if err := yaml.Unmarshal(tempBytes, &valuesMap); err != nil {
             return "", fmt.Errorf("failed to unmarshal values for modification: %w", err)
        }
        
        // Inject Global Security for non-Docker Hub images (ECR)
        global, ok := valuesMap["global"].(map[string]interface{})
        if !ok {
            global = make(map[string]interface{})
            valuesMap["global"] = global
        }
        
        security, ok := global["security"].(map[string]interface{})
        if !ok {
            security = make(map[string]interface{})
            global["security"] = security
        }
        
        // This is required for Bitnami charts when using non-Docker Hub registries (like ECR)
        security["allowInsecureImages"] = true

        valuesData, err := yaml.Marshal(valuesMap)
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
						
						// Check Node Count (Topology)
						countCmd := exec.Command("kubectl", "get", "nodes", "--no-headers", "--kubeconfig", tmpKube)
						outCount, _ := countCmd.CombinedOutput()
						runningNodeLines := strings.Split(strings.TrimSpace(string(outCount)), "\n")
						runningNodeCount := 0
						for _, l := range runningNodeLines {
							if strings.TrimSpace(l) != "" {
								runningNodeCount++
							}
						}

						// Calculate Expected Nodes from Config
						expectedNodes := 0
						for _, line := range strings.Split(configStr, "\n") {
							// Our generator uses "- role: ..." format
							if strings.Contains(line, "- role:") {
								expectedNodes++
							}
						}
						if expectedNodes == 0 { expectedNodes = 1 } // Default (no nodes block = 1 node)

						fmt.Printf("[Debug] Check: Version '%s' vs '%s' | Nodes %d vs %d\n", runningVersion, requestedVersion, runningNodeCount, expectedNodes)

						// Compare Logic (In-Place Scale Down vs Recreation)
						versionMismatch := runningVersion != "" && !strings.Contains(requestedVersion, runningVersion)
						
						if versionMismatch {
							fmt.Printf("[Debug] Version mismatch (%s -> %s). Triggering upgrade/recreation.\n", runningVersion, requestedVersion)
							s.broadcastStep(workspaceID, "provisioning", "in-progress", fmt.Sprintf("Upgrading Cluster (%s -> %s)...", runningVersion, requestedVersion), "")
							_ = provider.Delete(clusterName, "")
							exists = false
						} else if runningNodeCount != expectedNodes {
							if runningNodeCount > expectedNodes {
								// SCALE DOWN (In-Place)
								toRemove := runningNodeCount - expectedNodes
								fmt.Printf("[Debug] Scaling DOWN by %d nodes (In-Place)...\n", toRemove)
								s.broadcastStep(workspaceID, "provisioning", "in-progress", fmt.Sprintf("Scaling Down Cluster (%d -> %d nodes)...", runningNodeCount, expectedNodes), "")
								
								// Get all nodes
								allNodesCmd := exec.Command("kubectl", "get", "nodes", "--no-headers", "-o", "jsonpath={.items[*].metadata.name}", "--kubeconfig", tmpKube)
								out, _ := allNodesCmd.CombinedOutput()
								allNodes := strings.Fields(string(out))
								
								// Identify Candidates (Workers only, reverse order to delete highest suffixes first)
								var candidates []string
								for _, n := range allNodes {
									// Safety: Never delete control-plane
									if strings.Contains(n, "worker") && !strings.Contains(n, "control-plane") {
										candidates = append(candidates, n)
									}
								}
								// Simple reverse (though normally list is sorted by creation)
								// We remove from the end of the list
								
								removedCount := 0
								for i := len(candidates) - 1; i >= 0 && removedCount < toRemove; i-- {
									nodeName := candidates[i]
									fmt.Printf("[Debug] Removing node: %s\n", nodeName)
									
									// 1. Drain Node
									_ = exec.Command("kubectl", "drain", nodeName, "--ignore-daemonsets", "--delete-emptydir-data", "--force", "--timeout=60s", "--kubeconfig", tmpKube).Run()
									
									// 2. Delete Node Object
									_ = exec.Command("kubectl", "delete", "node", nodeName, "--kubeconfig", tmpKube).Run()
									
									// 3. remove Container (Kind maps node name to container name)
									_ = exec.Command("docker", "rm", "-f", nodeName).Run()
									
									removedCount++
								}
								
								fmt.Printf("[Debug] In-Place Scale Down Complete. Preserved Cluster.\n")
								exists = true // Cluster persists
								
							} else {
								// SCALE UP (In-Place)
								toAdd := expectedNodes - runningNodeCount
								fmt.Printf("[Debug] Scaling UP by %d nodes (In-Place)...\n", toAdd)
								s.broadcastStep(workspaceID, "provisioning", "in-progress", fmt.Sprintf("Scaling Up Cluster (+%d nodes)...", toAdd), "")
								
								// 1. Get Join Command
								joinCmdOut, err := exec.Command("docker", "exec", fmt.Sprintf("%s-control-plane", clusterName), "kubeadm", "token", "create", "--print-join-command").CombinedOutput()
								if err != nil {
								     fmt.Printf("Failed to get join command: %v. Recreating cluster.\n", err)
								     _ = provider.Delete(clusterName, "")
								     exists = false
								} else {
								    joinCmd := strings.TrimSpace(string(joinCmdOut))

								    // 2. Inspect Control Plane for Image and Network
								    cpName := fmt.Sprintf("%s-control-plane", clusterName)
								    imgOut, _ := exec.Command("docker", "inspect", cpName, "--format", "{{.Config.Image}}").CombinedOutput()
								    nodeImage := strings.TrimSpace(string(imgOut))
								    
								    netOut, _ := exec.Command("docker", "inspect", cpName, "--format", "{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}").CombinedOutput()
								    networkName := strings.TrimSpace(string(netOut))
								    if networkName == "" { networkName = "kind" }
								    
								    // 3. Find Next Suffix from All Nodes
								    allNodesCmd := exec.Command("kubectl", "get", "nodes", "--no-headers", "-o", "jsonpath={.items[*].metadata.name}", "--kubeconfig", tmpKube)
								    nodesOut, _ := allNodesCmd.CombinedOutput()
								    allNodes := strings.Fields(string(nodesOut))
								    
								    maxIndex := 1
								    for _, n := range allNodes {
								        if strings.HasPrefix(n, fmt.Sprintf("%s-worker", clusterName)) {
								             suffix := strings.TrimPrefix(n, fmt.Sprintf("%s-worker", clusterName))
								             if suffix == "" { 
								                 if 1 > maxIndex { maxIndex = 1 }
								             } else {
								                 val, _ := strconv.Atoi(suffix)
								                 if val > maxIndex { maxIndex = val }
								             }
								        }
								    }
								    
								    // 4. Provision
								    for i := 0; i < toAdd; i++ {
								        newIndex := maxIndex + 1 + i
								        newNodeName := fmt.Sprintf("%s-worker%d", clusterName, newIndex)
								        
								        // Run Container
								        runArgs := []string{"run", "-d",
								            "--privileged",
								            "--security-opt", "seccomp=unconfined",
								            "--security-opt", "apparmor=unconfined",
								            "--name", newNodeName,
								            "--hostname", newNodeName,
								            "--label", "io.x-k8s.kind.role=worker",
								            "--label", fmt.Sprintf("io.x-k8s.kind.cluster=%s", clusterName),
								            "--net", networkName,
								            "-v", "/lib/modules:/lib/modules:ro",
                                            "-v", "/var",
								            "--tmpfs", "/tmp",
								            "--tmpfs", "/run",
								            nodeImage,
								        }
								        if err := exec.Command("docker", runArgs...).Run(); err != nil {
								            fmt.Printf("Error creating node container %s: %v\n", newNodeName, err)
								            continue
								        }
								        
								        // Wait for boot
								        time.Sleep(3 * time.Second)
								        
								        // Join
								        if err := exec.Command("docker", "exec", newNodeName, "bash", "-c", joinCmd).Run(); err != nil {
								             fmt.Printf("Error joining node %s: %v\n", newNodeName, err)
								             // Cleanup?
								        }
								    }
								    exists = true
								}
							}
						} else {
							fmt.Printf("[Debug] Cluster topology and version match. No recreation needed.\n")
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
		debugLog := func(format string, v ...interface{}) {
			fmt.Printf("[HelmSDK] "+format+"\n", v...)
		}
		if err := actionConfig.Init(settings.RESTClientGetter(), fmt.Sprintf("ws-%s", workspaceID), os.Getenv("HELM_DRIVER"), debugLog); err != nil {
			 return "", fmt.Errorf("failed to init helm config: %w", err)
		}
		
		// Load Chart
		chart, err := loader.LoadDir(baseDir)
		if err != nil {
			return "", fmt.Errorf("failed to load chart from dir: %w", err)
		}
		
		// Use fixed release name "main" for simplicity.
		// Isolation is guaranteed by the workspace-specific namespace (ws-{id}).
		releaseName := "main"
		
		// Create Namespace manually using the internal kubeconfig
		createNsCmd := exec.CommandContext(ctx, "kubectl", "create", "namespace", fmt.Sprintf("ws-%s", workspaceID))
		createNsCmd.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", internalKubeConfigPath))
		_ = createNsCmd.Run() // Ignore error if exists

		// Create Upgrade Action
		client := action.NewUpgrade(actionConfig)
		client.Install = true
		client.Wait = true
		client.Timeout = 10 * time.Minute
		client.CleanupOnFail = true // Ensure failed installs don't block future upgrades (avoids "no deployed releases" error)
		


		// Run Upgrade with Self-Healing
		// Note: We pass nil for values because we have already written them to values.yaml
		// and loaded them via loader.LoadDir. Passing them again causes "type mismatch" errors
		// in some Helm SDK versions when merging duplicate maps.
		if _, err := client.Run(releaseName, chart, nil); err != nil {
			// Check for common "stuck" states that require uninstalling first
			errMsg := err.Error()
			if strings.Contains(errMsg, "has no deployed releases") || strings.Contains(errMsg, "cannot re-use a name that is still in use") {
				fmt.Printf("Helm upgrade failed with stuck state: %s. Attempting self-healing (uninstall & retry)...\n", errMsg)
				s.broadcastStep(workspaceID, "provisioning", "in-progress", "Self-Healing Helm Release...", "")

				// Attempt Uninstall
				uninstallClient := action.NewUninstall(actionConfig)
				uninstallClient.Wait = true
				uninstallClient.Timeout = 5 * time.Minute
				if _, err := uninstallClient.Run(releaseName); err != nil {
					fmt.Printf("[Debug] Helm uninstall failed during healing (might be expected): %v\n", err)
				} else {
					fmt.Printf("[Debug] Helm uninstall successful.\n")
				}

				// Nuclear Option: Manually delete Helm secrets AND ConfigMaps to clear "ghost" releases
				// Label selector might be unreliable, so we list and grep by name.
				driver := os.Getenv("HELM_DRIVER")
				if driver == "" { driver = "secret (default)" }
				fmt.Printf("[Debug] Manually scrubbing Helm storage for %s (Driver: %s)...\n", releaseName, driver)
				
				// Cluster-Wide Search: Secrets and ConfigMaps in ALL namespaces
				fmt.Printf("[Debug] Scanning CLUSTER-WIDE for ghost release...\n")
				
				// We search both Secrets and ConfigMaps simultaneously
				listCmd := exec.CommandContext(ctx, "kubectl", "get", "secrets,configmaps",
					"--all-namespaces",
					"--no-headers",
					"-o", "custom-columns=NS:.metadata.namespace,NAME:.metadata.name", // Output: "namespace resource-name"
					"--kubeconfig", internalKubeConfigPath,
				)
				
				if outBytes, err := listCmd.CombinedOutput(); err == nil {
					outputStr := string(outBytes)
					rows := strings.Split(outputStr, "\n")
					deletedCount := 0
					
					for _, row := range rows {
						// Row format: "namespacename resource-name" (whitespace separated)
						parts := strings.Fields(row)
						if len(parts) >= 2 {
							ns := parts[0]
							sName := parts[1]
							
							// Helm storage format: sh.helm.release.v1.<releaseName>.v<version>
							// We check if the resource name contains our release name
							if strings.Contains(sName, "sh.helm.release") && strings.Contains(sName, releaseName) {
								fmt.Printf("[Debug] FOUND GHOST RELEASE in namespace '%s': %s\n", ns, sName)
								
								resourceTypes := []string{"secret", "configmap"}
								for _, rType := range resourceTypes {
									delCmd := exec.CommandContext(ctx, "kubectl", "delete", rType, sName,
										"--namespace", ns,
										"--kubeconfig", internalKubeConfigPath,
										"--ignore-not-found",
									)
									if err := delCmd.Run(); err != nil {
										fmt.Printf("[Debug] Failed to delete %s/%s in %s: %v\n", rType, sName, ns, err)
									} else {
										deletedCount++
									}
								}
							}
						}
					}
					if deletedCount > 0 {
						fmt.Printf("[Debug] Cleanup actions performed on %d potential ghost resources.\n", deletedCount)
					} else {
                        fmt.Printf("[Debug] No matching ghost resources found cluster-wide.\n")
                        // Debug: Print first 5 lines of output to verify layout
                        if len(rows) > 0 {
                             fmt.Printf("[Debug] Sample output: %s\n", rows[0])
                        }
                    }
				} else {
					fmt.Printf("[Debug] Failed to cluster-scan: %v, out: %s\n", err, string(outBytes))
				}
				
				// Short wait for consistency
				time.Sleep(2 * time.Second)

				// DEBUG: Ask Helm what it sees
				fmt.Printf("[Debug] Querying Helm Release List via SDK...\n")
				listClient := action.NewList(actionConfig)
				listClient.All = true
				if releases, err := listClient.Run(); err == nil {
					if len(releases) == 0 {
						fmt.Printf("[Debug] Helm SDK sees 0 releases.\n")
					} else {
						for _, r := range releases {
							fmt.Printf("[Debug] Helm SDK sees release: %s (Status: %s, Ver: %d)\n", r.Name, r.Info.Status, r.Version)
						}
					}
				} else {
					fmt.Printf("[Debug] Helm List failed: %v\n", err)
				}

				// Retry Strategy: Force Install
				// If Upgrade failed claiming "no deployed releases", and we cleaned up, 
				// we should try a fresh INSTALL instead of Upgrade.
				fmt.Printf("Retrying Deployment (Switching to Install Action)...\n")
				s.broadcastStep(workspaceID, "provisioning", "in-progress", "Retrying with Force Install...", "")
				
				// Re-init config to ensure clean state
				newActionConfig := new(action.Configuration)
				// Re-define debugLog locally if needed or reuse
				if err := newActionConfig.Init(settings.RESTClientGetter(), fmt.Sprintf("ws-%s", workspaceID), os.Getenv("HELM_DRIVER"), debugLog); err != nil {
					fmt.Printf("[Debug] Failed to re-init helm config: %v\n", err)
				} else {
					// Use the fresh config
					installClient := action.NewInstall(newActionConfig)
					installClient.ReleaseName = releaseName
					installClient.Namespace = fmt.Sprintf("ws-%s", workspaceID)
					installClient.Wait = true
					installClient.Timeout = 10 * time.Minute
					installClient.Replace = true // Similar to --replace, good for "already exists" conflicts
					
					// Use nil for values here too
					if _, err := installClient.Run(chart, nil); err != nil {
						fmt.Printf("[Debug] Helm Install Retry failed: %v\n", err)
						return "", fmt.Errorf("helm retry (install) failed: %w", err)
					}
					fmt.Printf("[Debug] Helm Install Retry SUCCESS!\n")
					return releaseName, nil
				}
			} else {
				return "", fmt.Errorf("helm upgrade failed: %w", err)
			}
		}
	} else {
		s.broadcastStep(workspaceID, "provisioning", "completed", "Kind Cluster Details", "Skipping Helm deployment (no charts found). Cluster is ready.")
	}

    return "deployed_kubernetes", nil
}
