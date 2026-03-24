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

// normalizePrometheusScrapeJobs fixes common YAML mistakes. Prometheus does not allow a top-level
// `labels` field on a scrape job; labels belong under each static_configs entry.
func normalizePrometheusScrapeJobs(jobs []interface{}) []interface{} {
	out := make([]interface{}, 0, len(jobs))
	for _, j := range jobs {
		m, ok := j.(map[string]interface{})
		if !ok {
			out = append(out, j)
			continue
		}
		jobLabels := stringMapFromYAMLValue(m["labels"])
		if len(jobLabels) == 0 {
			out = append(out, m)
			continue
		}
		statics, ok := m["static_configs"].([]interface{})
		if !ok || len(statics) == 0 {
			delete(m, "labels")
			out = append(out, m)
			continue
		}
		for _, sc := range statics {
			smc, ok := sc.(map[string]interface{})
			if !ok {
				continue
			}
			existing := stringMapFromYAMLValue(smc["labels"])
			if existing == nil {
				existing = make(map[string]interface{})
			}
			for k, v := range jobLabels {
				if _, set := existing[k]; !set {
					existing[k] = v
				}
			}
			smc["labels"] = existing
		}
		delete(m, "labels")
		out = append(out, m)
	}
	return out
}

func stringMapFromYAMLValue(v interface{}) map[string]interface{} {
	switch m := v.(type) {
	case map[string]interface{}:
		return m
	case map[interface{}]interface{}:
		out := make(map[string]interface{}, len(m))
		for k, val := range m {
			out[fmt.Sprintf("%v", k)] = val
		}
		return out
	default:
		return nil
	}
}

// normalizePrometheusRulesYAML fixes templates that break Prometheus 3+ rule annotation parsing:
// a literal `%` immediately after `}}` is treated as starting a template command ("missing value for command").
// We rewrite common "{{ $value }}%" patterns to humanizePercentage; any remaining "}}%" gets a space before `%`.
// collectPrometheusAlertmanagerPeers returns enabled alertmanager nodes wired via canvas edges and/or
// an explicit node ID in Prometheus config (edges are not persisted until the workspace is saved).
func collectPrometheusAlertmanagerPeers(ctx TranslationContext, promNode models.Node, explicitAlertmanagerID string) []models.Node {
	seen := make(map[string]bool)
	var peers []models.Node

	add := func(n *models.Node) {
		if n == nil || !strings.EqualFold(strings.TrimSpace(n.Type), "alertmanager") || !NodeEnabledForDeploy(*n) {
			return
		}
		if seen[n.ID] {
			return
		}
		seen[n.ID] = true
		peers = append(peers, *n)
	}

	connected, _ := ctx.FindConnectedNodes(promNode.ID)
	for i := range connected {
		add(&connected[i])
	}

	id := strings.TrimSpace(explicitAlertmanagerID)
	if id != "" {
		if n, err := ctx.FindNodeByID(id); err == nil {
			add(n)
		}
	}

	return peers
}

