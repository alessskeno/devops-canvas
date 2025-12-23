package workspace

import (
    "context"
    "devops-canvas-backend/internal/models"
)

type Service struct {
    repo *Repository
}

func NewService(repo *Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) ListWorkspaces(ctx context.Context) ([]models.Workspace, error) {
    return s.repo.ListWorkspaces(ctx)
}

func (s *Service) CreateWorkspace(ctx context.Context, ws models.Workspace) (*models.Workspace, error) {
    return s.repo.CreateWorkspace(ctx, ws)
}

func (s *Service) UpdateWorkspace(ctx context.Context, id string, data map[string]interface{}) (*models.Workspace, error) {
    return s.repo.UpdateWorkspace(ctx, id, data)
}

func (s *Service) DeleteWorkspace(ctx context.Context, id string) error {
    return s.repo.DeleteWorkspace(ctx, id)
}
