package deploy

import "context"

type Service struct {
    repo *Repository
}

func NewService(repo *Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) DeployWorkspace(ctx context.Context, workspaceID string) (string, error) {
    return s.repo.DeployWorkspace(ctx, workspaceID)
}

func (s *Service) GetLogs(ctx context.Context, deployID string) ([]string, error) {
    return s.repo.GetLogs(ctx, deployID)
}
