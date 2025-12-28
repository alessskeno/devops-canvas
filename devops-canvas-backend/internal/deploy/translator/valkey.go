package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

// ValkeyConfig reuses Redis logic mostly as it's a fork
type ValkeyConfig struct {
    Version         string `json:"version"`
    Port            any    `json:"port"`
    Password        string `json:"requirepass,omitempty"`
    MaxMemory       string `json:"maxmemory,omitempty"`
    MaxMemoryPolicy string `json:"maxmemory-policy,omitempty"`
    AppendOnly      string `json:"appendonly,omitempty"`
}

type ValkeyTranslator struct{}

func (t *ValkeyTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config ValkeyConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse valkey config: %v", err)
    }

    version := config.Version
    if version == "" {
        version = "latest"
    }
    
    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "6379"
    }

    env := map[string]string{}
    command := []string{"valkey-server"}
    
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
        Image:       "valkey/valkey:" + version,
        Ports:       []string{port + ":6379"},
        Environment: env,
        Volumes:     []string{"valkey_data_" + node.ID + ":/data"},
        Command:     command,
        Restart:     "always",
    }
    
    // Helm Values (Reuse Redis or Generic)
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    helm["auth"] = map[string]interface{}{
        "enabled":  config.Password != "",
        "password": config.Password,
    }
    helm["master"] = map[string]interface{}{
        "service": map[string]interface{}{
            "ports": map[string]interface{}{
                "valkey": config.Port,
            },
        },
        "persistence": map[string]interface{}{
            "enabled": true,
        },
    }
    
    // Valkey (Bitnami) uses commonConfiguration similar to Redis for custom valkey.conf
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
