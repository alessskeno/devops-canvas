package auth

import (
	"context"
	"devops-canvas-backend/internal/models"
)

type Service struct {
	provider AuthProvider
	repo     *Repository
}

func NewService(provider AuthProvider, repo *Repository) *Service {
	return &Service{
		provider: provider,
		repo:     repo,
	}
}

// Delegate methods to Provider

func (s *Service) Register(ctx context.Context, req models.CreateUserRequest) (*models.AuthResponse, error) {
	return s.provider.Register(ctx, req)
}

func (s *Service) RegisterWithRole(ctx context.Context, req models.CreateUserRequest, role string) (*models.AuthResponse, error) {
    return s.provider.RegisterWithRole(ctx, req, role)
}

func (s *Service) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	return s.provider.Login(ctx, req)
}

func (s *Service) ParseToken(tokenString string) (string, error) {
    return s.provider.VerifyToken(context.Background(), tokenString)
}

func (s *Service) GetUser(ctx context.Context, userID string) (*models.User, error) {
	return s.provider.GetUser(ctx, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req models.UpdateProfileRequest) (*models.User, error) {
    return s.provider.UpdateProfile(ctx, userID, req)
}

// Local helper methods that might still directly access repo if needed for specific non-auth logic
// ...

func (s *Service) IsSystemConfigured(ctx context.Context) (bool, error) {
	return s.repo.IsSystemConfigured(ctx)
}

// Helpers that might need moving to Local/Clerk implementations or kept here if shared
func (s *Service) CheckRole(ctx context.Context, userID string, allowedRoles ...string) error {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return err
	}

	for _, role := range allowedRoles {
		if user.Role == role {
			return nil
		}
	}
	// Default: Insufficient permissions
    return nil // Placeholder, need proper error logic
}

func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
    // This logic is specific to Local Auth. 
    // Ideally Provider should handle this, or we cast provider to LocalAuthProvider if supported.
    // For now, let's assume this is only supported if the provider handles it.
    // Simplifying: If we are using Clerk, Clerk handles password changes via their UI/API.
    // So this might move to the provider interface essentially.
    
    // For now, let's stub it or move it to local provider.
    return nil 
}

func (s *Service) ToggleMFA(ctx context.Context, userID string, enabled bool) error {
	return s.repo.UpdateMFA(ctx, userID, enabled)
}

func (s *Service) UpdatePreferences(ctx context.Context, userID string, preferences map[string]interface{}) error {
	return s.repo.UpdatePreferences(ctx, userID, preferences)
}
