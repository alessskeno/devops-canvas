package translator

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"devops-canvas-backend/internal/models"
)

// CustomContainerConfig defines the expected JSON data from the frontend
type CustomContainerConfig struct {
	CommonConfig
	Label          string   `json:"label"`
	BuildContextID string   `json:"buildContextId"`
	PortMappings   []string `json:"portMappings"`
	ContainerPort  any      `json:"containerPort"`
	HostPort       any      `json:"hostPort"`
}

type CustomContainerTranslator struct{}

func (t *CustomContainerTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	// Use raw JSON map for flexible parsing — avoids type mismatches
	// (e.g. envVars may be {} object or "KEY=VAL" string depending on frontend version)
	var raw map[string]interface{}
	if err := json.Unmarshal(node.Data, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse custom-container config: %v", err)
	}

	// Also unmarshal into typed struct for typed fields
	var config CustomContainerConfig
	// Use a lenient approach: unmarshal what we can, ignore mismatches
	_ = json.Unmarshal(node.Data, &config)

	// Fallback for buildContextId from raw map
	if config.BuildContextID == "" {
		if id, _ := raw["buildContextId"].(string); id != "" {
			config.BuildContextID = id
		} else if id, _ := raw["buildContext"].(string); id != "" {
			config.BuildContextID = id
		}
	}

	label := config.Label
	if label == "" {
		if l, _ := raw["label"].(string); l != "" {
			label = l
		} else {
			label = "Custom Container"
		}
	}

	// Check Enabled status
	if config.Enabled != nil && !*config.Enabled {
		return nil, nil
	}

	// Validate build context
	if config.BuildContextID == "" {
		return nil, fmt.Errorf("custom container '%s': no build context uploaded. Please upload your source directory first", label)
	}

	contextDir := filepath.Join("/tmp/contexts", config.BuildContextID)

	// Parse ports: prefer portMappings, fall back to containerPort/hostPort (legacy)
	var ports []string
	if len(config.PortMappings) > 0 {
		for _, p := range config.PortMappings {
			p = strings.TrimSpace(p)
			if p != "" {
				ports = append(ports, p)
			}
		}
	}
	if len(ports) == 0 {
		containerPort := fmt.Sprintf("%v", config.ContainerPort)
		if containerPort == "" || containerPort == "<nil>" || containerPort == "0" {
			containerPort = "8080"
		}
		hostPort := fmt.Sprintf("%v", config.HostPort)
		if hostPort == "" || hostPort == "<nil>" || hostPort == "0" {
			hostPort = containerPort
		}
		ports = []string{fmt.Sprintf("%s:%s", hostPort, containerPort)}
	}

	// Linked components on the canvas first (HOST, PORT, common URL vars); user envVars override below.
	env := make(map[string]string)
	depends, err := injectLinkedDependencyEnvs(env, node.ID, ctx)
	if err != nil {
		return nil, err
	}

	// User-defined environment (overrides auto-linked keys when the same name is set)
	if envObj, ok := raw["envVars"].(map[string]interface{}); ok {
		for k, v := range envObj {
			env[k] = fmt.Sprintf("%v", v)
		}
	} else if envStr, ok := raw["envVars"].(string); ok && envStr != "" {
		for _, line := range strings.Split(envStr, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				env[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			}
		}
	}

	service := &ComposeService{
		Build: &ComposeBuild{
			Context: contextDir,
		},
		Ports:       ports,
		Environment: env,
		Restart:     "unless-stopped",
	}
	if depends != nil {
		service.DependsOn = depends
	}

	return &GeneratedManifests{
		DockerCompose: service,
	}, nil
}
