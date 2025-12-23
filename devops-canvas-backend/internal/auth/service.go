package auth

import (
	"context"
	"errors"
	"log"
	"os"
	"time"

	"devops-canvas-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Register(ctx context.Context, req models.CreateUserRequest) (*models.AuthResponse, error) {
	// Check if user exists
	_, _, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err == nil {
		return nil, ErrEmailTaken
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user, err := s.repo.CreateUser(ctx, req.Email, string(hashed), req.Name)
	if err != nil {
		return nil, err
	}

	// Generate Token
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (s *Service) RegisterWithRole(ctx context.Context, req models.CreateUserRequest, role string) (*models.AuthResponse, error) {
	// Check if user exists
	_, _, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err == nil {
		return nil, ErrEmailTaken
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user, err := s.repo.CreateUserWithRole(ctx, req.Email, string(hashed), req.Name, role)
	if err != nil {
		return nil, err
	}

	// Generate Token
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (s *Service) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	user, hash, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Generate Token
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req models.UpdateProfileRequest) (*models.User, error) {
	user := &models.User{
		ID:       userID,
		Name:     req.Name,
		Email:    req.Email,
		JobTitle: req.JobTitle,
	}

	if err := s.repo.UpdateUser(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Service) GetUser(ctx context.Context, userID string) (*models.User, error) {
	// Simple wrapper for now
	user, _, err := s.repo.GetUserByID(ctx, userID)
	return user, err
}

func (s *Service) CheckRole(ctx context.Context, userID string, allowedRoles ...string) error {
	user, _, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	for _, role := range allowedRoles {
		if user.Role == role {
			return nil
		}
	}

	return errors.New("insufficient permissions")
}

func (s *Service) ParseToken(tokenString string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "supersecretkey"
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return "", errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}

	sub, _ := claims["sub"].(string)
	return sub, nil
}

func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	_, currentHash, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	if err := HashCompare(currentHash, currentPassword); err != nil {
		return errors.New("invalid current password")
	}

	newHash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}

	return s.repo.UpdatePassword(ctx, userID, newHash)
}

func (s *Service) ToggleMFA(ctx context.Context, userID string, enabled bool) error {
	// In a real app, we would verify a code here if enabling to ensure the user has the authenticator set up.
	return s.repo.UpdateMFA(ctx, userID, enabled)
}

func (s *Service) UpdatePreferences(ctx context.Context, userID string, preferences map[string]interface{}) error {
	return s.repo.UpdatePreferences(ctx, userID, preferences)
}

func (s *Service) generateToken(userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Println("WARNING: JWT_SECRET not set, using default")
		secret = "supersecretkey"
	}

	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
