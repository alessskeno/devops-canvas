package auth

import (
	"context"
	"devops-canvas-backend/internal/models"
	"errors"
)

// ClerkAuthProvider implements auth.AuthProvider using Clerk
type ClerkAuthProvider struct {
    // clerkClient *clerk.Client (Add SDK later)
}

func NewClerkAuthProvider() *ClerkAuthProvider {
	return &ClerkAuthProvider{}
}

func (p *ClerkAuthProvider) Register(ctx context.Context, req models.CreateUserRequest) (*models.AuthResponse, error) {
	return nil, errors.New("registration handled by Clerk frontend")
}

func (p *ClerkAuthProvider) RegisterWithRole(ctx context.Context, req models.CreateUserRequest, role string) (*models.AuthResponse, error) {
    return nil, errors.New("registration with role handled by Clerk frontend")
}

func (p *ClerkAuthProvider) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	return nil, errors.New("login handled by Clerk frontend")
}

func (p *ClerkAuthProvider) VerifyToken(ctx context.Context, token string) (string, error) {
	return "", errors.New("clerk auth provider is not implemented; use local auth or complete Clerk integration")
}

func (p *ClerkAuthProvider) GetUser(ctx context.Context, userID string) (*models.User, error) {
	return nil, errors.New("clerk auth provider is not implemented")
}

func (p *ClerkAuthProvider) UpdateProfile(ctx context.Context, userID string, req models.UpdateProfileRequest) (*models.User, error) {
    // TODO: Update in Clerk
    return &models.User{ID: userID, Name: req.Name}, nil
}
