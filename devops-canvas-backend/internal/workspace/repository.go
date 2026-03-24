package workspace

import (
	"context"
	"encoding/json"

	"devops-canvas-backend/internal/db"
	"devops-canvas-backend/internal/models"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

func (r *Repository) ListWorkspaces(ctx context.Context, userID string) ([]models.Workspace, error) {
	query := `
		SELECT 
            w.id, w.name, w.description, w.owner_id, w.last_updated_by, u.name as last_updated_by_name, w.environment, w.visibility, w.version, w.created_at, w.updated_at,
            COALESCE(
                (SELECT ARRAY_AGG(DISTINCT type) FROM nodes WHERE workspace_id = w.id),
                ARRAY[]::text[]
            ) as component_types,
            (SELECT COUNT(*) FROM nodes WHERE workspace_id = w.id) as component_count
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
		if err := rows.Scan(&w.ID, &w.Name, &w.Description, &w.OwnerID, &lastUpdatedBy, &lastUpdatedByName, &w.Environment, &w.Visibility, &w.Version, &w.CreatedAt, &w.UpdatedAt, &w.ComponentTypes, &w.ComponentCount); err != nil {
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
		INSERT INTO workspaces (name, description, owner_id, last_updated_by, environment, visibility, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`
	// Fallback defaults if empty
	if ws.Environment == "" {
		ws.Environment = "development"
	}
	if ws.Visibility == "" {
		ws.Visibility = "private"
	}
    if ws.Version == "" {
        ws.Version = "v0.1.0"
    }

	err = tx.QueryRow(ctx, query, ws.Name, ws.Description, ws.OwnerID, ws.LastUpdatedBy, ws.Environment, ws.Visibility, ws.Version).
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
            environment = COALESCE($4, environment),
            visibility = COALESCE($5, visibility),
            version = COALESCE($6, version),
			last_updated_by = $7,
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, description, owner_id, last_updated_by, environment, visibility, version, created_at, updated_at
	`
	
	name, _ := data["name"].(string)
	desc, _ := data["description"].(string)
    env, _ := data["environment"].(string)
    vis, _ := data["visibility"].(string)
    ver, _ := data["version"].(string)
	lastUpdatedBy, _ := data["last_updated_by"].(string)

	var ws models.Workspace
	var lud *string
	err := db.Pool.QueryRow(ctx, query, id, name, desc, env, vis, ver, lastUpdatedBy).
		Scan(&ws.ID, &ws.Name, &ws.Description, &ws.OwnerID, &lud, &ws.Environment, &ws.Visibility, &ws.Version, &ws.CreatedAt, &ws.UpdatedAt)
	
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

func (r *Repository) DuplicateWorkspace(ctx context.Context, sourceID, newName, userID string) (*models.Workspace, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Copy Workspace
	query := `
		INSERT INTO workspaces (name, description, config_json, environment, visibility, version, owner_id, last_updated_by)
		SELECT $2, description, config_json, environment, visibility, version, $3, $3
		FROM workspaces
		WHERE id = $1
		RETURNING id, name, description, environment, visibility, version, created_at, updated_at
	`
	
	var ws models.Workspace
	err = tx.QueryRow(ctx, query, sourceID, newName, userID).
		Scan(&ws.ID, &ws.Name, &ws.Description, &ws.Environment, &ws.Visibility, &ws.Version, &ws.CreatedAt, &ws.UpdatedAt)
	if err != nil {
		return nil, err
	}
    ws.OwnerID = userID
    ws.LastUpdatedBy = &userID

	// 2. Add Owner as Member
	memberQuery := `
		INSERT INTO workspace_members (workspace_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`
	_, err = tx.Exec(ctx, memberQuery, ws.ID, userID)
	if err != nil {
		return nil, err
	}

    // 3. Duplicate Nodes
    nodeMap := make(map[string]string) // OldID -> NewID
    var componentTypes []string
    typeSet := make(map[string]bool)

    rows, err := tx.Query(ctx, "SELECT id, type, position_x, position_y, data FROM nodes WHERE workspace_id = $1", sourceID)
    if err != nil {
        return nil, err
    }
    
    // We need to collect all nodes first to avoid issues with closing rows before inserting? 
    // Actually inside a transaction pgx handles this, but it's safer to read all then insert.
    type nodeData struct {
        OldID     string
        Type      string
        X         float64
        Y         float64
        Data      interface{} // json.RawMessage
    }
    var nodesToInsert []nodeData

    for rows.Next() {
        var n nodeData
        if err := rows.Scan(&n.OldID, &n.Type, &n.X, &n.Y, &n.Data); err != nil {
            rows.Close()
            return nil, err
        }
        nodesToInsert = append(nodesToInsert, n)
        
        if !typeSet[n.Type] {
            typeSet[n.Type] = true
            componentTypes = append(componentTypes, n.Type)
        }
    }
    rows.Close()

    for _, n := range nodesToInsert {
        var newID string
        // Insert and get new generated ID
        err := tx.QueryRow(ctx, `
            INSERT INTO nodes (workspace_id, type, position_x, position_y, data, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id
        `, ws.ID, n.Type, n.X, n.Y, n.Data).Scan(&newID)
        
        if err != nil {
            return nil, err
        }
        nodeMap[n.OldID] = newID
    }
    
    ws.ComponentCount = len(nodesToInsert)
    ws.ComponentTypes = componentTypes

    // 4. Duplicate Connections
    rowsConn, err := tx.Query(ctx, "SELECT source_id, target_id, source_handle, target_handle FROM connections WHERE workspace_id = $1", sourceID)
    if err != nil {
        return nil, err
    }
    
    type connData struct {
        SourceID string
        TargetID string
        SourceHandle *string
        TargetHandle *string
    }
    var connsToInsert []connData

    for rowsConn.Next() {
        var c connData
        if err := rowsConn.Scan(&c.SourceID, &c.TargetID, &c.SourceHandle, &c.TargetHandle); err != nil {
            rowsConn.Close()
            return nil, err
        }
        connsToInsert = append(connsToInsert, c)
    }
    rowsConn.Close()

    for _, c := range connsToInsert {
        newSource, ok1 := nodeMap[c.SourceID]
        newTarget, ok2 := nodeMap[c.TargetID]
        
        if ok1 && ok2 {
             _, err := tx.Exec(ctx, `
                INSERT INTO connections (workspace_id, source_id, target_id, source_handle, target_handle, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            `, ws.ID, newSource, newTarget, c.SourceHandle, c.TargetHandle)
            if err != nil {
                return nil, err
            }
        }
    }

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ws, nil
}

func (r *Repository) SaveCanvas(ctx context.Context, workspaceID string, userID string, state models.CanvasState) error {
	nodes := state.Nodes
	connections := state.Connections

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Strategy: Upsert (Insert or Update) for included items, Delete for excluded items.

	// 1. Handling Nodes
	var nodeIDs []string
	for _, n := range nodes {
		nodeIDs = append(nodeIDs, n.ID)
	}

	// 1a. Delete nodes not present in the new list
	if len(nodeIDs) > 0 {
		_, err = tx.Exec(ctx, "DELETE FROM nodes WHERE workspace_id = $1 AND id != ALL($2)", workspaceID, nodeIDs)
	} else {
		// If empty list, delete all
		_, err = tx.Exec(ctx, "DELETE FROM nodes WHERE workspace_id = $1", workspaceID)
	}
	if err != nil {
		return err
	}

	// 1b. Upsert Nodes
	// We preserve created_at for existing nodes by NOT updating it.
	// updated_at is always set to NOW() on update.
	for _, n := range nodes {
		_, err := tx.Exec(ctx, `
			INSERT INTO nodes (id, workspace_id, type, position_x, position_y, data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				type = EXCLUDED.type,
				position_x = EXCLUDED.position_x,
				position_y = EXCLUDED.position_y,
				data = EXCLUDED.data,
				updated_at = NOW()
		`, n.ID, workspaceID, n.Type, n.PositionX, n.PositionY, n.Data)
		if err != nil {
			return err
		}
	}

	// 2. Handling Connections
	var connIDs []string
	for _, c := range connections {
		connIDs = append(connIDs, c.ID)
	}

	// 2a. Delete connections not present
	if len(connIDs) > 0 {
		_, err = tx.Exec(ctx, "DELETE FROM connections WHERE workspace_id = $1 AND id != ALL($2)", workspaceID, connIDs)
	} else {
		_, err = tx.Exec(ctx, "DELETE FROM connections WHERE workspace_id = $1", workspaceID)
	}
	if err != nil {
		return err
	}

	// 2b. Upsert Connections
	for _, c := range connections {
		_, err := tx.Exec(ctx, `
			INSERT INTO connections (id, workspace_id, source_id, target_id, source_handle, target_handle, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT (id) DO UPDATE SET
				source_id = EXCLUDED.source_id,
				target_id = EXCLUDED.target_id,
				source_handle = EXCLUDED.source_handle,
				target_handle = EXCLUDED.target_handle
				-- Connections usually don't have updated_at, but if they did we'd update it.
				-- We preserve created_at implicitly by not modifying it in UPDATE.
		`, c.ID, workspaceID, c.SourceID, c.TargetID, c.SourceHandle, c.TargetHandle)
		if err != nil {
			return err
		}
	}

	// 3. Update workspace metadata (and optional canvas viewport in config_json)
	if state.Viewport != nil {
		vpJSON, jerr := json.Marshal(state.Viewport)
		if jerr != nil {
			return jerr
		}
		_, err = tx.Exec(ctx, `
			UPDATE workspaces SET
				config_json = jsonb_set(COALESCE(config_json, '{}'::jsonb), '{canvasViewport}', $2::jsonb, true),
				updated_at = NOW(),
				last_updated_by = $3
			WHERE id = $1
		`, workspaceID, vpJSON, userID)
	} else {
		_, err = tx.Exec(ctx, "UPDATE workspaces SET updated_at = NOW(), last_updated_by = $2 WHERE id = $1", workspaceID, userID)
	}
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SaveCanvasViewport updates only config_json.canvasViewport (pan/zoom) without touching nodes or connections.
func (r *Repository) SaveCanvasViewport(ctx context.Context, workspaceID string, userID string, vp *models.CanvasViewport) error {
	if vp == nil {
		return nil
	}
	vpJSON, err := json.Marshal(vp)
	if err != nil {
		return err
	}
	_, err = db.Pool.Exec(ctx, `
		UPDATE workspaces SET
			config_json = jsonb_set(COALESCE(config_json, '{}'::jsonb), '{canvasViewport}', $2::jsonb, true),
			updated_at = NOW(),
			last_updated_by = $3
		WHERE id = $1
	`, workspaceID, vpJSON, userID)
	return err
}

func (r *Repository) GetCanvas(ctx context.Context, workspaceID string) (*models.CanvasState, error) {
	state := &models.CanvasState{
		Nodes:       []models.Node{},
		Connections: []models.Connection{},
	}

	// Fetch Nodes
	rows, err := db.Pool.Query(ctx, "SELECT id, workspace_id, type, position_x, position_y, data, created_at, updated_at FROM nodes WHERE workspace_id = $1", workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var n models.Node
		if err := rows.Scan(&n.ID, &n.WorkspaceID, &n.Type, &n.PositionX, &n.PositionY, &n.Data, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		state.Nodes = append(state.Nodes, n)
	}

	// Fetch Connections
	rowsConn, err := db.Pool.Query(ctx, "SELECT id, workspace_id, source_id, target_id, source_handle, target_handle, created_at FROM connections WHERE workspace_id = $1", workspaceID)
	if err != nil {
		return nil, err
	}
	defer rowsConn.Close()

	for rowsConn.Next() {
		var c models.Connection
		if err := rowsConn.Scan(&c.ID, &c.WorkspaceID, &c.SourceID, &c.TargetID, &c.SourceHandle, &c.TargetHandle, &c.CreatedAt); err != nil {
			return nil, err
		}
		state.Connections = append(state.Connections, c)
	}

	var configJSON []byte
	if err := db.Pool.QueryRow(ctx, "SELECT COALESCE(config_json, '{}'::jsonb) FROM workspaces WHERE id = $1", workspaceID).Scan(&configJSON); err == nil && len(configJSON) > 0 {
		var cfg struct {
			CanvasViewport *models.CanvasViewport `json:"canvasViewport"`
		}
		if err := json.Unmarshal(configJSON, &cfg); err == nil && cfg.CanvasViewport != nil {
			state.Viewport = cfg.CanvasViewport
		}
	}

	return state, nil
}

func (r *Repository) GetWorkspace(ctx context.Context, id string) (*models.Workspace, error) {
	query := `
		SELECT id, name, description, owner_id, last_updated_by, environment, visibility, version, created_at, updated_at
		FROM workspaces
		WHERE id = $1
	`
	var ws models.Workspace
	var lastUpdatedBy *string
	err := db.Pool.QueryRow(ctx, query, id).Scan(
		&ws.ID, &ws.Name, &ws.Description, &ws.OwnerID, &lastUpdatedBy, 
		&ws.Environment, &ws.Visibility, &ws.Version, &ws.CreatedAt, &ws.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	ws.LastUpdatedBy = lastUpdatedBy
	return &ws, nil
}
