package translator

import (
	"encoding/json"
	"fmt"
	"strings"

	"devops-canvas-backend/internal/models"

	"gopkg.in/yaml.v3"
)

// Helper to get linked file content from a connected file node
func getFileContent(ctx TranslationContext, nodeID string) (string, error) {
	if nodeID == "" {
		return "", nil
	}
	node, err := ctx.FindNodeByID(nodeID)
	if err != nil || node == nil {
		return "", nil
	}
	var fileConfig struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal(node.Data, &fileConfig); err != nil {
		return "", err
	}
	return fileConfig.Content, nil
}

// ===== Prometheus Translator =====

type PrometheusConfig struct {
	CommonConfig
	Port               any    `json:"port"`
	Retention          string `json:"retention"`
	ScrapeInterval     string `json:"scrape_interval"`
	ScrapeTimeout      string `json:"scrape_timeout"`
	EvaluationInterval string `json:"evaluation_interval"`
	ScrapeConfigs      string `json:"scrape_configs"` // NodeID of file node
	RulesFiles         string `json:"rules_files"`    // NodeID of file node
}

type PrometheusTranslator struct{}

func (t *PrometheusTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var config PrometheusConfig
	_ = json.Unmarshal(node.Data, &config)

	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
	}

	if config.Retention == "" {
		config.Retention = "15d"
	}
	if config.ScrapeInterval == "" {
		config.ScrapeInterval = "15s"
	}
	if config.ScrapeTimeout == "" {
		config.ScrapeTimeout = "10s"
	}
	if config.EvaluationInterval == "" {
		config.EvaluationInterval = "15s"
	}

	scrapeConfigContent, _ := getFileContent(ctx, config.ScrapeConfigs)
	rulesContent, _ := getFileContent(ctx, config.RulesFiles)

	configs := make(map[string]string)

	// Generate prometheus.yml
	promConfig := map[string]interface{}{
		"global": map[string]interface{}{
			"scrape_interval":     config.ScrapeInterval,
			"scrape_timeout":      config.ScrapeTimeout,
			"evaluation_interval": config.EvaluationInterval,
		},
		"scrape_configs": []interface{}{},
	}

	// Parse user-provided scrape configs
	if scrapeConfigContent != "" {
		decoder := yaml.NewDecoder(strings.NewReader(scrapeConfigContent))
		for {
			var docNode yaml.Node
			if err := decoder.Decode(&docNode); err != nil {
				break
			}
			docBytes, _ := yaml.Marshal(&docNode)

			var userScrapes []interface{}
			var parseErr error = fmt.Errorf("initial")

			if err := yaml.Unmarshal(docBytes, &userScrapes); err == nil && len(userScrapes) > 0 {
				if _, ok := userScrapes[0].(map[string]interface{}); ok {
					parseErr = nil
				}
			}

			if parseErr != nil {
				var mapConfig map[string]interface{}
				if errMap := yaml.Unmarshal(docBytes, &mapConfig); errMap == nil {
					if kind, ok := mapConfig["kind"].(string); ok && kind == "ServiceMonitor" {
						continue
					}
					if val, ok := mapConfig["scrape_configs"]; ok {
						if asList, ok := val.([]interface{}); ok {
							userScrapes = asList
							parseErr = nil
						}
					} else if _, isJob := mapConfig["job_name"]; isJob {
						userScrapes = append(userScrapes, mapConfig)
						parseErr = nil
					}
				}
			}

			if parseErr == nil && len(userScrapes) > 0 {
				currentScrapes := promConfig["scrape_configs"].([]interface{})
				promConfig["scrape_configs"] = append(currentScrapes, userScrapes...)
			}
		}
	}

	// Handle rules
	if rulesContent != "" {
		var dockerRulesContent string
		var header struct {
			Kind string      `yaml:"kind"`
			Spec interface{} `yaml:"spec"`
		}
		if err := yaml.Unmarshal([]byte(rulesContent), &header); err == nil && header.Kind == "PrometheusRule" {
			specBytes, _ := yaml.Marshal(header.Spec)
			dockerRulesContent = string(specBytes)
		} else {
			dockerRulesContent = rulesContent
		}
		promConfig["rule_files"] = []string{"/etc/prometheus/rules.yml"}
		configs[fmt.Sprintf("rules-%s.yml", node.ID[:4])] = dockerRulesContent
	}

	promConfigBytes, _ := yaml.Marshal(promConfig)
	configs[fmt.Sprintf("prometheus-%s.yml", node.ID[:4])] = string(promConfigBytes)

	// Prepare deploy config
	deployConfig := buildDeployConfig(config.Resources)

	vols := DataVolumeSlice("prometheus", node.ID)
	vols = append(vols, fmt.Sprintf("./configs/prometheus-%s.yml:/etc/prometheus/prometheus.yml", node.ID[:4]))
	svc := ComposeService{
		Image: "prom/prometheus:latest",
		Ports: []string{fmt.Sprintf("%v:9090", defaultPort(config.Port, 9090))},
		Volumes: vols,
		Command: []string{
			"--config.file=/etc/prometheus/prometheus.yml",
			"--storage.tsdb.path=/prometheus",
			"--storage.tsdb.retention.time=" + config.Retention,
		},
		Restart: "always",
		Deploy:  deployConfig,
	}

	if rulesContent != "" {
		svc.Volumes = append(svc.Volumes,
			fmt.Sprintf("./configs/rules-%s.yml:/etc/prometheus/rules.yml", node.ID[:4]))
	}

	return &GeneratedManifests{
		DockerCompose: &svc,
		Configs:       configs,
	}, nil
}

