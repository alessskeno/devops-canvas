package models

import (
	"time"
)

type User struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	JobTitle   string    `json:"job_title"`
	Password   string    `json:"-"` // Never return password hash
	MFAEnabled bool      `json:"mfa_enabled"`
	Preferences  map[string]interface{} `json:"preferences"`
	Role       string    `json:"role"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UpdateProfileRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	JobTitle string `json:"job_title"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type ToggleMFARequest struct {
	Enabled bool `json:"enabled"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
