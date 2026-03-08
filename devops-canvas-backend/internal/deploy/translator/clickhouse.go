package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
)

type ClickHouseConfig struct {
	CommonConfig
	Version string `json:"version"`
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

	dataVol := DataVolumeSpec("clickhouse", node.ID)
	volumes := []string{}
	if dataVol != "" {
		volumes = append(volumes, dataVol)
	}
	compose := &ComposeService{
		Image: "clickhouse/clickhouse-server:" + SanitizeDockerVersion(version),
		Ports: []string{"8123:8123", "9000:9000"},
		Environment: map[string]string{
			"CLICKHOUSE_DB": "default",
		},
		Volumes: volumes,
		Restart: "always",
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
