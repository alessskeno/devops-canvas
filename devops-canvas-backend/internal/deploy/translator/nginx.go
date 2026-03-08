package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
)

// NginxTranslator produces a ComposeService for nginx and optionally mounts a config file
// when the user selects a file node as "Config File" in tooling options.
type NginxTranslator struct{}

func (t *NginxTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var uConfig UniversalNodeConfig
	_ = json.Unmarshal(node.Data, &uConfig)

	if uConfig.Enabled != nil && !*uConfig.Enabled {
		return nil, nil
	}

	def := DefaultComposeByType["nginx"]
	image := def.Image
	tag := "latest"
	if uConfig.Image != "" {
		image = uConfig.Image
		if uConfig.Tag != "" {
			tag = uConfig.Tag
		}
	}

	ports := uConfig.PortMappings
	if len(ports) == 0 {
		ports = def.Ports
	}
	validPorts := filterValidPorts(ports)

	restart := uConfig.RestartPolicy
	if restart == "" {
		restart = "always"
	}

	compose := &ComposeService{
		Image:   fmt.Sprintf("%s:%s", image, tag),
		Ports:   validPorts,
		Restart: restart,
	}

	generatedConfigs := make(map[string]string)

	var rawData map[string]interface{}
	_ = json.Unmarshal(node.Data, &rawData)

	configFileNodeID, _ := rawData["config_file"].(string)
	if configFileNodeID == "" && ctx.FindConnectedNodes != nil {
		connected, _ := ctx.FindConnectedNodes(node.ID)
		for _, n := range connected {
			if n.Type == "file" {
				configFileNodeID = n.ID
				break
			}
		}
	}

	if configFileNodeID != "" {
		fileNode, err := ctx.FindNodeByID(configFileNodeID)
		if err == nil && fileNode != nil {
			content := getFileNodeContent(fileNode.Data)
			fileName := fmt.Sprintf("nginx-%s.conf", node.ID)
			generatedConfigs[fileName] = content
			compose.Volumes = append(compose.Volumes, fmt.Sprintf("./configs/%s:/etc/nginx/nginx.conf", fileName))
		}
	}

	return &GeneratedManifests{
		DockerCompose: compose,
		Configs:       generatedConfigs,
	}, nil
}

// getFileNodeContent reads config content from file node data (content, value, or ConfigFile).
func getFileNodeContent(data json.RawMessage) string {
	var fc ConfigFile
	if err := json.Unmarshal(data, &fc); err == nil && fc.Content != "" {
		return fc.Content
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return ""
	}
	if s, _ := raw["content"].(string); s != "" {
		return s
	}
	if s, _ := raw["value"].(string); s != "" {
		return s
	}
	return ""
}
