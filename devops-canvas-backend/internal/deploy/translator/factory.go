package translator

// GetTranslator returns the appropriate translator for a given component type
func GetTranslator(componentType string) (ComponentTranslator, error) {
	switch componentType {
	case "mysql":
		return &MySQLTranslator{}, nil
	case "redis":
		return &RedisTranslator{}, nil
	case "postgres":
		return &PostgresTranslator{}, nil
	case "kafka":
		return &KafkaTranslator{}, nil
	case "clickhouse":
		return &ClickHouseTranslator{}, nil
	case "rabbitmq":
		return &RabbitMQTranslator{}, nil
	case "valkey":
		return &ValkeyTranslator{}, nil
	case "prometheus":
		return &PrometheusTranslator{}, nil
	case "grafana":
		return &GrafanaTranslator{}, nil
	case "alertmanager":
		return &AlertmanagerTranslator{}, nil
	case "nginx":
		return &NginxTranslator{}, nil
	case "custom-container":
		return &CustomContainerTranslator{}, nil
	default:
		// Fallback to a generic scaffold parser
		return &GenericTranslator{}, nil
	}
}
