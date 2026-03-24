package models

import (
	"encoding/json"
	"time"
)

type Node struct {
	ID          string          `json:"id" db:"id"`
	WorkspaceID string          `json:"workspace_id" db:"workspace_id"`
	Type        string          `json:"type" db:"type"`
	PositionX   float64         `json:"position_x" db:"position_x"`
	PositionY   float64         `json:"position_y" db:"position_y"`
	Data        json.RawMessage `json:"data" db:"data"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type Connection struct {
	ID           string    `json:"id" db:"id"`
	WorkspaceID  string    `json:"workspace_id" db:"workspace_id"`
	SourceID     string    `json:"source" db:"source_id"`
	TargetID     string    `json:"target" db:"target_id"`
	SourceHandle *string   `json:"source_handle" db:"source_handle"`
	TargetHandle *string   `json:"target_handle" db:"target_handle"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// CanvasViewport is the React Flow pan/zoom state persisted per workspace.
type CanvasViewport struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

type CanvasState struct {
	Nodes       []Node          `json:"nodes"`
	Connections []Connection    `json:"connections"`
	Viewport    *CanvasViewport `json:"viewport,omitempty"`
}
