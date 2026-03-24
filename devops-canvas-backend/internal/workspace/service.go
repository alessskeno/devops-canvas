package workspace

import (
    "context"
    "errors"
    "fmt"
    "regexp"
    "strconv"

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

func (s *Service) DuplicateWorkspace(ctx context.Context, sourceID, userID string) (*models.Workspace, error) {
    // 1. Get Source Workspace to get original name
    workspaces, err := s.repo.ListWorkspaces(ctx, userID)
    if err != nil {
        return nil, err
    }
    
    var sourceWs *models.Workspace
    for i := range workspaces {
        if workspaces[i].ID == sourceID {
            sourceWs = &workspaces[i]
            break
        }
    }
    if sourceWs == nil {
        return nil, errors.New("source workspace not found")
    }
    
    // 2. Determine base name and next copy number
    baseName := sourceWs.Name
    re := regexp.MustCompile(`^(.*?) \(copy (\d+)\)$`)
    
    // If source is already a copy, extract the base
    if matches := re.FindStringSubmatch(baseName); matches != nil {
        baseName = matches[1]
    }
    
    maxCopy := 0
    // Check all workspaces for collision with pattern "BaseName (copy X)"
    for _, ws := range workspaces {
        if ws.Name == baseName {
             // The original exists
             continue
        }
        
        if matches := re.FindStringSubmatch(ws.Name); matches != nil {
            if matches[1] == baseName {
                if num, err := strconv.Atoi(matches[2]); err == nil {
                    if num > maxCopy {
                        maxCopy = num
                    }
                }
            }
        }
    }
    
    newName := fmt.Sprintf("%s (copy %d)", baseName, maxCopy + 1)
    
    // 3. Create duplicate
    return s.repo.DuplicateWorkspace(ctx, sourceID, newName, userID)
}

func (s *Service) SaveCanvas(ctx context.Context, workspaceID string, userID string, state models.CanvasState) error {
	return s.repo.SaveCanvas(ctx, workspaceID, userID, state)
}

func (s *Service) SaveCanvasViewport(ctx context.Context, workspaceID string, userID string, vp *models.CanvasViewport) error {
	return s.repo.SaveCanvasViewport(ctx, workspaceID, userID, vp)
}

func (s *Service) GetCanvas(ctx context.Context, workspaceID string) (*models.CanvasState, error) {
    return s.repo.GetCanvas(ctx, workspaceID)
}
func (s *Service) GetWorkspace(ctx context.Context, id string) (*models.Workspace, error) {
    return s.repo.GetWorkspace(ctx, id)
}
