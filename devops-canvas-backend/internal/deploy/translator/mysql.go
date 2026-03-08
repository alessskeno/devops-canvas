package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
)

type MySQLConfig struct {
	CommonConfig              // Embed Enabled and Resources
	Version            string `json:"version"`
	Port               any    `json:"port"` // Can be string or int
	RootPassword       string `json:"root_password,omitempty"`
	DatabaseName       string `json:"database,omitempty"` // Key is "database" in frontend
	User               string `json:"user,omitempty"`     // Optional app user (MYSQL_USER)
	Password           string `json:"password,omitempty"` // Optional app user password (MYSQL_PASSWORD)
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
	if config.User != "" {
		env["MYSQL_USER"] = config.User
	}
	if config.Password != "" {
		env["MYSQL_PASSWORD"] = config.Password
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

	dataVol := DataVolumeSpec("mysql", node.ID)
	volumes := []string{}
	if dataVol != "" {
		volumes = append(volumes, dataVol)
	}
	compose := &ComposeService{
		Image:       "mysql:" + SanitizeDockerVersion(version),
		Ports:       []string{port + ":3306"},
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
