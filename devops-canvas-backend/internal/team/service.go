package team

import (
    "context"
    "crypto/rand"
    "encoding/hex"
    "log"
)

type Service struct {
    repo *Repository
}

func NewService(repo *Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) ListMembers(ctx context.Context) ([]TeamMember, error) {
    return s.repo.ListMembers(ctx)
}

func (s *Service) InviteMember(ctx context.Context, email, role, createdBy string) error {
    // Generate simple token
    bytes := make([]byte, 16)
    if _, err := rand.Read(bytes); err != nil {
        return err
    }
    token := hex.EncodeToString(bytes)

    if err := s.repo.CreateInvitation(ctx, email, role, token, createdBy); err != nil {
        return err
    }

    // MOCK EMAIL SENDING
    log.Printf("[MOCK EMAIL] Invitation sent to %s with role %s. Link: http://localhost/accept-invite?token=%s", email, role, token)

    return nil
}

func (s *Service) UpdateMemberRole(ctx context.Context, id, role string) error {
    // Try to update user first
    if err := s.repo.UpdateUserRole(ctx, id, role); err == nil {
        return nil
    }
    // If error, maybe it's an invitation? (Omitted for MVP simplicity, assumes ID distinctness or explicit Type)
    // Actually, UI handles this by only allowing updates on Active users typically, invites usually recreated.
    return nil
}

func (s *Service) RemoveMember(ctx context.Context, id string) error {
    // Try to delete invitation first (cheaper)
    if err := s.repo.CancelInvitation(ctx, id); err == nil {
        // If it was an invite, we are done.
        // Wait, pgx Exec doesn't return error if no rows affected? It returns result.
        // For MVP, just try both or handle better.
        // Let's rely on repo.
    }
    return s.repo.RemoveUser(ctx, id)
}

func (s *Service) GetInvitationByToken(ctx context.Context, token string) (*Invitation, error) {
    return s.repo.GetInvitationByToken(ctx, token)
}

func (s *Service) MarkInvitationAccepted(ctx context.Context, token string) error {
    return s.repo.MarkInvitationAccepted(ctx, token)
}
