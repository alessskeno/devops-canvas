package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type KindClusterConfig struct {
    Name       string `json:"name"`
    Version    string `json:"version"` // Kubernetes Version
    ConfigFile string `json:"configFile,omitempty"` // ID of the attached config file node
}

type KindTranslator struct{}

func (t *KindTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config KindClusterConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse kind config: %v", err)
    }

    generatedConfigs := make(map[string]string)
    
    // Check for attached config file
    if config.ConfigFile != "" {
        fileNode, err := ctx.FindNodeByID(config.ConfigFile)
        if err == nil {
            var fileConfig ConfigFile
            if err := json.Unmarshal(fileNode.Data, &fileConfig); err == nil {
                generatedConfigs["kind-config.yaml"] = fileConfig.Content
            }
        }
    } else {
        // Fallback or Basic Config generation if no file provided
        // For now, minimal config
        content := fmt.Sprintf(`kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  image: kindest/node:%s
`, config.Version)
        generatedConfigs["kind-config.yaml"] = content
    }

    return &GeneratedManifests{
        Configs: generatedConfigs,
        // No HelmValues or DockerCompose for the cluster itself
    }, nil
}
