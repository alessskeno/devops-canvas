package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type RedisConfig struct {
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

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
    }, nil
}
