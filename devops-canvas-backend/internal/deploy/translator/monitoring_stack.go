package translator

import (
	"encoding/json"
	"fmt"
	"strconv"
	"devops-canvas-backend/internal/models"
	
	"gopkg.in/yaml.v3"
)

type MonitoringStackConfig struct {
	// Prometheus
	PrometheusPort               any    `json:"prometheus_port"`
	PrometheusRetention          string `json:"prometheus_retention"`
	PrometheusScrapeInterval     string `json:"prometheus_scrape_interval"`
	PrometheusScrapeTimeout      string `json:"prometheus_scrape_timeout"`
	PrometheusEvaluationInterval string `json:"prometheus_evaluation_interval"`
	PrometheusScrapeConfigs      string `json:"prometheus_scrape_configs"` // NodeID
	PrometheusRulesFiles         string `json:"prometheus_rules_files"`    // NodeID

	// Alertmanager
	AlertmanagerPort       any    `json:"alertmanager_port"`
	AlertmanagerRetention  string `json:"alertmanager_retention"`
    // Removed AlertmanagerConfigFile in favor of UI config
    AlertmanagerConfig     struct {
        Destination string `json:"destination"`
        Discord     struct {
            WebhookURL string `json:"webhook_url"`
        } `json:"discord"`
        Telegram    struct {
            BotToken string `json:"bot_token"`
            ChatID   string `json:"chat_id"`
        } `json:"telegram"`
    } `json:"alertmanagerConfig"`

	// Grafana
	GrafanaPort          any    `json:"grafana_port"`
	GrafanaAdminUser     string `json:"grafana_admin_user"`
	GrafanaAdminPassword string `json:"grafana_admin_password"`
	GrafanaAllowSignUp   bool   `json:"grafana_allow_sign_up"`
}

type MonitoringStackTranslator struct{}

// Helper to get linked file content
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

func (t *MonitoringStackTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var config MonitoringStackConfig
	_ = json.Unmarshal(node.Data, &config) // Ignore error, use zero values

	// Defaults and Normalization
	if config.PrometheusRetention == "" { config.PrometheusRetention = "15d" }
	if config.PrometheusScrapeInterval == "" { config.PrometheusScrapeInterval = "15s" }
	if config.PrometheusScrapeTimeout == "" { config.PrometheusScrapeTimeout = "10s" }
	if config.PrometheusEvaluationInterval == "" { config.PrometheusEvaluationInterval = "15s" }
	
	if config.AlertmanagerRetention == "" { config.AlertmanagerRetention = "120h" }
	
	if config.GrafanaAdminUser == "" { config.GrafanaAdminUser = "admin" }
	if config.GrafanaAdminPassword == "" { config.GrafanaAdminPassword = "admin" }

	// Resolve Linked Files
	scrapeConfigContent, _ := getFileContent(ctx, config.PrometheusScrapeConfigs)
	rulesContent, _ := getFileContent(ctx, config.PrometheusRulesFiles)
    
    // Alertmanager Config Generation
    alertmanagerConfigContent := generateAlertmanagerConfig(config)

	// --- 1. Docker Compose Generation ---
	extras := make(map[string]ComposeService)
	configs := make(map[string]string)

	// Prometheus
	// Generate prometheus.yml for Docker
	promConfig := map[string]interface{}{
		"global": map[string]interface{}{
			"scrape_interval":     config.PrometheusScrapeInterval,
			"scrape_timeout":      config.PrometheusScrapeTimeout,
			"evaluation_interval": config.PrometheusEvaluationInterval,
		},
		"scrape_configs": []interface{}{
			map[string]interface{}{
				"job_name": "prometheus",
				"static_configs": []interface{}{
					map[string]interface{}{"targets": []string{"localhost:9090"}},
				},
			},
		},
	}
	// Append user scrape configs if provided
	if scrapeConfigContent != "" {
		var userScrapes []interface{}
		// Try parsing as list
		if err := yaml.Unmarshal([]byte(scrapeConfigContent), &userScrapes); err == nil {
			currentScrapes := promConfig["scrape_configs"].([]interface{})
			promConfig["scrape_configs"] = append(currentScrapes, userScrapes...)
		}
	}
	// Marshal full config to YAML
	promConfigBytes, _ := yaml.Marshal(promConfig)
	configs[fmt.Sprintf("prometheus-%s.yml", node.ID[:4])] = string(promConfigBytes)

	// Rules
	if rulesContent != "" {
		configs[fmt.Sprintf("rules-%s.yml", node.ID[:4])] = rulesContent
	}

	extras["prometheus"] = ComposeService{
		Image:   "prom/prometheus:latest",
		Ports:   []string{fmt.Sprintf("%v:9090", defaultPort(config.PrometheusPort, 9090))},
		Volumes: []string{
			"prometheus_data_" + node.ID + ":/prometheus",
			fmt.Sprintf("./configs/prometheus-%s.yml:/etc/prometheus/prometheus.yml", node.ID[:4]),
		},
		Command: []string{
			"--config.file=/etc/prometheus/prometheus.yml",
			"--storage.tsdb.path=/prometheus",
			"--storage.tsdb.retention.time=" + config.PrometheusRetention,
		},
		Restart: "always",
	}

	// Alertmanager
	configs[fmt.Sprintf("alertmanager-%s.yml", node.ID[:4])] = alertmanagerConfigContent

	extras["alertmanager"] = ComposeService{
		Image:   "prom/alertmanager:latest",
		Ports:   []string{fmt.Sprintf("%v:9093", defaultPort(config.AlertmanagerPort, 9093))},
		Volumes: []string{
			"alertmanager_data_" + node.ID + ":/alertmanager",
			fmt.Sprintf("./configs/alertmanager-%s.yml:/etc/alertmanager/config.yml", node.ID[:4]),
		},
		Command: []string{"--storage.path=/alertmanager", "--config.file=/etc/alertmanager/config.yml"},
		Restart: "always",
	}

	// Grafana
	extras["grafana"] = ComposeService{
		Image:   "grafana/grafana:latest",
		Ports:   []string{fmt.Sprintf("%v:3000", defaultPort(config.GrafanaPort, 3000))},
		Environment: map[string]string{
			"GF_SECURITY_ADMIN_USER":     config.GrafanaAdminUser,
			"GF_SECURITY_ADMIN_PASSWORD": config.GrafanaAdminPassword,
			"GF_USERS_ALLOW_SIGN_UP":     fmt.Sprintf("%v", config.GrafanaAllowSignUp),
		},
		Volumes: []string{"grafana_data_" + node.ID + ":/var/lib/grafana"},
		Restart: "always",
	}

	// --- 2. Helm Values (kube-prometheus-stack) ---
	helm := make(HelmValues)

	// Prometheus
	promSpec := map[string]interface{}{
		"retention":          config.PrometheusRetention,
		"scrapeInterval":     config.PrometheusScrapeInterval,
		"scrapeTimeout":      config.PrometheusScrapeTimeout,
		"evaluationInterval": config.PrometheusEvaluationInterval,
        "ruleSelectorNilUsesHelmValues": false,
        "serviceMonitorSelectorNilUsesHelmValues": false,
	}
	if scrapeConfigContent != "" {
		var additionalScrapes []interface{}
		if err := yaml.Unmarshal([]byte(scrapeConfigContent), &additionalScrapes); err == nil {
			promSpec["additionalScrapeConfigs"] = additionalScrapes
		}
	}
	helm["prometheus"] = map[string]interface{}{
		"prometheusSpec": promSpec,
	}

	// Alertmanager
	amConfig := map[string]interface{}{}
    // Parse generated config back to map for Helm values
	if err := yaml.Unmarshal([]byte(alertmanagerConfigContent), &amConfig); err == nil {
        helm["alertmanager"] = map[string]interface{}{
            "config": amConfig,
            "alertmanagerSpec": map[string]interface{}{
                "retention": config.AlertmanagerRetention,
            },
        }
	} else {
        // Fallback default
        helm["alertmanager"] = map[string]interface{}{
            "alertmanagerSpec": map[string]interface{}{
                "retention": config.AlertmanagerRetention,
            },
        }
    }

	// Grafana
	helm["grafana"] = map[string]interface{}{
		"adminUser":     config.GrafanaAdminUser,
		"adminPassword": config.GrafanaAdminPassword,
		"grafana.ini": map[string]interface{}{
			"users": map[string]interface{}{
				"allow_sign_up": config.GrafanaAllowSignUp,
			},
		},
	}

	// 3. Prometheus Rules (CRD)
    if rulesContent != "" {
        ruleManifest := fmt.Sprintf(`apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: canvas-rules-%s
  labels:
    release: devops-canvas-chart
spec:
%s`, node.ID, rulesContent)
        configs["prometheus_rules.yaml"] = ruleManifest
    } else {
        configs["prometheus_rules.yaml"] = fmt.Sprintf(`apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: default-rules-%s
  labels:
    release: devops-canvas-chart
spec:
  groups:
    - name: example
      rules:
      - alert: Watchdog
        expr: vector(1)
        for: 1m
`, node.ID)
    }

	return &GeneratedManifests{
		ExtraComposeServices: extras,
		HelmValues:           &helm,
		Configs:              configs,
	}, nil
}

