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

func (s *Service) ListWorkspaces(ctx context.Context, userID string) ([]models.Workspace, error) {
	return s.repo.ListWorkspaces(ctx, userID)
}

func (s *Service) GetMemberRole(ctx context.Context, workspaceID, userID string) (string, error) {
	return s.repo.GetMemberRole(ctx, workspaceID, userID)
}

func (s *Service) CreateWorkspace(ctx context.Context, name, description, environment, visibility, ownerID string) (*models.Workspace, error) {
	ws := models.Workspace{
		Name:          name,
		Description:   description,
		OwnerID:       ownerID,
		LastUpdatedBy: &ownerID, // Initially, creator is the updater
		Environment:   environment,
		Visibility:    visibility,
	}
	return s.repo.CreateWorkspace(ctx, ws)
}

func (s *Service) UpdateWorkspace(ctx context.Context, id string, data map[string]interface{}, userID string) (*models.Workspace, error) {
	// Inject the updater
	data["last_updated_by"] = userID
	return s.repo.UpdateWorkspace(ctx, id, data)
}

func (s *Service) DeleteWorkspace(ctx context.Context, id string) error {
	return s.repo.DeleteWorkspace(ctx, id)
}
