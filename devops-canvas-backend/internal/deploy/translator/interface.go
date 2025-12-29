package translator

import (
	"devops-canvas-backend/internal/models"
)

// TranslationContext holds data available to translators
type TranslationContext struct {
    FindNodeByID       func(id string) (*models.Node, error)
    FindConnectedNodes func(nodeID string) ([]models.Node, error)
}

// ComponentTranslator defines the interface for translating a specific component type
type ComponentTranslator interface {
	Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error)
}
