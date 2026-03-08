package translator

import (
	"encoding/json"
	"fmt"

	"devops-canvas-backend/internal/models"

	"github.com/Masterminds/semver/v3"
)

type PostgresConfig struct {
	CommonConfig              // Embed Enabled and Resources
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

	// Volume mount: path from central DefaultDataVolumeByType (defaults.go). Postgres 18+ overrides path and volume name.
	mountPath := DefaultDataVolumeByType["postgres"]
	if mountPath == "" {
		mountPath = "/var/lib/postgresql/data"
	}
	volumeName := "postgres_data_" + node.ID

	if v, err := semver.NewVersion(version); err == nil {
		if v.Major() >= 18 {
			mountPath = "/var/lib/postgresql"
			volumeName = fmt.Sprintf("postgres_data_v%d_%s", v.Major(), node.ID)
		}
	} else {
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

	return &GeneratedManifests{
		DockerCompose: compose,
		Configs:       generatedConfigs,
	}, nil
}
