package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
)

type KafkaConfig struct {
	CommonConfig             // Embed Enabled and Resources
	Brokers           any    `json:"brokers,omitempty"`
	RetentionMs       any    `json:"retention_ms,omitempty"`
	RetentionBytes    string `json:"retention_bytes,omitempty"`
	CleanupPolicy     string `json:"cleanup_policy,omitempty"`
	ReplicationFactor any    `json:"replication_factor,omitempty"`
	Partitions        any    `json:"partitions,omitempty"`
	Version           string `json:"version"`
}

type KafkaTranslator struct{}

func (t *KafkaTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var config KafkaConfig
	if err := json.Unmarshal(node.Data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse kafka config: %v", err)
	}

	// Check Enabled
	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
	}

	version := config.Version
	if version == "" {
		version = "latest"
	}

	// For Kafka Single Node in Docker Compose using official Apache Kafka image (KRaft mode)
	env := map[string]string{
		"KAFKA_NODE_ID":                                  "1",
		"KAFKA_PROCESS_ROLES":                            "controller,broker",
		"KAFKA_LISTENERS":                                "PLAINTEXT://:9092,CONTROLLER://:9093",
		"KAFKA_ADVERTISED_LISTENERS":                     "PLAINTEXT://localhost:9092",
		"KAFKA_LISTENER_SECURITY_PROTOCOL_MAP":           "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT",
		"KAFKA_CONTROLLER_QUORUM_VOTERS":                 "1@localhost:9093",
		"KAFKA_CONTROLLER_LISTENER_NAMES":                "CONTROLLER",
		"KAFKA_INTER_BROKER_LISTENER_NAME":               "PLAINTEXT",
		"KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR":         "1",
		"KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR": "1",
		"KAFKA_TRANSACTION_STATE_LOG_MIN_ISR":            "1",
		"CLUSTER_ID":                                     "devops-canvas-kafka-cluster",
	}

	if config.RetentionMs != nil {
		env["KAFKA_LOG_RETENTION_MS"] = formatKafkaInt(config.RetentionMs)
	}
	if config.RetentionBytes != "" && config.RetentionBytes != "-1" {
		env["KAFKA_LOG_RETENTION_BYTES"] = config.RetentionBytes
	}
	if config.CleanupPolicy != "" {
		env["KAFKA_LOG_CLEANUP_POLICY"] = config.CleanupPolicy
	}
	if config.Partitions != nil {
		env["KAFKA_NUM_PARTITIONS"] = formatKafkaInt(config.Partitions)
	}

	compose := &ComposeService{
		Image:       "apache/kafka:" + version,
		Ports:       []string{"9092:9092"},
		Environment: env,
		Volumes:     DataVolumeSlice("kafka", node.ID),
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

// formatKafkaInt converts a JSON number (which Go unmarshals as float64) to a
// plain integer string. This avoids scientific notation like "6.048e+08" which
// Kafka rejects for config values that expect LONG integers.
func formatKafkaInt(v any) string {
	switch n := v.(type) {
	case float64:
		return fmt.Sprintf("%.0f", n)
	case int:
		return fmt.Sprintf("%d", n)
	case int64:
		return fmt.Sprintf("%d", n)
	default:
		return fmt.Sprintf("%v", v)
	}
}
