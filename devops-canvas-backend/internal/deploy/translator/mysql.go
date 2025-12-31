package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type MySQLConfig struct {
    CommonConfig                 // Embed Enabled and Resources
    Version            string `json:"version"`
    Port               any    `json:"port"` // Can be string or int
    RootPassword       string `json:"root_password,omitempty"`
    DatabaseName       string `json:"database,omitempty"` // Key is "database" in frontend
    MaxConnections     any    `json:"max_connections,omitempty"`
    InnoDBBufferPool   string `json:"innodb_buffer_pool_size,omitempty"`
    InnoDBFilePerTable bool   `json:"innodb_file_per_table,omitempty"`
}

type MySQLTranslator struct{}

func (t *MySQLTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config MySQLConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse mysql config: %v", err)
    }

    // Check Enabled
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }



    // Default values
    version := config.Version
    if version == "" {
        version = "8.0"
    }
    
    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "3306"
    }

    // Docker Compose
    env := map[string]string{
        "MYSQL_ROOT_PASSWORD": config.RootPassword,
    }
    if config.DatabaseName != "" {
        env["MYSQL_DATABASE"] = config.DatabaseName
    }

    // Construct command with flags
    // Official image allows passing flags after image name
    command := []string{}
    
    if config.MaxConnections != nil {
        command = append(command, fmt.Sprintf("--max-connections=%v", config.MaxConnections))
    }
    if config.InnoDBBufferPool != "" {
        command = append(command, fmt.Sprintf("--innodb-buffer-pool-size=%s", config.InnoDBBufferPool))
    }
    // innodb_file_per_table is enabled by default in 8.0, checking explicit false if needed or just enforcement
    // Frontend default is true.
    if !config.InnoDBFilePerTable {
         command = append(command, "--innodb-file-per-table=0")
    }

    compose := &ComposeService{
        Image:       "mysql:" + SanitizeDockerVersion(version),
        Ports:       []string{port + ":3306"},
        Environment: env,
        Volumes:     []string{"mysql_data_" + node.ID + ":/var/lib/mysql"},
        Command:     command,
        Restart:     "always",
    }
    
    // Resource Limits for Docker Compose
    if config.Resources != nil {
        compose.Deploy = &DeployConfig{
            Resources: &ResourcesBlock{Limits: ResourceLimits{}},
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
        if !hasLimit { compose.Deploy = nil }
    }

    // Helm Values (Bitnami structure)
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    helm["auth"] = map[string]interface{}{
        "rootPassword": config.RootPassword,
        "database":     config.DatabaseName,
    }
    helm["primary"] = map[string]interface{}{
        "service": map[string]interface{}{
            "ports": map[string]interface{}{
                "mysql": config.Port,
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
            requests["cpu"] = fmt.Sprintf("%.1fm", config.Resources.CPU * 500)
            hasResource = true
        }
        if config.Resources.Memory != "" && config.Resources.Memory != "0" {
            limits["memory"] = config.Resources.Memory
            requests["memory"] = config.Resources.Memory
            hasResource = true
        }
        if hasResource {
            resources["limits"] = limits
            resources["requests"] = requests
            helm["primary"].(map[string]interface{})["resources"] = resources
        }
    }
    
    // Add additional configs to 'configuration' string
    // Use extraFlags for runtime configuration as it overrides my.cnf defaults cleaner
    extraFlags := ""
    if config.MaxConnections != nil {
        extraFlags += fmt.Sprintf(" --max-connections=%v", config.MaxConnections)
    }
    if config.InnoDBBufferPool != "" {
        extraFlags += fmt.Sprintf(" --innodb-buffer-pool-size=%s", config.InnoDBBufferPool)
    }
    // Explicitly set innodb_file_per_table based on config (default true)
    if config.InnoDBFilePerTable {
        extraFlags += " --innodb-file-per-table=1"
    } else {
        extraFlags += " --innodb-file-per-table=0"
    }
    if extraFlags != "" {
        helm["primary"].(map[string]interface{})["extraFlags"] = extraFlags
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                // Ensure predictable service names
                helm["fullnameOverride"] = fmt.Sprintf("mysql-%s", node.ID[:4])
                serviceName := fmt.Sprintf("mysql-%s", node.ID[:4])

                helm["metrics"] = map[string]interface{}{
                    "enabled": true,
                    "serviceMonitor": map[string]interface{}{
                        "enabled": true,
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
                                "alert": "MySQLDown",
                                "expr": fmt.Sprintf(`mysql_up{service="%s"} == 0`, serviceName),
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "MySQL instance {{ $labels.instance }} down",
                                    "description": "MySQL has been down for more than 1 minute.",
                                },
                            },
                            {
                                "alert": "MySQLConnectionsHigh",
                                // Example query
                                "expr": fmt.Sprintf(`mysql_global_status_threads_connected{service="%s"} > %v * 0.8`, serviceName, func() int {
                                    if config.MaxConnections != nil {
                                        if f, ok := config.MaxConnections.(float64); ok { return int(f) }
                                        return 151 // Default MySQL max_connections
                                    }
                                    return 151
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

                break 
            }
        }
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
    }, nil
}
