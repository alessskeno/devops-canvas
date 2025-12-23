package workspace

import (
    "encoding/json"
    "net/http"
    "github.com/go-chi/chi/v5"
    "devops-canvas-backend/internal/auth"
)

type Handler struct {
    svc     *Service
    authSvc *auth.Service
}

func NewHandler(svc *Service, authSvc *auth.Service) *Handler {
    return &Handler{svc: svc, authSvc: authSvc}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
    r.Route("/workspaces", func(r chi.Router) {
        r.Get("/", h.ListWorkspaces)
        r.Post("/", h.CreateWorkspace)
        r.Put("/{id}", h.UpdateWorkspace)
        r.Delete("/{id}", h.DeleteWorkspace)
    })
}

func (h *Handler) ListWorkspaces(w http.ResponseWriter, r *http.Request) {
    // Everyone can list (Viewer included)
    if _, err := h.getUserId(r); err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }
    
    list, _ := h.svc.ListWorkspaces(r.Context())
    json.NewEncoder(w).Encode(list)
}

func (h *Handler) CreateWorkspace(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Owner, Admin, Editor can create
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin", "Editor"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions to create workspace")
        return
    }

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"message": "Workspace created (stub)"})
}

func (h *Handler) UpdateWorkspace(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Owner, Admin, Editor can update
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin", "Editor"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions to update workspace")
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Workspace updated (stub)"})
}

func (h *Handler) DeleteWorkspace(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Only OWNER can delete workspace
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner"); err != nil {
        h.respondError(w, http.StatusForbidden, "Only owners can delete workspaces")
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Workspace deleted (stub)"})
}

func (h *Handler) getUserId(r *http.Request) (string, error) {
    tokenString := r.Header.Get("Authorization")
    if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
        tokenString = tokenString[7:]
    }
    return h.authSvc.ParseToken(tokenString)
}

func (h *Handler) respondError(w http.ResponseWriter, code int, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(map[string]string{
        "message": message,
        "code":    http.StatusText(code),
    })
}
