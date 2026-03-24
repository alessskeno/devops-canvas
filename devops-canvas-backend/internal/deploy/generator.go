package deploy

import (
	"devops-canvas-backend/internal/deploy/translator"
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
	"strings"
)

type ManifestGenerator struct{}

func NewManifestGenerator() *ManifestGenerator {
	return &ManifestGenerator{}
}

// GenerateManifests takes a Node and produces deployment manifests
func (g *ManifestGenerator) GenerateManifests(node models.Node, allNodes []models.Node, allConnections []models.Connection) (*translator.GeneratedManifests, error) {
	trans, err := translator.GetTranslator(node.Type)
	if err != nil {
		return nil, err
	}

	// Create context for lookups
	nodeMap := make(map[string]models.Node)
	for _, n := range allNodes {
		nodeMap[n.ID] = n
	}

	ctx := translator.TranslationContext{
		FindNodeByID: func(id string) (*models.Node, error) {
			if n, ok := nodeMap[id]; ok {
				return &n, nil
			}
			return nil, fmt.Errorf("node not found")
		},
		FindConnectedNodes: func(nodeID string) ([]models.Node, error) {
			var connected []models.Node
			for _, conn := range allConnections {
				var otherID string
				if conn.SourceID == nodeID {
					otherID = conn.TargetID
				} else if conn.TargetID == nodeID {
					otherID = conn.SourceID
				}

				if otherID != "" {
					if n, ok := nodeMap[otherID]; ok {
						connected = append(connected, n)
					}
				}
			}
			return connected, nil
		},
	}

	// Safety check for empty result
	result, err := trans.Translate(node, ctx)
	if err != nil {
		return nil, err
	}
	// Result nil means component is disabled or skipped
	if result == nil {
		return nil, nil
	}

	// INTERCEPT: Apply Universal Docker Compose Overrides
	if result.DockerCompose != nil {
		var uConfig translator.UniversalNodeConfig
		if err := json.Unmarshal(node.Data, &uConfig); err == nil {
			// Override Image
			if uConfig.Image != "" {
				tag := uConfig.Tag
				if tag == "" {
					tag = "latest"
				}
				img := uConfig.Image
				// Bitnami Kafka often has no :latest; canvas KRaft config targets the official Apache image.
				if node.Type == "kafka" && strings.Contains(strings.ToLower(img), "bitnami/kafka") {
					img = "apache/kafka"
				}
				// Library elasticsearch image/tags are not published; use Elastic's registry (no :latest there).
				if node.Type == "elasticsearch" {
					il := strings.ToLower(img)
					if il == "elasticsearch" || il == "library/elasticsearch" || il == "docker.io/library/elasticsearch" {
						img = "docker.elastic.co/elasticsearch/elasticsearch"
					}
					if strings.Contains(strings.ToLower(img), "docker.elastic.co/elasticsearch/elasticsearch") && (tag == "" || tag == "latest") {
						tag = "8.17.3"
					}
				}
				result.DockerCompose.Image = fmt.Sprintf("%s:%s", img, tag)
			}
			// Container Name
			if uConfig.ContainerName != "" {
				result.DockerCompose.ContainerName = uConfig.ContainerName
			}
			// Restart Policy
			if uConfig.RestartPolicy != "" {
				result.DockerCompose.Restart = uConfig.RestartPolicy
			}
			// Command Overrides
			if uConfig.Command != "" {
				// Simple split by space. Real implementation might need proper shell lexer
				result.DockerCompose.Command = []string{"sh", "-c", uConfig.Command}
			}
			// Depends On
			if len(uConfig.DependsOn) > 0 {
				if result.DockerCompose.DependsOn == nil {
					result.DockerCompose.DependsOn = &translator.DependsOnSpec{}
				}
				for _, name := range uConfig.DependsOn {
					result.DockerCompose.DependsOn.AppendStarted(name)
				}
			}
			// Port Mappings
			if len(uConfig.PortMappings) > 0 {
				var validPorts []string
				for _, p := range uConfig.PortMappings {
					if p != "" && p != ":" {
						validPorts = append(validPorts, p)
					}
				}
				if len(validPorts) > 0 {
					result.DockerCompose.Ports = validPorts // Overwrite completely
				}
			}
			// Environment Variables
			if len(uConfig.EnvVars) > 0 {
				if result.DockerCompose.Environment == nil {
					result.DockerCompose.Environment = make(map[string]string)
				}
				for k, v := range uConfig.EnvVars {
					result.DockerCompose.Environment[k] = v // Merge/overwrite mapping natively
				}
			}
			// Volumes
			if len(uConfig.Volumes) > 0 {
				for _, v := range uConfig.Volumes {
					if v.Source != "" {
						volString := fmt.Sprintf("%s:%s", v.Source, v.Target)
						result.DockerCompose.Volumes = append(result.DockerCompose.Volumes, volString)
					}
				}
			}
			// Networks
			if len(uConfig.Networks) > 0 {
				result.DockerCompose.Networks = append(result.DockerCompose.Networks, uConfig.Networks...)
			}
			// Resource limits (deploy.resources)
			if uConfig.Resources != nil {
				hasLimit := false
				if result.DockerCompose.Deploy == nil {
					result.DockerCompose.Deploy = &translator.DeployConfig{
						Resources: &translator.ResourcesBlock{Limits: translator.ResourceLimits{}},
					}
				}
				if result.DockerCompose.Deploy.Resources == nil {
					result.DockerCompose.Deploy.Resources = &translator.ResourcesBlock{Limits: translator.ResourceLimits{}}
				}
				if uConfig.Resources.CPU > 0 {
					result.DockerCompose.Deploy.Resources.Limits.CPUs = fmt.Sprintf("%.1f", uConfig.Resources.CPU)
					hasLimit = true
				}
				if uConfig.Resources.Memory != "" && uConfig.Resources.Memory != "0" {
					result.DockerCompose.Deploy.Resources.Limits.Memory = translator.SanitizeMemoryForCompose(uConfig.Resources.Memory)
					hasLimit = true
				}
				if !hasLimit {
					result.DockerCompose.Deploy = nil
				}
			}
		}
		// Drop legacy per-file config binds (often stored in saved canvases); they conflict with
		// prom/prometheus & alertmanager image layout and cause "mount directory onto file" on WSL.
		result.DockerCompose.Volumes = translator.SanitizeMonitoringLegacyFileMounts(node.Type, result.DockerCompose.Volumes)
	}

	return result, nil
}