// ===== Grafana Translator =====

type GrafanaConfig struct {
	CommonConfig
	Port          any    `json:"port"`
	AdminUser     string `json:"admin_user"`
	AdminPassword string `json:"admin_password"`
	AllowSignUp   bool   `json:"allow_sign_up"`
}

type GrafanaTranslator struct{}

func (t *GrafanaTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var config GrafanaConfig
	_ = json.Unmarshal(node.Data, &config)

	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
	}

	if config.AdminUser == "" {
		config.AdminUser = "admin"
	}
	if config.AdminPassword == "" {
		config.AdminPassword = "admin"
	}

	deployConfig := buildDeployConfig(config.Resources)

	svc := ComposeService{
		Image: "grafana/grafana:latest",
		Ports: []string{fmt.Sprintf("%v:3000", defaultPort(config.Port, 3000))},
		Environment: map[string]string{
			"GF_SECURITY_ADMIN_USER":     config.AdminUser,
			"GF_SECURITY_ADMIN_PASSWORD": config.AdminPassword,
			"GF_USERS_ALLOW_SIGN_UP":     fmt.Sprintf("%v", config.AllowSignUp),
		},
		Volumes: DataVolumeSlice("grafana", node.ID),
		Restart: "always",
		Deploy:  deployConfig,
	}

	return &GeneratedManifests{
		DockerCompose: &svc,
	}, nil
}

// ===== Alertmanager Translator =====

type AlertmanagerConfig struct {
	CommonConfig
	Port                   any    `json:"port"`
	Retention              string `json:"retention"`
	AlertmanagerDestConfig struct {
		Destination string `json:"destination"`
		Discord     struct {
			WebhookURL string `json:"webhook_url"`
		} `json:"discord"`
		Telegram struct {
			BotToken string `json:"bot_token"`
			ChatID   string `json:"chat_id"`
		} `json:"telegram"`
	} `json:"alertmanagerConfig"`
}

type AlertmanagerTranslator struct{}

func (t *AlertmanagerTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var config AlertmanagerConfig
	_ = json.Unmarshal(node.Data, &config)

	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
	}

	if config.Retention == "" {
		config.Retention = "120h"
	}

	configs := make(map[string]string)

	// Generate alertmanager config
	alertmanagerConfigContent := generateAlertmanagerConfigStandalone(config)
	configs[fmt.Sprintf("alertmanager-%s.yml", node.ID[:4])] = alertmanagerConfigContent

	deployConfig := buildDeployConfig(config.Resources)

	vols := DataVolumeSlice("alertmanager", node.ID)
	vols = append(vols, fmt.Sprintf("./configs/alertmanager-%s.yml:/etc/alertmanager/config.yml", node.ID[:4]))
	svc := ComposeService{
		Image: "prom/alertmanager:latest",
		Ports: []string{fmt.Sprintf("%v:9093", defaultPort(config.Port, 9093))},
		Volumes: vols,
		Command: []string{"--storage.path=/alertmanager", "--config.file=/etc/alertmanager/config.yml"},
		Restart: "always",
		Deploy:  deployConfig,
	}

	return &GeneratedManifests{
		DockerCompose: &svc,
		Configs:       configs,
	}, nil
}

func generateAlertmanagerConfigStandalone(config AlertmanagerConfig) string {
	dest := config.AlertmanagerDestConfig

	if dest.Destination == "discord" && dest.Discord.WebhookURL != "" {
		return fmt.Sprintf(`global:
  resolve_timeout: 5m
route:
  receiver: discord
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h
receivers:
  - name: discord
    discord_configs:
      - webhook_url: '%s'
`, dest.Discord.WebhookURL)
	}

	if dest.Destination == "telegram" && dest.Telegram.BotToken != "" {
		return fmt.Sprintf(`global:
  resolve_timeout: 5m
route:
  receiver: telegram
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h
receivers:
  - name: telegram
    telegram_configs:
      - bot_token: '%s'
        chat_id: %s
        send_resolved: true
`, dest.Telegram.BotToken, dest.Telegram.ChatID)
	}

	return `global:
  resolve_timeout: 5m
route:
  receiver: default
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h
receivers:
  - name: default
`
}

// ===== Helpers =====

func buildDeployConfig(resources *ResourceConfig) *DeployConfig {
	if resources == nil {
		return nil
	}
	deployConfig := &DeployConfig{
		Resources: &ResourcesBlock{Limits: ResourceLimits{}},
	}
	hasLimit := false
	if resources.CPU > 0 {
		deployConfig.Resources.Limits.CPUs = fmt.Sprintf("%.1f", resources.CPU)
		hasLimit = true
	}
	if resources.Memory != "" && resources.Memory != "0" {
		deployConfig.Resources.Limits.Memory = SanitizeMemoryForCompose(resources.Memory)
		hasLimit = true
	}
	if !hasLimit {
		return nil
	}
	return deployConfig
}