func normalizePrometheusRulesYAML(s string) string {
	replacements := []struct{ old, new string }{
		{"{{ $value }}%", "{{ humanizePercentage $value }}"},
		{"{{$value}}%", "{{ humanizePercentage $value }}"},
		{"{{ .Value }}%", "{{ humanizePercentage .Value }}"},
		{"{{.Value}}%", "{{ humanizePercentage .Value }}"},
	}
	for _, r := range replacements {
		s = strings.ReplaceAll(s, r.old, r.new)
	}
	s = strings.ReplaceAll(s, "}}%", "}} %")
	return s
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
	Alertmanager       string `json:"alertmanager,omitempty"`
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
				userScrapes = normalizePrometheusScrapeJobs(userScrapes)
				currentScrapes := promConfig["scrape_configs"].([]interface{})
				promConfig["scrape_configs"] = append(currentScrapes, userScrapes...)
			}
		}
	}

	// Wire Alertmanager: canvas edges (when saved) and/or explicit Alertmanager node ID in config.
	amPeers := collectPrometheusAlertmanagerPeers(ctx, node, config.Alertmanager)
	var alertmanagerTargets []string
	var alertmanagerSvcNames []string
	for _, peer := range amPeers {
		svcName := ComposeServiceNameForNode(peer)
		alertmanagerSvcNames = append(alertmanagerSvcNames, svcName)
		alertmanagerTargets = append(alertmanagerTargets, fmt.Sprintf("%s:9093", svcName))
	}
	if len(alertmanagerTargets) > 0 {
		promConfig["alerting"] = map[string]interface{}{
			"alertmanagers": []interface{}{
				map[string]interface{}{
					"static_configs": []interface{}{
						map[string]interface{}{
							"targets": alertmanagerTargets,
						},
					},
				},
			},
		}
	}

	// Handle rules
	id4 := node.ID[:4]
	promFile := fmt.Sprintf("prometheus-%s.yml", id4)
	rulesFile := fmt.Sprintf("rules-%s.yml", id4)

	if rulesContent != "" {
		rc := normalizePrometheusRulesYAML(rulesContent)
		var dockerRulesContent string
		var header struct {
			Kind string      `yaml:"kind"`
			Spec interface{} `yaml:"spec"`
		}
		if err := yaml.Unmarshal([]byte(rc), &header); err == nil && header.Kind == "PrometheusRule" {
			specBytes, _ := yaml.Marshal(header.Spec)
			dockerRulesContent = string(specBytes)
		} else {
			dockerRulesContent = rc
		}
		promConfig["rule_files"] = []string{"/etc/prometheus/canvas-rules.yml"}
		configs[rulesFile] = dockerRulesContent
	}

	promConfigBytes, _ := yaml.Marshal(promConfig)
	configs[promFile] = string(promConfigBytes)

	// Prepare deploy config
	deployConfig := buildDeployConfig(config.Resources)

	vols := DataVolumeSlice("prometheus", node.ID)
	promCfgName := fmt.Sprintf("prometheus_config_%s", id4)
	inline := map[string]string{promCfgName: configs[promFile]}
	cfgMounts := []ComposeConfigRef{{Source: promCfgName, Target: "/etc/prometheus/canvas-prometheus.yml"}}

	if rulesContent != "" {
		rulesCfgName := fmt.Sprintf("prometheus_rules_%s", id4)
		inline[rulesCfgName] = configs[rulesFile]
		cfgMounts = append(cfgMounts, ComposeConfigRef{Source: rulesCfgName, Target: "/etc/prometheus/canvas-rules.yml"})
	}

	svc := ComposeService{
		Image:   "prom/prometheus:latest",
		Ports:   []string{fmt.Sprintf("%v:9090", defaultPort(config.Port, 9090))},
		Volumes: vols,
		Configs: cfgMounts,
		Command: []string{
			"--config.file=/etc/prometheus/canvas-prometheus.yml",
			"--storage.tsdb.path=/prometheus",
			"--storage.tsdb.retention.time=" + config.Retention,
		},
		Restart: "always",
		Deploy:  deployConfig,
	}
	if len(alertmanagerSvcNames) > 0 {
		svc.DependsOn = &DependsOnSpec{}
		for _, dep := range alertmanagerSvcNames {
			svc.DependsOn.AppendStarted(dep)
		}
	}

	return &GeneratedManifests{
		DockerCompose:       &svc,
		Configs:             configs,
		ComposeConfigInline: inline,
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
	amFile := fmt.Sprintf("alertmanager-%s.yml", node.ID[:4])
	configs[amFile] = alertmanagerConfigContent

	deployConfig := buildDeployConfig(config.Resources)

	vols := DataVolumeSlice("alertmanager", node.ID)
	amCfgName := fmt.Sprintf("alertmanager_config_%s", node.ID[:4])
	svc := ComposeService{
		Image:   "prom/alertmanager:latest",
		Ports:   []string{fmt.Sprintf("%v:9093", defaultPort(config.Port, 9093))},
		Volumes: vols,
		Configs: []ComposeConfigRef{{Source: amCfgName, Target: "/etc/alertmanager/canvas-config.yml"}},
		Command: []string{
			"--storage.path=/alertmanager",
			"--config.file=/etc/alertmanager/canvas-config.yml",
		},
		Restart: "always",
		Deploy:  deployConfig,
	}

	return &GeneratedManifests{
		DockerCompose:       &svc,
		Configs:             configs,
		ComposeConfigInline: map[string]string{amCfgName: configs[amFile]},
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
