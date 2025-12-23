package team

import (
    "time"
)

type Invitation struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    Role      string    `json:"role"`
    Token     string    `json:"-"`
    Status    string    `json:"status"`
    ExpiresAt time.Time `json:"expires_at"`
    CreatedAt time.Time `json:"created_at"`
}

type TeamMember struct {
    ID         string    `json:"id"`
    Name       string    `json:"name"`
    Email      string    `json:"email"`
    Role       string    `json:"role"`
    Status     string    `json:"status"` // "active" or "invited"
    LastActive string    `json:"last_active,omitempty"` // Derived for MVP
}

type InviteRequest struct {
    Email string `json:"email"`
    Role  string `json:"role"`
}

type UpdateRoleRequest struct {
    Role string `json:"role"`
}
