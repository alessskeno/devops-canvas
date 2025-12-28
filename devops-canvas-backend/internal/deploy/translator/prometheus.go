package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type PrometheusConfig struct {
    Port             any    `json:"port"`
    Retention        string `json:"retention"`
    ScrapeInterval   string `json:"scrape_interval"`
    Version          string `json:"version"`
}

type PrometheusTranslator struct{}

// Reuse struct for JSON parsing
type PrometheusConfigFull struct {
    Port               any    `json:"port"`
    Retention          string `json:"retention"`
    ScrapeInterval     string `json:"scrape_interval"`
    Version            string `json:"version"`
    ScrapeConfigsFile  string `json:"scrape_configs"` // Node ID
    RulesFiles         string `json:"rules_files"`    // Node ID
    AlertingNodeID     string `json:"alerting"`       // Alertmanager Node ID
}

func (t *PrometheusTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config PrometheusConfigFull
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse prometheus config: %v", err)
    }

    version := config.Version
    if version == "" {
        version = "latest"
    }

    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "9090"
    }
    
    generatedConfigs := make(map[string]string)
    volumes := []string{"prometheus_data_" + node.ID + ":/prometheus"}
    
    // Base Prometheus Config with templating placeholders
    baseConfig := fmt.Sprintf(`global:
  scrape_interval: %s
  evaluation_interval: 15s
`, config.ScrapeInterval)

    // Handle Scrape Configs (append to baseConfig)
    if config.ScrapeConfigsFile != "" {
        if node, err := ctx.FindNodeByID(config.ScrapeConfigsFile); err == nil {
             var f ConfigFile
             if json.Unmarshal(node.Data, &f) == nil {
                 baseConfig += "\n" + f.Content
             }
        }
    } else {
        // Default scrape config if none provided
        baseConfig += `
scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
`
    }
    
    // Handle Alerting
    if config.AlertingNodeID != "" {
        baseConfig += fmt.Sprintf(`
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["%s:9093"]
`, "alertmanager-"+config.AlertingNodeID) // Assuming standard service naming convention
    }

    // Handle Rules
    if config.RulesFiles != "" {
        if node, err := ctx.FindNodeByID(config.RulesFiles); err == nil {
             var f ConfigFile
             if json.Unmarshal(node.Data, &f) == nil {
                 fileName := fmt.Sprintf("rules_%s.yml", node.ID)
                 generatedConfigs[fileName] = f.Content
                 volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/prometheus/%s", fileName, fileName))
                 baseConfig += fmt.Sprintf("\nrule_files:\n  - %s\n", fileName)
             }
        }
    }

    // Save main config
    configName := fmt.Sprintf("prometheus_%s.yml", node.ID)
    generatedConfigs[configName] = baseConfig
    volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/prometheus/prometheus.yml", configName))

    command := []string{
        "--config.file=/etc/prometheus/prometheus.yml",
        "--storage.tsdb.path=/prometheus",
    }
    if config.Retention != "" {
        command = append(command, "--storage.tsdb.retention.time="+config.Retention)
    }

    compose := &ComposeService{
        Image:       "prom/prometheus:" + version,
        Ports:       []string{port + ":9090"},
        Volumes:     volumes,
        Command:     command,
        Restart:     "always",
    }

    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    // For Helm, we use serverFiles to inject config and rules
    serverFiles := make(map[string]interface{})
    serverFiles["prometheus.yml"] = baseConfig
    
    // Inject rule files
    for name, content := range generatedConfigs {
        if name != configName {
             serverFiles[name] = content
        }
    }
    helm["serverFiles"] = serverFiles
    helm["fullnameOverride"] = "prometheus-" + node.ID

    helm["server"] = map[string]interface{}{
        "retention": config.Retention,
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
        Configs:       generatedConfigs,
    }, nil
}
