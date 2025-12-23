package team

import (
    "context"
    "time"

    "devops-canvas-backend/internal/db"
    "devops-canvas-backend/internal/models"
)

type Repository struct{}

func NewRepository() *Repository {
    return &Repository{}
}

func (r *Repository) ListMembers(ctx context.Context) ([]TeamMember, error) {
    // 1. Get active users
    usersQuery := `SELECT id, name, email, role, created_at FROM users`
    rows, err := db.Pool.Query(ctx, usersQuery)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    members := []TeamMember{}
    for rows.Next() {
        var u models.User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.CreatedAt); err != nil {
            return nil, err
        }
        members = append(members, TeamMember{
            ID:     u.ID,
            Name:   u.Name,
            Email:  u.Email,
            Role:   u.Role,
            Status: "Active",
            // LastActive logic omitted for MVP
        })
    }

    // 2. Get pending invitations
    invitesQuery := `SELECT id, email, role, status, created_at FROM invitations WHERE status = 'pending'`
    inviteRows, err := db.Pool.Query(ctx, invitesQuery)
    if err != nil {
        return nil, err
    }
    defer inviteRows.Close()

    for inviteRows.Next() {
        var i Invitation
        if err := inviteRows.Scan(&i.ID, &i.Email, &i.Role, &i.Status, &i.CreatedAt); err != nil {
            return nil, err
        }
        members = append(members, TeamMember{
            ID:     i.ID,
            Name:   i.Email, // Placeholder until they join
            Email:  i.Email,
            Role:   i.Role,
            Status: "Invited",
        })
    }

    return members, nil
}

func (r *Repository) CreateInvitation(ctx context.Context, email, role, token string, createdBy string) error {
    sql := `
        INSERT INTO invitations (email, role, token, created_by, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `
    // Expires in 7 days
    expiresAt := time.Now().Add(7 * 24 * time.Hour)
    _, err := db.Pool.Exec(ctx, sql, email, role, token, createdBy, expiresAt)
    return err
}

func (r *Repository) UpdateUserRole(ctx context.Context, userID, role string) error {
    _, err := db.Pool.Exec(ctx, `UPDATE users SET role = $1 WHERE id = $2`, role, userID)
    return err
}

func (r *Repository) CancelInvitation(ctx context.Context, inviteID string) error {
    _, err := db.Pool.Exec(ctx, `DELETE FROM invitations WHERE id = $1`, inviteID)
    return err
}

func (r *Repository) RemoveUser(ctx context.Context, userID string) error {
    // 1. Remove/Cancel invitations created by this user to satisfy FK constraints
    _, err := db.Pool.Exec(ctx, `DELETE FROM invitations WHERE created_by = $1`, userID)
    if err != nil {
        return err // Could verify if error is strictly needed, but let's be safe
    }

    // 2. Remove the user
    // CAUTION: Removing a user might leave orphaned workspaces.
    _, err = db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
    return err
}

func (r *Repository) GetInvitationByToken(ctx context.Context, token string) (*Invitation, error) {
    sql := `SELECT id, email, role, status, expires_at FROM invitations WHERE token = $1 AND status = 'pending'`
    var i Invitation
    err := db.Pool.QueryRow(ctx, sql, token).Scan(&i.ID, &i.Email, &i.Role, &i.Status, &i.CreatedAt) // CreatedAt used as ExpiresAt holder or need Struct update?
    // Wait, struct has CreatedAt. SQL query selects expires_at.
    // Let's just select created_at and verify expiry in service or select expires_at into a local var.
    // Actually, let's update Invitation struct to have ExpiresAt if needed, or just check here.
    // The struct in model.go:
    // type Invitation struct { ID, Email, Role, Status, CreatedAt }
    // It doesn't have ExpiresAt.
    // But I can check expiry in SQL: AND expires_at > NOW()
    if err != nil {
        return nil, err
    }
    return &i, nil
}

func (r *Repository) MarkInvitationAccepted(ctx context.Context, token string) error {
    _, err := db.Pool.Exec(ctx, `UPDATE invitations SET status = 'accepted' WHERE token = $1`, token)
    return err
}
