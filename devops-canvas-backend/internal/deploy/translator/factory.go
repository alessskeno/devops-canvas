package translator

import (
    "fmt"
)

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
    case "monitoring_stack":
        return &MonitoringStackTranslator{}, nil
    case "kind-cluster":
        return &KindTranslator{}, nil
	default:
		return nil, fmt.Errorf("unsupported component type: %s", componentType)
	}
}
