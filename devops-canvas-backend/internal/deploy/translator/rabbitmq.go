package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type RabbitMQConfig struct {
    Port            any    `json:"port"`
    ManagementPort  any    `json:"management_port"`
    DefaultUser     string `json:"default_user"`
    DefaultPass     string `json:"default_pass"`
    Version         string `json:"version"`
}

type RabbitMQTranslator struct{}

func (t *RabbitMQTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config RabbitMQConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse rabbitmq config: %v", err)
    }

    version := config.Version
    if version == "" {
        version = "3-management" // defaulting to management tag for UI
    }

    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "5672"
    }
    
    mgmtPort := fmt.Sprintf("%v", config.ManagementPort)
    if mgmtPort == "" || mgmtPort == "<nil>" {
        mgmtPort = "15672"
    }

    env := map[string]string{
        "RABBITMQ_DEFAULT_USER": config.DefaultUser,
        "RABBITMQ_DEFAULT_PASS": config.DefaultPass,
    }

    compose := &ComposeService{
        Image:       "rabbitmq:" + version,
        Ports:       []string{port + ":5672", mgmtPort + ":15672"},
        Environment: env,
        Volumes:     []string{"rabbitmq_data_" + node.ID + ":/var/lib/rabbitmq"},
        Restart:     "always",
    }

    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    helm["auth"] = map[string]interface{}{
        "username": config.DefaultUser,
        "password": config.DefaultPass,
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
    }, nil
}
