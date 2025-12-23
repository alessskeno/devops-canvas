package deploy

import "context"

type Repository struct{}

func NewRepository() *Repository {
    return &Repository{}
}

func (r *Repository) DeployWorkspace(ctx context.Context, workspaceID string) (string, error) {
    return "deploy-id-123", nil
}

func (r *Repository) GetLogs(ctx context.Context, deployID string) ([]string, error) {
    return []string{"Log line 1", "Log line 2"}, nil
}
