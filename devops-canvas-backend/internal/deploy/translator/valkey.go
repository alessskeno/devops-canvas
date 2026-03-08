package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
)

// ValkeyConfig reuses Redis logic mostly as it's a fork
type ValkeyConfig struct {
	CommonConfig
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

	// Check Enabled
	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
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
		Image:       "valkey/valkey:" + SanitizeDockerVersion(version),
		Ports:       []string{port + ":6379"},
		Environment: env,
		Volumes:     DataVolumeSlice("valkey", node.ID),
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
		if !hasLimit {
			compose.Deploy = nil
		}
	}

	return &GeneratedManifests{
		DockerCompose: compose,
	}, nil
}