func defaultPort(val any, def int) int {
	if val == nil { return def }
    if f, ok := val.(float64); ok { return int(f) }
	return def
}

func generateAlertmanagerConfig(config MonitoringStackConfig) string {
    receiverName := "web-hook"
    if config.AlertmanagerConfig.Destination == "discord" {
        receiverName = "discord-webhook"
    } else if config.AlertmanagerConfig.Destination == "telegram" {
        receiverName = "telegram-bot"
    }

    baseConfig := map[string]interface{}{
        "global": map[string]interface{}{
            "resolve_timeout": "5m",
        },
        "route": map[string]interface{}{
            "group_by": []string{"alertname"},
            "group_wait": "30s",
            "group_interval": "5m",
            "repeat_interval": "1h",
            "receiver": receiverName,
        },
        "receivers": []interface{}{
            map[string]interface{}{
                "name": receiverName,
            },
        },
    }

    receivers := baseConfig["receivers"].([]interface{})
    mainReceiver := receivers[0].(map[string]interface{})

    if config.AlertmanagerConfig.Destination == "discord" && config.AlertmanagerConfig.Discord.WebhookURL != "" {
        mainReceiver["discord_configs"] = []interface{}{
            map[string]interface{}{
                "webhook_url": config.AlertmanagerConfig.Discord.WebhookURL,
                "send_resolved": true,
            },
        }
    } else if config.AlertmanagerConfig.Destination == "telegram" && config.AlertmanagerConfig.Telegram.BotToken != "" {
        chatID, _ := strconv.Atoi(config.AlertmanagerConfig.Telegram.ChatID) // Ignore error, 0 if invalid
        mainReceiver["telegram_configs"] = []interface{}{
            map[string]interface{}{
                "bot_token": config.AlertmanagerConfig.Telegram.BotToken,
                "chat_id": chatID,
                "send_resolved": true,
                "parse_mode": "MarkdownV2",
            },
        }
    }

    bytes, _ := yaml.Marshal(baseConfig)
    return string(bytes)
}
