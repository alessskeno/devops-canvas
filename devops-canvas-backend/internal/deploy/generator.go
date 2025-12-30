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

	return result, nil
}
