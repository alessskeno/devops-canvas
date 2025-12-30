package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type ClickHouseConfig struct {
    CommonConfig
    TCPPort              any    `json:"tcp_port,omitempty"`
    HTTPPort             any    `json:"http_port,omitempty"`
    MaxConnections       any    `json:"max_connections,omitempty"`
    MaxConcurrentQueries any    `json:"max_concurrent_queries,omitempty"`
    MaxMemoryUsage       string `json:"max_memory_usage,omitempty"`
    MaxThreads           any    `json:"max_threads,omitempty"`
    Version              string `json:"version"`
}

type ClickHouseTranslator struct{}

func (t *ClickHouseTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config ClickHouseConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse clickhouse config: %v", err)
    }

    // Check Enabled
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }

    version := config.Version
    if version == "" {
        version = "latest"
    }

    httpPort := fmt.Sprintf("%v", config.HTTPPort)
    if httpPort == "" || httpPort == "<nil>" {
        httpPort = "8123"
    }

    tcpPort := fmt.Sprintf("%v", config.TCPPort)
    if tcpPort == "" || tcpPort == "<nil>" {
        tcpPort = "9000"
    }

    // ClickHouse uses config.xml files, hard to pass specific flags via pure env in official image without mounting config.
    // However, we can use ulimits or some envs if supported. 
    // Official image 'clickhouse/clickhouse-server' supports config via /etc/clickhouse-server/config.d/
    
    compose := &ComposeService{
        Image:       "clickhouse/clickhouse-server:" + version,
        Ports:       []string{httpPort + ":8123", tcpPort + ":9000"},
        Environment: map[string]string{
            "CLICKHOUSE_DB": "default",
        },
        Volumes:     []string{"clickhouse_data_" + node.ID + ":/var/lib/clickhouse"},
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
            compose.Deploy.Resources.Limits.Memory = config.Resources.Memory
            hasLimit = true
        }
        if !hasLimit { compose.Deploy = nil }
    }

    // For specific settings like max_connections, we might need to assume we can't easily set them without mounting a file in standard docker compose without custom logic.
    // But for this translator, we can at least ensure basic connectivity.
    
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
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
            helm["resources"] = resources
        }
    }

    // --- Advanced Configuration (XML Injection) ---
    
    // 1. configdFiles (Server Settings)
    configdXML := "<clickhouse>\n"
    hasConfigd := false
    
    // Max Connections
    if config.MaxConnections != nil {
        configdXML += fmt.Sprintf("    <max_connections>%v</max_connections>\n", config.MaxConnections)
        hasConfigd = true
    }
    // Max Concurrent Queries
    if config.MaxConcurrentQueries != nil {
        configdXML += fmt.Sprintf("    <max_concurrent_queries>%v</max_concurrent_queries>\n", config.MaxConcurrentQueries)
        hasConfigd = true
    }
    // Explicit Ports in XML (optional but good for consistency if overriding)
    if tcpPort != "9000" {
        configdXML += fmt.Sprintf("    <tcp_port>%s</tcp_port>\n", tcpPort)
        hasConfigd = true
    }
    if httpPort != "8123" {
        configdXML += fmt.Sprintf("    <http_port>%s</http_port>\n", httpPort)
        hasConfigd = true
    }
    configdXML += "</clickhouse>"

    if hasConfigd {
        // Currently helm root is flat structure mimicking Chart values? 
        // Bitnami charts usually have `image`, `auth`, etc. at top level.
        // But for ClickHouse, `configdFiles` is usually at top level or under specific section depending on chart.
        // Assuming official Bitnami struct: top level `configdFiles`.
        helm["configdFiles"] = map[string]string{
            "99-server-tuning.xml": configdXML,
        }
    }

    // 2. usersdFiles (User Profile Settings)
    usersdXML := "<clickhouse>\n    <profiles>\n        <default>\n"
    hasUsersd := false
    
    if config.MaxMemoryUsage != "" {
        usersdXML += fmt.Sprintf("            <max_memory_usage>%s</max_memory_usage>\n", config.MaxMemoryUsage)
        hasUsersd = true
    }
    if config.MaxThreads != nil {
         usersdXML += fmt.Sprintf("            <max_threads>%v</max_threads>\n", config.MaxThreads)
         hasUsersd = true
    }
    usersdXML += "        </default>\n    </profiles>\n</clickhouse>"

    if hasUsersd {
        helm["usersdFiles"] = map[string]string{
            "99-user-tuning.xml": usersdXML,
        }
    }

    // 3. Container Ports
    helm["containerPorts"] = map[string]interface{}{
        "tcp":  tcpPort, 
        "http": httpPort,
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                helm["fullnameOverride"] = fmt.Sprintf("clickhouse-%s", node.ID[:4])
                serviceName := fmt.Sprintf("clickhouse-%s", node.ID[:4])

                helm["metrics"] = map[string]interface{}{
                    "enabled": true,
                    "serviceMonitor": map[string]interface{}{
                        "enabled": true,
                        // Fix for ClickHouse ServiceMonitor port - usually 'http'
                        "port": "http", 
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
                                "alert": "ClickHouseDown",
                                "expr": fmt.Sprintf(`clickhouse_up{service="%s"} == 0`, serviceName), // Assuming standard exporter metric
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "ClickHouse instance {{ $labels.instance }} down",
                                    "description": "ClickHouse has been down for more than 1 minute.",
                                },
                            },
                        },
                    },
                }

                break 
            }
        }
    }

    // --- Advanced Configuration (XML Injection) ---
    
    // 1. configdFiles (Server Settings)
    configdXML := "<clickhouse>\n"
    hasConfigd := false
    
    // Max Connections
    if config.MaxConnections != nil {
        configdXML += fmt.Sprintf("    <max_connections>%v</max_connections>\n", config.MaxConnections)
        hasConfigd = true
    }
    // Max Concurrent Queries
    if config.MaxConcurrentQueries != nil {
        configdXML += fmt.Sprintf("    <max_concurrent_queries>%v</max_concurrent_queries>\n", config.MaxConcurrentQueries)
        hasConfigd = true
    }
    // Explicit Ports in XML (optional but good for consistency if overriding)
    if tcpPort != "9000" {
        configdXML += fmt.Sprintf("    <tcp_port>%s</tcp_port>\n", tcpPort)
        hasConfigd = true
    }
    if httpPort != "8123" {
        configdXML += fmt.Sprintf("    <http_port>%s</http_port>\n", httpPort)
        hasConfigd = true
    }
    configdXML += "</clickhouse>"

    if hasConfigd {
        // Currently helm root is flat structure mimicking Chart values? 
        // Bitnami charts usually have `image`, `auth`, etc. at top level.
        // But for ClickHouse, `configdFiles` is usually at top level or under specific section depending on chart.
        // Assuming official Bitnami struct: top level `configdFiles`.
        helm["configdFiles"] = map[string]string{
            "99-server-tuning.xml": configdXML,
        }
    }

    // 2. usersdFiles (User Profile Settings)
    usersdXML := "<clickhouse>\n    <profiles>\n        <default>\n"
    hasUsersd := false
    
    if config.MaxMemoryUsage != "" {
        usersdXML += fmt.Sprintf("            <max_memory_usage>%s</max_memory_usage>\n", config.MaxMemoryUsage)
        hasUsersd = true
    }
    if config.MaxThreads != nil {
         usersdXML += fmt.Sprintf("            <max_threads>%v</max_threads>\n", config.MaxThreads)
         hasUsersd = true
    }
    usersdXML += "        </default>\n    </profiles>\n</clickhouse>"

    if hasUsersd {
        helm["usersdFiles"] = map[string]string{
            "99-user-tuning.xml": usersdXML,
        }
    }

    // 3. Container Ports
    helm["containerPorts"] = map[string]interface{}{
        "tcp":  tcpPort, 
        "http": httpPort,
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                helm["fullnameOverride"] = fmt.Sprintf("clickhouse-%s", node.ID[:4])
                serviceName := fmt.Sprintf("clickhouse-%s", node.ID[:4])

                helm["metrics"] = map[string]interface{}{
                    "enabled": true,
                    "serviceMonitor": map[string]interface{}{
                        "enabled": true,
                        // Fix for ClickHouse ServiceMonitor port - usually 'http'
                        "port": "http", 
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
                                "alert": "ClickHouseDown",
                                "expr": fmt.Sprintf(`clickhouse_up{service="%s"} == 0`, serviceName), // Assuming standard exporter metric
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "ClickHouse instance {{ $labels.instance }} down",
                                    "description": "ClickHouse has been down for more than 1 minute.",
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
