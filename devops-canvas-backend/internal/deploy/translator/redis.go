package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
)

type RedisConfig struct {
	CommonConfig           // Embed Enabled and Resources
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

	dataVol := DataVolumeSpec("redis", node.ID)
	volumes := []string{}
	if dataVol != "" {
		volumes = append(volumes, dataVol)
	}
	compose := &ComposeService{
		Image:       "redis:" + SanitizeDockerVersion(version),
		Ports:       []string{port + ":6379"},
		Environment: env,
		Volumes:     volumes,
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
