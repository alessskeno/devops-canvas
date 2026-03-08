package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type RabbitMQConfig struct {
	CommonConfig
	Port           any    `json:"port"`
	ManagementPort any    `json:"management_port"`
	DefaultUser    string `json:"default_user"`
	DefaultPass    string `json:"default_pass"`
	Version        string `json:"version"`
	ChannelMax     any    `json:"channel_max"`
	MaxLength      any    `json:"max_length"`
	MaxLengthBytes string `json:"max_length_bytes"`
	MessageTTL     any    `json:"message_ttl"`
}

type RabbitMQTranslator struct{}

func (t *RabbitMQTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var config RabbitMQConfig
	if err := json.Unmarshal(node.Data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse rabbitmq config: %v", err)
	}

	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
	}

	version := config.Version
	if version == "" {
		version = "3-management"
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

	volumes := DataVolumeSlice("rabbitmq", node.ID)
	generatedConfigs := make(map[string]string)

	// rabbitmq.conf for channel_max + load_definitions directive
	var confLines []string
	channelMax := anyToIntStr(config.ChannelMax)
	if channelMax != "" && channelMax != "0" {
		confLines = append(confLines, "channel_max = "+channelMax)
	}

	// Queue-level policies via definitions.json (max-length, max-length-bytes, message-ttl)
	policyDef := make(map[string]interface{})
	if ml := anyToIntStr(config.MaxLength); ml != "" && ml != "0" {
		if n, err := strconv.Atoi(ml); err == nil {
			policyDef["max-length"] = n
		}
	}
	if config.MaxLengthBytes != "" && config.MaxLengthBytes != "0" {
		if n, err := strconv.Atoi(config.MaxLengthBytes); err == nil {
			policyDef["max-length-bytes"] = n
		}
	}
	if mt := anyToIntStr(config.MessageTTL); mt != "" && mt != "0" {
		if n, err := strconv.Atoi(mt); err == nil {
			policyDef["message-ttl"] = n
		}
	}

	if len(policyDef) > 0 {
		definitions := map[string]interface{}{
			"policies": []map[string]interface{}{
				{
					"vhost":      "/",
					"name":       "devops-canvas-default",
					"pattern":    ".*",
					"apply-to":   "queues",
					"definition": policyDef,
				},
			},
		}
		defJSON, _ := json.MarshalIndent(definitions, "", "  ")
		defFileName := fmt.Sprintf("rabbitmq-definitions-%s.json", node.ID)
		generatedConfigs[defFileName] = string(defJSON)
		volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/rabbitmq/definitions.json", defFileName))
		confLines = append(confLines, "load_definitions = /etc/rabbitmq/definitions.json")
	}

	if len(confLines) > 0 {
		confFileName := fmt.Sprintf("rabbitmq-%s.conf", node.ID)
		generatedConfigs[confFileName] = strings.Join(confLines, "\n") + "\n"
		volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/rabbitmq/rabbitmq.conf", confFileName))
	}

	compose := &ComposeService{
		Image:       "rabbitmq:" + SanitizeDockerVersion(version),
		Ports:       []string{port + ":5672", mgmtPort + ":15672"},
		Environment: env,
		Volumes:     volumes,
		Restart:     "always",
	}

	applyResources(config.Resources, compose)

	return &GeneratedManifests{
		DockerCompose: compose,
		Configs:       generatedConfigs,
	}, nil
}

func anyToIntStr(v any) string {
	switch n := v.(type) {
	case float64:
		return fmt.Sprintf("%.0f", n)
	case int:
		return fmt.Sprintf("%d", n)
	case int64:
		return fmt.Sprintf("%d", n)
	case string:
		return n
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}
