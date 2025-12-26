package models

import "time"

type Workspace struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    OwnerID           string     `json:"owner_id"`
    LastUpdatedBy     *string    `json:"last_updated_by,omitempty"`
    LastUpdatedByName string     `json:"last_updated_by_name,omitempty"`
    CreatedAt         time.Time  `json:"created_at"`
    UpdatedAt         time.Time  `json:"updated_at"`
    Environment       string     `json:"environment"`
    Visibility        string     `json:"visibility"`
}

type WorkspaceMember struct {
    WorkspaceID string    `json:"workspace_id"`
    UserID      string    `json:"user_id"`
    Role        string    `json:"role"`
    AddedAt     time.Time `json:"added_at"`
}
