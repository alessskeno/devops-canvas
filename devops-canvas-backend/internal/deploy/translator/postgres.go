package translator

import (
	"encoding/json"
	"fmt"
	"strings"

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

	// Default values — normalize version to a safe string (trim, default)
	version := strings.TrimSpace(config.Version)
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

	// Volume mount: 18+ images require a single mount at /var/lib/postgresql (not .../data).
	// See https://github.com/docker-library/postgres/pull/1259 and https://github.com/docker-library/postgres/issues/37
	mountPath := DefaultDataVolumeByType["postgres"]
	if mountPath == "" {
		mountPath = "/var/lib/postgresql/data"
	}
	volumeName := "postgres_data_" + node.ID

	// Effective tag: config version, or image override tag (so layout matches the image we actually run)
	effectiveTag := version
	var uConfig UniversalNodeConfig
	_ = json.Unmarshal(node.Data, &uConfig)
	if uConfig.Image != "" {
		t := strings.TrimSpace(uConfig.Tag)
		if t != "" {
			effectiveTag = t
		} else {
			effectiveTag = "latest"
		}
	}

	usePG18Layout := false
	if v, err := semver.NewVersion(effectiveTag); err == nil {
		if v.Major() >= 18 {
			usePG18Layout = true
			volumeName = fmt.Sprintf("postgres_data_v%d_%s", v.Major(), node.ID)
		}
	} else {
		// "latest" or string starting with "18" → use 18+ layout (single mount at /var/lib/postgresql)
		prefix18 := len(effectiveTag) >= 2 && effectiveTag[:2] == "18"
		if strings.EqualFold(effectiveTag, "latest") || prefix18 {
			usePG18Layout = true
			volumeName = "postgres_data_v18_" + node.ID
		}
	}
	if usePG18Layout {
		mountPath = "/var/lib/postgresql"
	}

	volumes := []string{volumeName + ":" + mountPath}

	// Handle pg_hba.conf — use Compose top-level inline `configs:` + service `configs:` mounts.
	// Bind-mounting ./configs/... breaks when the API runs in Docker: files live in the API
	// container but the daemon resolves bind sources on the host, often creating a directory.
	var rawData map[string]interface{}
	_ = json.Unmarshal(node.Data, &rawData)

	var composeInline map[string]string

	if pgHbaNodeID, ok := rawData["pg_hba"].(string); ok && pgHbaNodeID != "" {
		fileNode, err := ctx.FindNodeByID(pgHbaNodeID)
		if err != nil {
			return nil, fmt.Errorf("postgres: pg_hba file node not found: %w", err)
		}
		var fileConfig ConfigFile
		if err := json.Unmarshal(fileNode.Data, &fileConfig); err != nil {
			return nil, fmt.Errorf("postgres: invalid file node for pg_hba: %w", err)
		}
		content := strings.TrimSpace(fileConfig.Content)
		if content == "" {
			return nil, fmt.Errorf("postgres: linked pg_hba file node has no content")
		}
		// Stable unique key for top-level configs (hyphens OK in YAML keys).
		cfgName := fmt.Sprintf("canvas_pg_hba_%s", strings.ReplaceAll(node.ID, "-", "_"))
		composeInline = map[string]string{cfgName: content + "\n"}
	}

	compose := &ComposeService{
		Image:         "postgres:" + SanitizeDockerVersion(version),
		Ports:         []string{port + ":5432"},
		Environment:   env,
		Volumes:       volumes,
		Command:       command,
		Restart:       "always",
	}
	if composeInline != nil {
		cfgName := fmt.Sprintf("canvas_pg_hba_%s", strings.ReplaceAll(node.ID, "-", "_"))
		compose.Configs = []ComposeConfigRef{{Source: cfgName, Target: "/etc/postgresql/pg_hba.conf"}}
		compose.Command = append(compose.Command, "-c", "hba_file=/etc/postgresql/pg_hba.conf")
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
		DockerCompose:       compose,
		ComposeConfigInline: composeInline,
	}, nil
}
