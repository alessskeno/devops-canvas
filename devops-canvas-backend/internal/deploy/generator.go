package deploy

import (
	"devops-canvas-backend/internal/deploy/translator"
	"devops-canvas-backend/internal/models"
    "fmt"
)

type ManifestGenerator struct{}

func NewManifestGenerator() *ManifestGenerator {
	return &ManifestGenerator{}
}

// GenerateManifests takes a Node and produces deployment manifests
func (g *ManifestGenerator) GenerateManifests(node models.Node, allNodes []models.Node) (*translator.GeneratedManifests, error) {
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
    }
    
    // Safety check for empty result
    result, err := trans.Translate(node, ctx)
    if err != nil {
        return nil, err
    }
    if result == nil {
        return nil, fmt.Errorf("translator returned nil result")
    }

	return result, nil
}
