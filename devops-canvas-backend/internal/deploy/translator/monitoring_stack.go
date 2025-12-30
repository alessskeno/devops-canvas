package translator

import (
	"encoding/json"
	"fmt"
	"strconv"
    "strings"
	
	"devops-canvas-backend/internal/models"
	
	"gopkg.in/yaml.v3"
)

type MonitoringStackConfig struct {
    CommonConfig                 // Embed Enabled and Resources
	// Prometheus
    EnablePrometheus             *bool  `json:"enable_prometheus"` // Default true if nil
	PrometheusPort               any    `json:"prometheus_port"`
	PrometheusRetention          string `json:"prometheus_retention"`
	PrometheusScrapeInterval     string `json:"prometheus_scrape_interval"`
	PrometheusScrapeTimeout      string `json:"prometheus_scrape_timeout"`
	PrometheusEvaluationInterval string `json:"prometheus_evaluation_interval"`
	PrometheusScrapeConfigs      string `json:"prometheus_scrape_configs"` // NodeID
	PrometheusRulesFiles         string `json:"prometheus_rules_files"`    // NodeID

	// Alertmanager
    EnableAlertmanager     *bool  `json:"enable_alertmanager"` // Default true if nil
	AlertmanagerPort       any    `json:"alertmanager_port"`
	AlertmanagerRetention  string `json:"alertmanager_retention"`
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
    EnableGrafana        *bool  `json:"enable_grafana"` // Default true if nil
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
    enablePrometheus := config.EnablePrometheus == nil || *config.EnablePrometheus
    enableAlertmanager := config.EnableAlertmanager == nil || *config.EnableAlertmanager
    enableGrafana := config.EnableGrafana == nil || *config.EnableGrafana

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

    // Check Global Enabled
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }

	// --- 1. Docker Compose Generation ---
	extras := make(map[string]ComposeService)
	configs := make(map[string]string)
    
    // Prepare Deploy Config
    var deployConfig *DeployConfig
    if config.Resources != nil {
        deployConfig = &DeployConfig{
            Resources: &ResourcesBlock{Limits: ResourceLimits{}},
        }
        hasLimit := false
        if config.Resources.CPU > 0 {
            deployConfig.Resources.Limits.CPUs = fmt.Sprintf("%.1f", config.Resources.CPU)
            hasLimit = true
        }
        if config.Resources.Memory != "" && config.Resources.Memory != "0" {
            deployConfig.Resources.Limits.Memory = config.Resources.Memory
            hasLimit = true
        }
        if !hasLimit { deployConfig = nil }
    }

	// Prometheus
    if enablePrometheus {
	    // Generate prometheus.yml for Docker
	    promConfig := map[string]interface{}{
		    "global": map[string]interface{}{
			    "scrape_interval":     config.PrometheusScrapeInterval,
			    "scrape_timeout":      config.PrometheusScrapeTimeout,
			    "evaluation_interval": config.PrometheusEvaluationInterval,
		    },
		    "scrape_configs": []interface{}{},
	    }
	    
<<<<<<< HEAD
=======
        // ... (Keep existing scrape config logic) ...
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
        // Robust Scrape Config Parsing (Multi-Doc Support)
	    if scrapeConfigContent != "" {
		    // Use YAML Decoder to handle multiple documents
            decoder := yaml.NewDecoder(strings.NewReader(scrapeConfigContent))
            
            for {
                var docNode yaml.Node
                if err := decoder.Decode(&docNode); err != nil {
                     break // EOF or error
                }
                
                // We need to inspect this node to see what it is
                // Convert back to bytes to use standard Unmarshal logic which is easier for structure matching
                // or just traverse Node. But re-marshaling is easier for our existing logic.
                docBytes, _ := yaml.Marshal(&docNode)
                
                var userScrapes []interface{}
                var parseErr error = fmt.Errorf("initial")

                // Try 1: Unmarshal as list (standard scrape config list)
                if err := yaml.Unmarshal(docBytes, &userScrapes); err == nil && len(userScrapes) > 0 {
                     // Check if it really looks like a list of maps
                     if _, ok := userScrapes[0].(map[string]interface{}); ok {
                         parseErr = nil
                     }
                }

                // Try 2: Unmarshal as map
                if parseErr != nil {
                     var mapConfig map[string]interface{}
                     if errMap := yaml.Unmarshal(docBytes, &mapConfig); errMap == nil {
                         // Check for ServiceMonitor (Skip for Docker)
                         if kind, ok := mapConfig["kind"].(string); ok && kind == "ServiceMonitor" {
                             continue // Docker doesn't support ServiceMonitor
                         }

                         // Check for scrape_configs key
                         if val, ok := mapConfig["scrape_configs"]; ok {
                             if asList, ok := val.([]interface{}); ok { 
                                 userScrapes = asList 
                                 parseErr = nil
                             }
                         } else {
                             // Check if single job
                             if _, isJob := mapConfig["job_name"]; isJob { 
                                 userScrapes = append(userScrapes, mapConfig) 
                                 parseErr = nil
                             }
                         }
                     }
                }

                if parseErr == nil && len(userScrapes) > 0 {
                     currentScrapes := promConfig["scrape_configs"].([]interface{})
                     promConfig["scrape_configs"] = append(currentScrapes, userScrapes...)
                }
            }
	    }
        
        // Handle Rules for Docker
<<<<<<< HEAD
=======
        // ... (Keep existing rules logic) ...
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
        if rulesContent != "" {
             // Logic to extract valid Prometheus config if input is CRD
             var dockerRulesContent string

             var header struct {
                 Kind string `yaml:"kind"`
                 Spec interface{} `yaml:"spec"` // Use interface to capture structure
             }
             if err := yaml.Unmarshal([]byte(rulesContent), &header); err == nil && header.Kind == "PrometheusRule" {
                 // It is a CRD, extract Spec
                 // Spec typically has { groups: [...] }
                 specBytes, _ := yaml.Marshal(header.Spec)
                 dockerRulesContent = string(specBytes)
             } else {
                 // Not a CRD, assume raw groups
                 dockerRulesContent = rulesContent
             }

             // For Docker, we reference the mounted file
             promConfig["rule_files"] = []string{"/etc/prometheus/rules.yml"}
             configs[fmt.Sprintf("rules-%s.yml", node.ID[:4])] = dockerRulesContent
        }

	    // Marshal full config to YAML
	    promConfigBytes, _ := yaml.Marshal(promConfig)
	    configs[fmt.Sprintf("prometheus-%s.yml", node.ID[:4])] = string(promConfigBytes)

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
<<<<<<< HEAD
=======
            Deploy: deployConfig,
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
	    }
        // Add rules mount if rules exist
        if rulesContent != "" {
            promParams := extras["prometheus"]
            promParams.Volumes = append(promParams.Volumes, 
                fmt.Sprintf("./configs/rules-%s.yml:/etc/prometheus/rules.yml", node.ID[:4]))
            extras["prometheus"] = promParams
        }
    }

	// Alertmanager
    if enableAlertmanager {
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
<<<<<<< HEAD
=======
            Deploy: deployConfig,
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
	    }
    }

	// Grafana
    if enableGrafana {
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
<<<<<<< HEAD
=======
            Deploy: deployConfig,
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
	    }
    }

    // 2. Prepare Helm Resources Block
    var helmResources map[string]interface{}
    if config.Resources != nil {
        r := map[string]interface{}{}
        l := map[string]interface{}{}
        req := map[string]interface{}{}
        
        hasR := false
        if config.Resources.CPU > 0 {
            l["cpu"] = fmt.Sprintf("%.1f", config.Resources.CPU)
            req["cpu"] = fmt.Sprintf("%.1fm", config.Resources.CPU * 500)
            hasR = true
        }
        if config.Resources.Memory != "" && config.Resources.Memory != "0" {
            l["memory"] = config.Resources.Memory
            req["memory"] = config.Resources.Memory
            hasR = true
        }
        if hasR {
            r["limits"] = l
            r["requests"] = req
            helmResources = r
        }
    }

	// --- 3. Helm Values (kube-prometheus-stack) ---
	helm := make(HelmValues)

	// Prometheus
    if enablePrometheus {
	    promSpec := map[string]interface{}{
		    "retention":          config.PrometheusRetention,
		    "scrapeInterval":     config.PrometheusScrapeInterval,
		    "scrapeTimeout":      config.PrometheusScrapeTimeout,
		    "evaluationInterval": config.PrometheusEvaluationInterval,
            "ruleSelectorNilUsesHelmValues": false,
            "serviceMonitorSelectorNilUsesHelmValues": false,
            "serviceMonitorSelector": map[string]interface{}{},
            "ruleSelector": map[string]interface{}{},
	    }
<<<<<<< HEAD
	    
=======
        if helmResources != nil {
            promSpec["resources"] = helmResources
        }
	    
        // ... (Keep existing Scrape Config logic) ...
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
        // Scrape Config for Helm
	    if scrapeConfigContent != "" {
            decoder := yaml.NewDecoder(strings.NewReader(scrapeConfigContent))
            var additionalScrapes []interface{}
            
            for {
                var docNode yaml.Node
                if err := decoder.Decode(&docNode); err != nil { break }
                docBytes, _ := yaml.Marshal(&docNode)

                // Check for ServiceMonitor CRD
                var header struct {
                    Kind string `yaml:"kind"`
                }
                _ = yaml.Unmarshal(docBytes, &header)

                if header.Kind == "ServiceMonitor" {
                    // It is a ServiceMonitor, output as separate manifest
                    // We append to configs with a unique name
                    // Use hash or index to avoid collision? For now assume 1 or use random.
                    // Actually, node.ID is constant. If multiple ServiceMonitors, we need unique keys.
                    // We can use docNode line/column or random suffix.
                    configs[fmt.Sprintf("servicemonitor-%s-%d.yaml", node.ID[:4], len(configs))] = string(docBytes)
                } else {
                    // It is a standard scrape config (List or Map) - Add to additionalScrapeConfigs
		            var userScrapes []interface{}
                    var parseErr error = fmt.Errorf("init")

                    if err := yaml.Unmarshal(docBytes, &userScrapes); err == nil && len(userScrapes) > 0 {
                          if _, ok := userScrapes[0].(map[string]interface{}); ok { parseErr = nil }
                    }

                    if parseErr != nil {
                        var mapConfig map[string]interface{}
                        if errMap := yaml.Unmarshal(docBytes, &mapConfig); errMap == nil {
                             if val, ok := mapConfig["scrape_configs"]; ok {
                                 if asList, ok := val.([]interface{}); ok { userScrapes = asList; parseErr = nil }
                             } else {
                                 if _, isJob := mapConfig["job_name"]; isJob { userScrapes = append(userScrapes, mapConfig); parseErr = nil }
                             }
                        }
                    }
                    if parseErr == nil && len(userScrapes) > 0 {
			            additionalScrapes = append(additionalScrapes, userScrapes...)
                    }
                }
            } // end loop

            if len(additionalScrapes) > 0 {
                promSpec["additionalScrapeConfigs"] = additionalScrapes
            }
	    }
	    helm["prometheus"] = map[string]interface{}{
            "enabled": true,
		    "prometheusSpec": promSpec,
	    }
    } else {
        helm["prometheus"] = map[string]interface{}{
            "enabled": false,
        }
    }

	// Alertmanager
    if enableAlertmanager {
	    amConfig := map[string]interface{}{}
<<<<<<< HEAD
	    if err := yaml.Unmarshal([]byte(alertmanagerConfigContent), &amConfig); err == nil {
            helm["alertmanager"] = map[string]interface{}{
                "enabled": true,
                "config": amConfig,
                "alertmanagerSpec": map[string]interface{}{
                    "retention": config.AlertmanagerRetention,
                },
            }
	    } else {
            helm["alertmanager"] = map[string]interface{}{
                "enabled": true,
                "alertmanagerSpec": map[string]interface{}{
                    "retention": config.AlertmanagerRetention,
                },
            }
        }
    } else {
        helm["alertmanager"] = map[string]interface{}{
=======
	    _ = yaml.Unmarshal([]byte(alertmanagerConfigContent), &amConfig) // Ignore error, empty map if fails
        
        amSpec := map[string]interface{}{
            "retention": config.AlertmanagerRetention,
        }
        if helmResources != nil {
            amSpec["resources"] = helmResources
        }

        helm["alertmanager"] = map[string]interface{}{
            "enabled": true,
            "config": amConfig,
            "alertmanagerSpec": amSpec,
        }
    } else {
        helm["alertmanager"] = map[string]interface{}{
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
            "enabled": false,
        }
    }

	// Grafana
    if enableGrafana {
<<<<<<< HEAD
	    helm["grafana"] = map[string]interface{}{
=======
        grafanaMap := map[string]interface{}{
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
            "enabled": true,
		    "adminUser":     config.GrafanaAdminUser,
		    "adminPassword": config.GrafanaAdminPassword,
		    "grafana.ini": map[string]interface{}{
			    "users": map[string]interface{}{
				    "allow_sign_up": config.GrafanaAllowSignUp,
			    },
		    },
<<<<<<< HEAD
	    }
=======
        }
        if helmResources != nil {
            grafanaMap["resources"] = helmResources
        }
	    helm["grafana"] = grafanaMap
>>>>>>> ecd65c4 (Recovered from git corruption [skip ci])
    } else {
        helm["grafana"] = map[string]interface{}{
            "enabled": false,
        }
    }

    // 3. Custom Rules (Helm: additionalPrometheusRulesMap)
    // We reuse the logic from Docker section to normalize input (CRD vs raw)
    if enablePrometheus && rulesContent != "" {
         var rulesObj interface{}
         var header struct {
             Kind string `yaml:"kind"`
             Spec interface{} `yaml:"spec"`
         }
         
         // Try parsing as CRD first
         if err := yaml.Unmarshal([]byte(rulesContent), &header); err == nil && header.Kind == "PrometheusRule" {
             rulesObj = header.Spec
         } else {
             // Not a CRD, assume it is the spec (groups)
             _ = yaml.Unmarshal([]byte(rulesContent), &rulesObj)
         }

         if rulesObj != nil {
             helm["additionalPrometheusRulesMap"] = map[string]interface{}{
                 fmt.Sprintf("custom-rules-%s", node.ID[:8]): rulesObj,
             }
         }
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
