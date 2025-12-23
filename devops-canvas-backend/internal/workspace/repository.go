package workspace

import (
    "context"
    "devops-canvas-backend/internal/models"
)

type Repository struct{}

func NewRepository() *Repository {
    return &Repository{}
}

func (r *Repository) ListWorkspaces(ctx context.Context) ([]models.Workspace, error) {
    return []models.Workspace{}, nil
}

func (r *Repository) CreateWorkspace(ctx context.Context, ws models.Workspace) (*models.Workspace, error) {
    return &ws, nil
}

func (r *Repository) UpdateWorkspace(ctx context.Context, id string, data map[string]interface{}) (*models.Workspace, error) {
    return &models.Workspace{ID: id}, nil
}

func (r *Repository) DeleteWorkspace(ctx context.Context, id string) error {
    return nil
}
