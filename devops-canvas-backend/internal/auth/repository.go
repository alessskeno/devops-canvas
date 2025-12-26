package auth

import (
	"context"
	"errors"

	"devops-canvas-backend/internal/db"
	"devops-canvas-backend/internal/models"

	"github.com/jackc/pgx/v5"
)

var ErrUserNotFound = errors.New("user not found")
var ErrEmailTaken = errors.New("email already taken")

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash, name string) (*models.User, error) {
	// Check if this is the first user
	var count int
	err := db.Pool.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&count)
	if err != nil {
		return nil, err
	}

	role := "Viewer"
	if count == 0 {
		role = "Owner"
	}

	sql := `
		INSERT INTO users (email, password_hash, name, job_title, mfa_enabled, role)
		VALUES ($1, $2, $3, '', false, $4)
		RETURNING id, email, name, job_title, mfa_enabled, preferences, role, created_at
	`

	user := &models.User{}
	err = db.Pool.QueryRow(ctx, sql, email, passwordHash, name, role).Scan(
		&user.ID, &user.Email, &user.Name, &user.JobTitle, &user.MFAEnabled, &user.Preferences, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) CreateUserWithRole(ctx context.Context, email, passwordHash, name, role string) (*models.User, error) {
	sql := `
		INSERT INTO users (email, password_hash, name, job_title, mfa_enabled, role)
		VALUES ($1, $2, $3, '', false, $4)
		RETURNING id, email, name, job_title, mfa_enabled, preferences, role, created_at
	`

	user := &models.User{}
	err := db.Pool.QueryRow(ctx, sql, email, passwordHash, name, role).Scan(
		&user.ID, &user.Email, &user.Name, &user.JobTitle, &user.MFAEnabled, &user.Preferences, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return user, nil	
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, string, error) {
	sql := `SELECT id, email, name, job_title, mfa_enabled, preferences, password_hash, role, created_at FROM users WHERE email = $1`

	user := &models.User{}
	var passwordHash string

	err := db.Pool.QueryRow(ctx, sql, email).Scan(
		&user.ID, &user.Email, &user.Name, &user.JobTitle, &user.MFAEnabled, &user.Preferences, &passwordHash, &user.Role, &user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, "", ErrUserNotFound
	}

	if err != nil {
		return nil, "", err
	}

	return user, passwordHash, nil
}

func (r *Repository) UpdateUser(ctx context.Context, user *models.User) error {
	sql := `
		UPDATE users 
		SET name = $1, email = $2, job_title = $3 
		WHERE id = $4
	`
	_, err := db.Pool.Exec(ctx, sql, user.Name, user.Email, user.JobTitle, user.ID)
	return err
}

func (r *Repository) UpdatePassword(ctx context.Context, userID, hashedPassword string) error {
	sql := `UPDATE users SET password_hash = $1 WHERE id = $2`
	_, err := db.Pool.Exec(ctx, sql, hashedPassword, userID)
	return err
}

func (r *Repository) UpdateMFA(ctx context.Context, userID string, enabled bool) error {
	sql := `UPDATE users SET mfa_enabled = $1 WHERE id = $2`
	_, err := db.Pool.Exec(ctx, sql, enabled, userID)
	return err
}

func (r *Repository) UpdatePreferences(ctx context.Context, userID string, preferences map[string]interface{}) error {
	sql := `UPDATE users SET preferences = $1 WHERE id = $2`
	_, err := db.Pool.Exec(ctx, sql, preferences, userID)
	return err
}

func (r *Repository) GetUserByID(ctx context.Context, userID string) (*models.User, string, error) {
	sql := `SELECT id, email, name, job_title, mfa_enabled, preferences, password_hash, role, created_at FROM users WHERE id = $1`

	user := &models.User{}
	var passwordHash string

	err := db.Pool.QueryRow(ctx, sql, userID).Scan(
		&user.ID, &user.Email, &user.Name, &user.JobTitle, &user.MFAEnabled, &user.Preferences, &passwordHash, &user.Role, &user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, "", ErrUserNotFound
	}

	if err != nil {
		return nil, "", err
	}

	return user, passwordHash, nil
}
func (r *Repository) IsSystemConfigured(ctx context.Context) (bool, error) {
	var count int
	err := db.Pool.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
