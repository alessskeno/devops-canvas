package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type KafkaConfig struct {
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

    version := config.Version
    if version == "" {
        version = "latest"
    }

    // For Kafka Single Node in Docker Compose
    // Note: Kafka usually needs Zookeeper or Kraft. Minimal setup using bitnami/kafka (Kraft mode)
    env := map[string]string{
        "KAFKA_CFG_NODE_ID": "1",
        "KAFKA_CFG_PROCESS_ROLES": "controller,broker",
        "KAFKA_CFG_LISTENERS": "PLAINTEXT://:9092,CONTROLLER://:9093",
        "KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP": "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT",
        "KAFKA_CFG_CONTROLLER_QUORUM_VOTERS": "1@127.0.0.1:9093",
        "KAFKA_CFG_CONTROLLER_LISTENER_NAMES": "CONTROLLER",
    }
    
    if config.RetentionMs != nil {
        env["KAFKA_CFG_LOG_RETENTION_MS"] = fmt.Sprintf("%v", config.RetentionMs)
    }
    if config.RetentionBytes != "" && config.RetentionBytes != "-1" {
        env["KAFKA_CFG_LOG_RETENTION_BYTES"] = config.RetentionBytes
    }
    if config.CleanupPolicy != "" {
        env["KAFKA_CFG_LOG_CLEANUP_POLICY"] = config.CleanupPolicy
    }
    if config.Partitions != nil {
        env["KAFKA_CFG_NUM_PARTITIONS"] = fmt.Sprintf("%v", config.Partitions)
    }

    compose := &ComposeService{
        Image:       "bitnami/kafka:" + version,
        Ports:       []string{"9092:9092"}, // Standard port
        Environment: env,
        Volumes:     []string{"kafka_data_" + node.ID + ":/bitnami/kafka"},
        Restart:     "always",
    }

    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    // Bitnami Kafka Chart Values
    helm["deleteTopicEnable"] = true
    if config.RetentionMs != nil {
        helm["logRetentionHours"] = -1 // Use MS
        helm["logRetentionMs"] = config.RetentionMs
    }

    // --- Monitoring Integration ---
    if ctx.FindConnectedNodes != nil {
        connected, _ := ctx.FindConnectedNodes(node.ID)
        for _, neighbor := range connected {
            if neighbor.Type == "monitoring_stack" {
                // Connected to monitoring stack!
                
                helm["fullnameOverride"] = fmt.Sprintf("kafka-%s", node.ID[:4])
                // Service name for Kafka usually involves -headless or just service depending on access
                // Bitnami JMX exporter typically runs on endpoints.
                serviceName := fmt.Sprintf("kafka-%s-jmx-metrics", node.ID[:4]) // Usually exposed via headless or dedicated metrics svc 
                // Actually, let's use the generic service name and rely on label selectors in ServiceMonitor which Bitnami handles nicely.
                serviceName = fmt.Sprintf("kafka-%s", node.ID[:4])

                helm["metrics"] = map[string]interface{}{
                    "jmx": map[string]interface{}{
                        "enabled": true,
                    },
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
                                "alert": "KafkaDown",
                                "expr": fmt.Sprintf(`kafka_up{service="%s"} == 0`, serviceName), // JMX exporter metric
                                "for": "1m",
                                "labels": map[string]interface{}{
                                    "severity": "critical",
                                },
                                "annotations": map[string]interface{}{
                                    "summary": "Kafka instance {{ $labels.instance }} down",
                                    "description": "Kafka has been down for more than 1 minute.",
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
