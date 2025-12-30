package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type RedisConfig struct {
    CommonConfig                 // Embed Enabled and Resources
    Version         string `json:"version"`
    Port            any    `json:"port"`
    Password        string `json:"requirepass,omitempty"` // Key is "requirepass" in frontend
    MaxMemory       string `json:"maxmemory,omitempty"`
    MaxMemoryPolicy string `json:"maxmemory-policy,omitempty"`
    AppendOnly      string `json:"appendonly,omitempty"` // "yes" or "no"
}

type RedisTranslator struct{}

func (t *RedisTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config RedisConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse redis config: %v", err)
    }

    // Check Enabled
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }

    // Default values
    version := config.Version
    if version == "" {
        version = "7.0"
    }
    
    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "6379"
    }

    // Docker Compose
    env := map[string]string{}
    command := []string{"redis-server"}
    
    if config.Password != "" {
        command = append(command, "--requirepass", config.Password)
    }
    
    if config.AppendOnly == "yes" {
        command = append(command, "--appendonly", "yes")
    }

    if config.MaxMemory != "" {
        command = append(command, "--maxmemory", config.MaxMemory)
    }
    
    if config.MaxMemoryPolicy != "" {
        command = append(command, "--maxmemory-policy", config.MaxMemoryPolicy)
    }

    compose := &ComposeService{
        Image:       "redis:" + version,
        Ports:       []string{port + ":6379"},
        Environment: env,
        Volumes:     []string{"redis_data_" + node.ID + ":/data"},
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
            compose.Deploy.Resources.Limits.Memory = config.Resources.Memory
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
        "password": config.Password,
        "enabled":  config.Password != "",
    }
    helm["master"] = map[string]interface{}{
        "service": map[string]interface{}{
            "ports": map[string]interface{}{
                "redis": config.Port,
            },
        },
        "persistence": map[string]interface{}{
            "enabled": true,
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
            helm["master"].(map[string]interface{})["resources"] = resources
        }
    }
    
    // Add extra flags for Helm via command arguments if chart supports it, or config map
    // Bitnami redis uses commonConfiguration for redis.conf
    extraConfig := ""
    if config.MaxMemory != "" {
        extraConfig += fmt.Sprintf("maxmemory %s\n", config.MaxMemory)
    }
    if config.MaxMemoryPolicy != "" {
        extraConfig += fmt.Sprintf("maxmemory-policy %s\n", config.MaxMemoryPolicy)
    }
    if config.AppendOnly != "" {
        extraConfig += fmt.Sprintf("appendonly %s\n", config.AppendOnly)
    }
    
    if extraConfig != "" {
        helm["commonConfiguration"] = extraConfig
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                // Ensure predictable service names
                helm["fullnameOverride"] = fmt.Sprintf("redis-%s", node.ID[:4])
                serviceName := fmt.Sprintf("redis-%s-master", node.ID[:4]) // Bitnami redis usually uses -master suffix for standalone/primary

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
                                "alert": "RedisDown",
                                "expr": fmt.Sprintf(`redis_up{service="%s"} == 0`, serviceName),
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Redis instance {{ $labels.instance }} down",
                                    "description": "Redis has been down for more than 1 minute.",
                                },
                            },
                            {
                                "alert": "RedisMemoryHigh",
                                // Simplified example, real query depends on maxmemory
                                "expr": fmt.Sprintf(`redis_memory_used_bytes{service="%s"} > 0.9 * redis_memory_max_bytes{service="%s"}`, serviceName, serviceName),
                                "for": "5m",
                                "labels": map[string]interface{}{
                                    "severity": "warning",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Redis memory usage high",
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
