package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type NodeDataWrapper struct {
	KindConfig KindClusterConfig `json:"kindConfig"`
}

type KindClusterConfig struct {
	Name       string           `json:"name"`
	Version    string           `json:"version"` // Kubernetes Version (full image string)
	Topology   TopologyConfig   `json:"topology"`
	Networking NetworkingConfig `json:"networking"`
	Mounts     []MountConfig    `json:"mounts"`
	ConfigFile string           `json:"advancedConfigNodeId"` // ID of the attached config file node
}

type TopologyConfig struct {
	ControlPlanes int `json:"controlPlanes"`
	Workers       int `json:"workers"`
}

type NetworkingConfig struct {
	EnableIngress bool `json:"enableIngress"`
	APIServerPort int  `json:"apiServerPort,omitempty"`
}

type MountConfig struct {
	HostPath      string `json:"hostPath"`
	ContainerPath string `json:"containerPath"`
}

type KindTranslator struct{}

func (t *KindTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	var wrapper NodeDataWrapper
	// Unmarshal wrapper to get nested kindConfig
	if err := json.Unmarshal(node.Data, &wrapper); err != nil {
		return nil, fmt.Errorf("failed to parse kind config wrapper: %v", err)
	}

	config := wrapper.KindConfig
	fmt.Printf("[DEBUG] Kind Config Decoded: %+v\n", config)

	generatedConfigs := make(map[string]string)

	// 1. Attached Config File (Top Priority)
	if config.ConfigFile != "" {
		fileNode, err := ctx.FindNodeByID(config.ConfigFile)
		if err == nil {
			var fileConfig ConfigFile
			// Assuming ConfigFile struct is defined in types.go
			if err := json.Unmarshal(fileNode.Data, &fileConfig); err == nil && fileConfig.Content != "" {
				generatedConfigs["kind-config.yaml"] = fileConfig.Content
				return &GeneratedManifests{Configs: generatedConfigs}, nil
			}
		}
	}

	// 3. Generate Config from Structured Fields
	versionTag := config.Version
	if versionTag == "" {
		versionTag = "kindest/node:v1.27.3"
	}
    // Check if it's just a version number (e.g. "v1.34.3") and prepend image name
    if len(versionTag) > 0 && versionTag[0] == 'v' {
        versionTag = "kindest/node:" + versionTag
    }

	var yamlContent string
	yamlContent += "kind: Cluster\n"
	yamlContent += "apiVersion: kind.x-k8s.io/v1alpha4\n"

	if config.Name != "" {
		// kind-config doesn't strictly need name field as it's passed to `kind create --name`,
		// but including it doesn't hurt.
		// yamlContent += fmt.Sprintf("name: %s\n", config.Name)
	}

	// Networking
	if config.Networking.APIServerPort != 0 {
		yamlContent += "networking:\n"
		yamlContent += fmt.Sprintf("  apiServerPort: %d\n", config.Networking.APIServerPort)
	}

	yamlContent += "nodes:\n"

	// Control Plane Nodes
	cpCount := config.Topology.ControlPlanes
	if cpCount < 1 {
		cpCount = 1
	}

	for i := 0; i < cpCount; i++ {
		yamlContent += "- role: control-plane\n"
		yamlContent += fmt.Sprintf("  image: %s\n", versionTag)

		// Ingress preparation (ONLY for the first control plane usually)
		if config.Networking.EnableIngress && i == 0 {
			yamlContent += "  kubeadmConfigPatches:\n"
			yamlContent += "  - |\n"
			yamlContent += "    kind: InitConfiguration\n"
			yamlContent += "    nodeRegistration:\n"
			yamlContent += "      kubeletExtraArgs:\n"
			yamlContent += "        node-labels: \"ingress-ready=true\"\n"
			yamlContent += "  extraPortMappings:\n"
			yamlContent += "  - containerPort: 80\n"
			yamlContent += "    hostPort: 80\n"
			yamlContent += "    protocol: TCP\n"
			yamlContent += "  - containerPort: 443\n"
			yamlContent += "    hostPort: 443\n"
			yamlContent += "    protocol: TCP\n"
		}

		// Mounts
		if len(config.Mounts) > 0 {
			yamlContent += "  extraMounts:\n"
			for _, m := range config.Mounts {
				yamlContent += fmt.Sprintf("  - hostPath: %s\n", m.HostPath)
				yamlContent += fmt.Sprintf("  - containerPath: %s\n", m.ContainerPath)
			}
		}
	}

	// Worker Nodes
	for i := 0; i < config.Topology.Workers; i++ {
		yamlContent += "- role: worker\n"
		yamlContent += fmt.Sprintf("  image: %s\n", versionTag)
		
		if len(config.Mounts) > 0 {
			yamlContent += "  extraMounts:\n"
			for _, m := range config.Mounts {
				yamlContent += fmt.Sprintf("  - hostPath: %s\n", m.HostPath)
				yamlContent += fmt.Sprintf("  - containerPath: %s\n", m.ContainerPath)
			}
		}
	}

	generatedConfigs["kind-config.yaml"] = yamlContent

	return &GeneratedManifests{
		Configs: generatedConfigs,
	}, nil
}
