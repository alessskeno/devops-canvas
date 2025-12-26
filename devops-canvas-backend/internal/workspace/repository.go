package workspace

import (
	"context"
	"devops-canvas-backend/internal/db"
	"devops-canvas-backend/internal/models"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

func (r *Repository) ListWorkspaces(ctx context.Context, userID string) ([]models.Workspace, error) {
	query := `
		SELECT w.id, w.name, w.description, w.owner_id, w.last_updated_by, u.name as last_updated_by_name, w.environment, w.visibility, w.created_at, w.updated_at
		FROM workspaces w
		LEFT JOIN users u ON w.last_updated_by = u.id
		WHERE 
			w.owner_id = $1 
			OR w.visibility = 'public' 
			OR w.visibility = 'team'
			OR w.id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1)
		ORDER BY w.updated_at DESC
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workspaces []models.Workspace
	for rows.Next() {
		var w models.Workspace
		var lastUpdatedBy *string
		var lastUpdatedByName *string
		if err := rows.Scan(&w.ID, &w.Name, &w.Description, &w.OwnerID, &lastUpdatedBy, &lastUpdatedByName, &w.Environment, &w.Visibility, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		w.LastUpdatedBy = lastUpdatedBy
		if lastUpdatedByName != nil {
			w.LastUpdatedByName = *lastUpdatedByName
		}
		workspaces = append(workspaces, w)
	}
	return workspaces, nil
}

func (r *Repository) CreateWorkspace(ctx context.Context, ws models.Workspace) (*models.Workspace, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Create Workspace
	query := `
		INSERT INTO workspaces (name, description, owner_id, last_updated_by, environment, visibility)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	// Fallback defaults if empty
	if ws.Environment == "" {
		ws.Environment = "development"
	}
	if ws.Visibility == "" {
		ws.Visibility = "private"
	}

	err = tx.QueryRow(ctx, query, ws.Name, ws.Description, ws.OwnerID, ws.LastUpdatedBy, ws.Environment, ws.Visibility).
		Scan(&ws.ID, &ws.CreatedAt, &ws.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// 2. Add Owner as Member
	memberQuery := `
		INSERT INTO workspace_members (workspace_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`
	_, err = tx.Exec(ctx, memberQuery, ws.ID, ws.OwnerID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ws, nil
}

func (r *Repository) UpdateWorkspace(ctx context.Context, id string, data map[string]interface{}) (*models.Workspace, error) {
	// Only supporting name and description update for now
	// Logic to dynamically build query can be added, but manual for safety now
	query := `
		UPDATE workspaces 
		SET name = COALESCE($2, name), 
		    description = COALESCE($3, description),
			last_updated_by = $4,
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, description, owner_id, last_updated_by, created_at, updated_at
	`
	
	name, _ := data["name"].(string)
	desc, _ := data["description"].(string)
	lastUpdatedBy, _ := data["last_updated_by"].(string) // Should be passed

	var ws models.Workspace
	var lud *string
	err := db.Pool.QueryRow(ctx, query, id, name, desc, lastUpdatedBy).
		Scan(&ws.ID, &ws.Name, &ws.Description, &ws.OwnerID, &lud, &ws.CreatedAt, &ws.UpdatedAt)
	
	if err != nil {
		return nil, err
	}
	ws.LastUpdatedBy = lud

	return &ws, nil
}

func (r *Repository) DeleteWorkspace(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, "DELETE FROM workspaces WHERE id = $1", id)
	return err
}

func (r *Repository) AddMember(ctx context.Context, workspaceID, userID, role string) error {
	_, err := db.Pool.Exec(ctx, 
		"INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)", 
		workspaceID, userID, role)
	return err
}

func (r *Repository) RemoveMember(ctx context.Context, workspaceID, userID string) error {
	_, err := db.Pool.Exec(ctx, 
		"DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", 
		workspaceID, userID)
	return err
}

func (r *Repository) GetMemberRole(ctx context.Context, workspaceID, userID string) (string, error) {
	var role string
	err := db.Pool.QueryRow(ctx, "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", workspaceID, userID).Scan(&role)
	if err != nil {
		return "", err
	}
	return role, nil
}

