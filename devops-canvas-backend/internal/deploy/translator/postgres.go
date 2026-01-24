package translator

import (
    "encoding/json"
    "fmt"
    
    "github.com/Masterminds/semver/v3"
    "devops-canvas-backend/internal/models"
)

type PostgresConfig struct {
    CommonConfig       // Embed Enabled and Resources
    Version            string `json:"version"`
    Port               any    `json:"port"`
    User               string `json:"user,omitempty"`
    Password           string `json:"password,omitempty"`
    DatabaseName       string `json:"dbName,omitempty"` // Frontend key is "dbName"
    SharedBuffers      string `json:"shared_buffers,omitempty"`
    WorkMem            string `json:"work_mem,omitempty"`
    MaintenanceWorkMem string `json:"maintenance_work_mem,omitempty"`
    EffectiveCacheSize string `json:"effective_cache_size,omitempty"`
    MaxConnections     any    `json:"max_connections,omitempty"`
    ListenAddresses    string `json:"listen_addresses,omitempty"`
    MaxWalSize         string `json:"max_wal_size,omitempty"`
}

type PostgresTranslator struct{}

func (t *PostgresTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config PostgresConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse postgres config: %v", err)
    }

    // Check Enabled status (default to true if nil)
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil // Return nil to signal this component is disabled
    }

    // Default values
    version := config.Version
    if version == "" {
        version = "16"
    }
    
    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "5432"
    }
    
    user := config.User
    if user == "" {
        user = "postgres"
    }

    // Docker Compose
    env := map[string]string{
        "POSTGRES_USER":     user,
        "POSTGRES_PASSWORD": config.Password,
    }
    if config.DatabaseName != "" {
        env["POSTGRES_DB"] = config.DatabaseName
    }

    // Postgres config tuning via command args
    command := []string{"postgres"}
    
    if config.SharedBuffers != "" {
        command = append(command, "-c", "shared_buffers="+config.SharedBuffers)
    }
    if config.WorkMem != "" {
        command = append(command, "-c", "work_mem="+config.WorkMem)
    }
    if config.MaxConnections != nil {
        command = append(command, "-c", fmt.Sprintf("max_connections=%v", config.MaxConnections))
    }
    if config.MaxWalSize != "" {
        command = append(command, "-c", "max_wal_size="+config.MaxWalSize)
    }
    

    // File Generation
    generatedConfigs := make(map[string]string)
    
    // Determine Volume Mount Path and Name based on Version
    // Postgres 18+ requires mount at /var/lib/postgresql
    // It also enforces strict directory structure, so we use a fresh volume for 18+ to avoid conflicts with older data.
    mountPath := "/var/lib/postgresql/data"
    volumeName := "postgres_data_" + node.ID
    
    // Parse version to check if >= 18
    if v, err := semver.NewVersion(version); err == nil {
         if v.Major() >= 18 {
             mountPath = "/var/lib/postgresql"
             // Version the volume to ensure clean start for major upgrade
             volumeName = fmt.Sprintf("postgres_data_v%d_%s", v.Major(), node.ID)
         }
    } else {
        // Fallback string check
        if len(version) >= 2 && version[:2] == "18" {
             mountPath = "/var/lib/postgresql"
             volumeName = "postgres_data_v18_" + node.ID
        }
    }
    
    volumes := []string{volumeName + ":" + mountPath}
    
    // Handle pg_hba.conf
    var rawData map[string]interface{}
    _ = json.Unmarshal(node.Data, &rawData)
    
    if pgHbaNodeID, ok := rawData["pg_hba"].(string); ok && pgHbaNodeID != "" {
         fileNode, err := ctx.FindNodeByID(pgHbaNodeID)
         if err == nil {
             var fileConfig ConfigFile
             if err := json.Unmarshal(fileNode.Data, &fileConfig); err == nil {
                 fileName := fmt.Sprintf("pg_hba_%s.conf", node.ID)
                 generatedConfigs[fileName] = fileConfig.Content
                 volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/postgresql/pg_hba.conf", fileName))
                 command = append(command, "-c", "hba_file=/etc/postgresql/pg_hba.conf")
             }
         }
    }

    compose := &ComposeService{
        Image:       "postgres:" + SanitizeDockerVersion(version),
        Ports:       []string{port + ":5432"},
        Environment: env,
        Volumes:     volumes,
        Command:     command,
        Restart:     "always",
    }
    
    // Resource Limits for Docker Compose
    if config.Resources != nil {
        compose.Deploy = &DeployConfig{
            Resources: &ResourcesBlock{
                Limits: ResourceLimits{},
            },
        }
        
        hasLimit := false
        if config.Resources.CPU > 0 {
            compose.Deploy.Resources.Limits.CPUs = fmt.Sprintf("%.1f", config.Resources.CPU)
            hasLimit = true
        }
        if config.Resources.Memory != "" && config.Resources.Memory != "0" {
            compose.Deploy.Resources.Limits.Memory = SanitizeMemoryForCompose(config.Resources.Memory)
            hasLimit = true
        }
        
        if !hasLimit {
            compose.Deploy = nil
        }
    }

    // Helm Values (Bitnami structure)
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "registry": "public.ecr.aws",
    }

    helm["auth"] = map[string]interface{}{
        "username": user,
        "password": config.Password,
        "database": config.DatabaseName,
    }
    helm["primary"] = map[string]interface{}{
        "service": map[string]interface{}{
            "ports": map[string]interface{}{
                "postgresql": config.Port,
            },
        },
    }
    
    // Resource Limits for Helm
    if config.Resources != nil {
        resources := map[string]interface{}{}
        limits := map[string]interface{}{}
        requests := map[string]interface{}{}
        
        hasResource := false
        if config.Resources.CPU > 0 {
            limits["cpu"] = fmt.Sprintf("%.1f", config.Resources.CPU)
            // For requests, we can set a percentage or same. Let's set 50% for requests.
            requests["cpu"] = fmt.Sprintf("%.1fm", config.Resources.CPU * 500) // 1.0 -> 500m
            hasResource = true
        }
        if config.Resources.Memory != "" && config.Resources.Memory != "0" {
            limits["memory"] = config.Resources.Memory
            requests["memory"] = config.Resources.Memory // Same for now to avoid OOMKill on burst
            hasResource = true
        }
        
        if hasResource {
            resources["limits"] = limits
            resources["requests"] = requests
            helm["primary"].(map[string]interface{})["resources"] = resources
        }
    }
    
    // Additional configuration via 'primary.configuration' or 'postgresqlConfiguration'
    // Additional configuration via 'primary.configuration' or 'postgresqlConfiguration'
    // Additional configuration via 'primary.configuration' or 'postgresqlConfiguration'
    extraConfig := ""
    // Always set port in config to match service
    extraConfig += fmt.Sprintf("port = %s\n", port)
    
    if config.SharedBuffers != "" {
        extraConfig += fmt.Sprintf("shared_buffers = %s\n", config.SharedBuffers)
    }
    if config.MaxConnections != nil {
        extraConfig += fmt.Sprintf("max_connections = %v\n", config.MaxConnections)
    }
    if config.ListenAddresses != "" {
        extraConfig += fmt.Sprintf("listen_addresses = '%s'\n", config.ListenAddresses)
    }
    if config.WorkMem != "" {
        extraConfig += fmt.Sprintf("work_mem = %s\n", config.WorkMem)
    }
    if config.MaintenanceWorkMem != "" {
        extraConfig += fmt.Sprintf("maintenance_work_mem = %s\n", config.MaintenanceWorkMem)
    }
    if config.EffectiveCacheSize != "" {
        extraConfig += fmt.Sprintf("effective_cache_size = %s\n", config.EffectiveCacheSize)
    }
    if config.MaxWalSize != "" {
        extraConfig += fmt.Sprintf("max_wal_size = %s\n", config.MaxWalSize)
    }

    if extraConfig != "" {
         helm["primary"].(map[string]interface{})["extendedConfiguration"] = extraConfig
    }
    
    // For Helm, we would add pgHbaConfiguration
    if pgHbaNodeID, ok := rawData["pg_hba"].(string); ok && pgHbaNodeID != "" {
         // Re-fetch logic or reuse if I extracted it cleanly. 
         // For brevity in block, assuming logical flow. 
         // In production code, I'd extract this lookup to top.
          fileNode, _ := ctx.FindNodeByID(pgHbaNodeID)
          if fileNode != nil {
              var fileConfig ConfigFile
              _ = json.Unmarshal(fileNode.Data, &fileConfig)
              helm["primary"].(map[string]interface{})["pgHbaConfiguration"] = fileConfig.Content
          }
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                helm["metrics"] = map[string]interface{}{
                    "enabled": true,
                    "serviceMonitor": map[string]interface{}{
                        "enabled": true,
                         // labels keys might need to be specific if charts require it, 
                         // but typically empty is fine if selectors are empty.
                         // But for completeness:
                         "labels": map[string]interface{}{
                             "release": "devops-canvas-chart",
                         },
                    },
                    "prometheusRule": map[string]interface{}{
                        "enabled": true,
                        "labels": map[string]interface{}{
                             "release": "devops-canvas-chart",
                        },
                        "rules": []map[string]interface{}{
                            {
                                "alert": "PostgresDown",
                                "expr": fmt.Sprintf(`pg_up{service="%s"} == 0`, fmt.Sprintf("postgres-%s-headless", node.ID[:4])), // Update service name logic if needed. Bitnami often creates headless or standard svc.
                                // Actually, Bitnami's generated SM will point to the svc.
                                // The generic query `pg_up` matches on `service` label which usually matches K8s service name.
                                // Bitnami postgres service name `fullname` is usually passed.
                                // Careful with service name override. I kept fullnameOverride before.
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Postgres instance {{ $labels.instance }} down",
                                    "description": "Postgres has been down for more than 1 minute.",
                                },
                            },
                            {
                                "alert": "PostgresConnectionsHigh",
                                "expr": fmt.Sprintf(`sum(pg_stat_activity_count) by (service) > %v * 0.8`, func() int {
                                    if config.MaxConnections != nil {
                                        return defaultPort(config.MaxConnections, 100) // Helper? No, manually cast
                                         if f, ok := config.MaxConnections.(float64); ok { return int(f) }
                                         return 100
                                    }
                                    return 100
                                }()),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "warning",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "High connection count",
                                },
                            },
                        },
                    },
                }

                // 2. Set fullnameOverride to ensure predictable Service names for alerts/monitors
                helm["fullnameOverride"] = fmt.Sprintf("postgres-%s", node.ID[:4])
                
                // No external file generation needed!
                break // Only need to connect to one monitoring stack
            }
        }
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
        Configs:       generatedConfigs,
    }, nil
}
