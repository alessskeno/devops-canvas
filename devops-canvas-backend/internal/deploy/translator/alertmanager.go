package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type AlertmanagerConfig struct {
    Port       any    `json:"port"`
    Retention  string `json:"retention"`
    ConfigFile string `json:"config_file,omitempty"` // This would likely be a node ID or similar
    Version    string `json:"version"`
}

type AlertmanagerTranslator struct{}

func (t *AlertmanagerTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config AlertmanagerConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse alertmanager config: %v", err)
    }

    version := config.Version
    if version == "" {
        version = "latest"
    }

    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "9093"
    }

    generatedConfigs := make(map[string]string)
    volumes := []string{"alertmanager_data_" + node.ID + ":/alertmanager"}

    // Handle Config File
    if config.ConfigFile != "" {
        fileNode, err := ctx.FindNodeByID(config.ConfigFile)
        if err == nil {
             var fileConfig ConfigFile
             if err := json.Unmarshal(fileNode.Data, &fileConfig); err == nil {
                 fileName := fmt.Sprintf("alertmanager_%s.yml", node.ID)
                 generatedConfigs[fileName] = fileConfig.Content
                 volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/alertmanager/config.yml", fileName))
             }
        }
    }

    command := []string{
        "--config.file=/etc/alertmanager/config.yml",
        "--storage.path=/alertmanager",
    }
    if config.Retention != "" {
        command = append(command, "--data.retention="+config.Retention)
    }

    compose := &ComposeService{
        Image:       "prom/alertmanager:" + version,
        Ports:       []string{port + ":9093"},
        Volumes:     volumes,
        Command:     command,
        Restart:     "always",
    }

    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    
    helm["fullnameOverride"] = "alertmanager-" + node.ID // Consistent DNS naming
    
    extraArgs := map[string]interface{}{
        "storage.path": "/alertmanager",
    }
    if config.Retention != "" {
        extraArgs["data.retention"] = config.Retention
    }
    helm["extraArgs"] = extraArgs
    
    // Alertmanager chart uses 'config' key for the configuration
    if config.ConfigFile != "" {
         fileNode, _ := ctx.FindNodeByID(config.ConfigFile)
         if fileNode != nil {
             var fileConfig ConfigFile
             _ = json.Unmarshal(fileNode.Data, &fileConfig)
             helm["config"] = fileConfig.Content
         }
    } else {
        // Default minimal config
        helm["config"] = `
global:
  resolve_timeout: 5m
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://127.0.0.1:5001/'
`
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
        Configs:       generatedConfigs,
    }, nil
}
