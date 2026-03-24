package auth

import (
	"context"
	"errors"
	"os"
	"time"

	"devops-canvas-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// LocalAuthProvider implements AuthProvider using local DB and JWTs
type LocalAuthProvider struct {
	repo *Repository
}

func NewLocalAuthProvider(repo *Repository) *LocalAuthProvider {
	return &LocalAuthProvider{repo: repo}
}

func (p *LocalAuthProvider) Register(ctx context.Context, req models.CreateUserRequest) (*models.AuthResponse, error) {
	// Check if user exists
	_, _, err := p.repo.GetUserByEmail(ctx, req.Email)
	if err == nil {
		return nil, ErrEmailTaken
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user, err := p.repo.CreateUser(ctx, req.Email, string(hashed), req.Name)
	if err != nil {
		return nil, err
	}

	// Generate Token
	token, err := p.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (p *LocalAuthProvider) RegisterWithRole(ctx context.Context, req models.CreateUserRequest, role string) (*models.AuthResponse, error) {
	// Check if user exists
	_, _, err := p.repo.GetUserByEmail(ctx, req.Email)
	if err == nil {
		return nil, ErrEmailTaken
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user, err := p.repo.CreateUserWithRole(ctx, req.Email, string(hashed), req.Name, role)
	if err != nil {
		return nil, err
	}

	// Generate Token
	token, err := p.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (p *LocalAuthProvider) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	user, hash, err := p.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Generate Token
	token, err := p.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (p *LocalAuthProvider) GetUser(ctx context.Context, userID string) (*models.User, error) {
	user, _, err := p.repo.GetUserByID(ctx, userID)
	return user, err
}

func (p *LocalAuthProvider) UpdateProfile(ctx context.Context, userID string, req models.UpdateProfileRequest) (*models.User, error) {
	user := &models.User{
		ID:       userID,
		Name:     req.Name,
		Email:    req.Email,
		JobTitle: req.JobTitle,
	}

	if err := p.repo.UpdateUser(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (p *LocalAuthProvider) VerifyToken(ctx context.Context, tokenString string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET is not configured")
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

	// Verify user exists in DB to prevent deleted users from accessing
	if _, _, err := p.repo.GetUserByID(ctx, sub); err != nil {
		return "", errors.New("user not found or invalid")
	}

	return sub, nil
}

func (p *LocalAuthProvider) generateToken(userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET is not configured")
	}

	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
