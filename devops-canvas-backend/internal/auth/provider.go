package auth

import (
	"context"
	"devops-canvas-backend/internal/models"
)

// AuthProvider defines the interface for authentication strategies (Local, Clerk, etc.)
type AuthProvider interface {
	Register(ctx context.Context, req models.CreateUserRequest) (*models.AuthResponse, error)
	Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error)
    RegisterWithRole(ctx context.Context, req models.CreateUserRequest, role string) (*models.AuthResponse, error)
    VerifyToken(ctx context.Context, token string) (string, error) // Returns UserID
	GetUser(ctx context.Context, userID string) (*models.User, error)
    UpdateProfile(ctx context.Context, userID string, req models.UpdateProfileRequest) (*models.User, error)
}
