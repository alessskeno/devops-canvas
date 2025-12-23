package auth

import (
	"encoding/json"
	"net/http"

	"devops-canvas-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/auth/register", h.Register)
	r.Post("/auth/login", h.Login)
	r.Get("/auth/me", h.GetMe)
	r.Put("/auth/profile", h.UpdateProfile)
	r.Put("/auth/password", h.ChangePassword)
	r.Put("/auth/mfa", h.ToggleMFA)
	r.Put("/auth/preferences", h.UpdatePreferences)
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	resp, err := h.svc.Register(r.Context(), req)
	if err != nil {
		if err == ErrEmailTaken {
			h.respondError(w, http.StatusConflict, "Email already taken")
			return
		}
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	resp, err := h.svc.Login(r.Context(), req)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Basic Token Parsing (MVP)
	tokenString := r.Header.Get("Authorization")
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID, err := h.svc.ParseToken(tokenString)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	user, err := h.svc.UpdateProfile(r.Context(), userID, req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{
		"message": message,
		"code":    http.StatusText(code),
	})
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenString := r.Header.Get("Authorization")
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID, err := h.svc.ParseToken(tokenString)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	if err := h.svc.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Password updated successfully"})
}

func (h *Handler) ToggleMFA(w http.ResponseWriter, r *http.Request) {
	var req models.ToggleMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenString := r.Header.Get("Authorization")
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID, err := h.svc.ParseToken(tokenString)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	if err := h.svc.ToggleMFA(r.Context(), userID, req.Enabled); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update MFA")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "MFA settings updated"})
}

func (h *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenString := r.Header.Get("Authorization")
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID, err := h.svc.ParseToken(tokenString)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	if err := h.svc.UpdatePreferences(r.Context(), userID, req); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update preferences")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Preferences updated"})
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID, err := h.svc.ParseToken(tokenString)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	user, err := h.svc.GetUser(r.Context(), userID)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "User not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
