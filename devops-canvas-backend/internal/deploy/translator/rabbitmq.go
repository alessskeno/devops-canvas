package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type RabbitMQConfig struct {
    CommonConfig
    Port            any    `json:"port"`
    ManagementPort  any    `json:"management_port"`
    DefaultUser     string `json:"default_user"`
    DefaultPass     string `json:"default_pass"`
    Version         string `json:"version"`
}

type RabbitMQTranslator struct{}

func (t *RabbitMQTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config RabbitMQConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse rabbitmq config: %v", err)
    }

    // Check Enabled
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }

    version := config.Version
    if version == "" {
        version = "3-management" // defaulting to management tag for UI
    }

    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "5672"
    }
    
    mgmtPort := fmt.Sprintf("%v", config.ManagementPort)
    if mgmtPort == "" || mgmtPort == "<nil>" {
        mgmtPort = "15672"
    }

    env := map[string]string{
        "RABBITMQ_DEFAULT_USER": config.DefaultUser,
        "RABBITMQ_DEFAULT_PASS": config.DefaultPass,
    }

    compose := &ComposeService{
        Image:       "rabbitmq:" + SanitizeDockerVersion(version),
        Ports:       []string{port + ":5672", mgmtPort + ":15672"},
        Environment: env,
        Volumes:     []string{"rabbitmq_data_" + node.ID + ":/var/lib/rabbitmq"},
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

    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "registry": "public.ecr.aws",
    }

    helm["auth"] = map[string]interface{}{
        "username": config.DefaultUser,
        "password": config.DefaultPass,
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

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                // Ensure predictable service names
                helm["fullnameOverride"] = fmt.Sprintf("rabbitmq-%s", node.ID[:4])
                serviceName := fmt.Sprintf("rabbitmq-%s", node.ID[:4])

                helm["metrics"] = map[string]interface{}{
                    "enabled": true,
                    "plugins": "rabbitmq_prometheus",
                    "serviceMonitor": map[string]interface{}{
                        // "enabled" is deprecated, using specific endpoints
                        "default": map[string]interface{}{
                            "enabled": true, 
                            "interval": "30s",
                        },
                        "labels": map[string]interface{}{
                             "release": "devops-canvas-chart",
                        },
                    },
                    "prometheusRule": map[string]interface{}{
                        "enabled": true,
                        "additionalLabels": map[string]interface{}{ // Key is additionalLabels
                             "release": "devops-canvas-chart",
                        },
                        "rules": []map[string]interface{}{
                            {
                                "alert": "RabbitMQDown",
                                "expr": fmt.Sprintf(`rabbitmq_up{service="%s"} == 0`, serviceName),
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "RabbitMQ instance {{ $labels.instance }} down",
                                    "description": "RabbitMQ has been down for more than 1 minute.",
                                },
                            },
                            {
                                "alert": "ClusterDown",
                                "expr": fmt.Sprintf(`sum(rabbitmq_running{service="%s"}) < 1`, serviceName), // Assuming single replica for now
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Cluster down (instance {{ $labels.instance }})",
                                    "description": "Less than 1 node running in RabbitMQ cluster",
                                },
                            },
                            {
                                "alert": "ClusterPartition",
                                "expr": fmt.Sprintf(`rabbitmq_partitions{service="%s"} > 0`, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Cluster partition (instance {{ $labels.instance }})",
                                    "description": "Cluster partition detected",
                                },
                            },
                            {
                                "alert": "OutOfMemory",
                                "expr": fmt.Sprintf(`rabbitmq_node_mem_used{service="%s"} / rabbitmq_node_mem_limit{service="%s"} * 100 > 90`, serviceName, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "warning",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Out of memory (instance {{ $labels.instance }})",
                                    "description": "Memory available for RabbitMQ is low (< 10%)",
                                },
                            },
                            {
                                "alert": "TooManyConnections",
                                "expr": fmt.Sprintf(`rabbitmq_connectionsTotal{service="%s"} > 1000`, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "warning",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Too many connections (instance {{ $labels.instance }})",
                                    "description": "RabbitMQ instance has too many connections (> 1000)",
                                },
                            },
                        },
                    },
                }

                break 
            }
        }
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                // Ensure predictable service names
                helm["fullnameOverride"] = fmt.Sprintf("rabbitmq-%s", node.ID[:4])
                serviceName := fmt.Sprintf("rabbitmq-%s", node.ID[:4])

                helm["metrics"] = map[string]interface{}{
                    "enabled": true,
                    "plugins": "rabbitmq_prometheus",
                    "serviceMonitor": map[string]interface{}{
                        // "enabled" is deprecated, using specific endpoints
                        "default": map[string]interface{}{
                            "enabled": true, 
                            "interval": "30s",
                        },
                        "labels": map[string]interface{}{
                             "release": "devops-canvas-chart",
                        },
                    },
                    "prometheusRule": map[string]interface{}{
                        "enabled": true,
                        "additionalLabels": map[string]interface{}{ // Key is additionalLabels
                             "release": "devops-canvas-chart",
                        },
                        "rules": []map[string]interface{}{
                            {
                                "alert": "RabbitMQDown",
                                "expr": fmt.Sprintf(`rabbitmq_up{service="%s"} == 0`, serviceName),
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "RabbitMQ instance {{ $labels.instance }} down",
                                    "description": "RabbitMQ has been down for more than 1 minute.",
                                },
                            },
                            {
                                "alert": "ClusterDown",
                                "expr": fmt.Sprintf(`sum(rabbitmq_running{service="%s"}) < 1`, serviceName), // Assuming single replica for now
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Cluster down (instance {{ $labels.instance }})",
                                    "description": "Less than 1 node running in RabbitMQ cluster",
                                },
                            },
                            {
                                "alert": "ClusterPartition",
                                "expr": fmt.Sprintf(`rabbitmq_partitions{service="%s"} > 0`, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Cluster partition (instance {{ $labels.instance }})",
                                    "description": "Cluster partition detected",
                                },
                            },
                            {
                                "alert": "OutOfMemory",
                                "expr": fmt.Sprintf(`rabbitmq_node_mem_used{service="%s"} / rabbitmq_node_mem_limit{service="%s"} * 100 > 90`, serviceName, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "warning",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Out of memory (instance {{ $labels.instance }})",
                                    "description": "Memory available for RabbitMQ is low (< 10%)",
                                },
                            },
                            {
                                "alert": "TooManyConnections",
                                "expr": fmt.Sprintf(`rabbitmq_connectionsTotal{service="%s"} > 1000`, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "warning",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Too many connections (instance {{ $labels.instance }})",
                                    "description": "RabbitMQ instance has too many connections (> 1000)",
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
