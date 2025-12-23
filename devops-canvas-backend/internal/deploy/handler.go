package deploy

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
    r.Route("/deploy", func(r chi.Router) {
        r.Post("/{workspaceID}", h.DeployWorkspace)
        r.Get("/{deployID}/logs", h.GetLogs)
    })
}

func (h *Handler) DeployWorkspace(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Owner, Admin, Editor can deploy
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin", "Editor"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions to deploy")
        return
    }

    workspaceID := chi.URLParam(r, "workspaceID")
    deployID, _ := h.svc.DeployWorkspace(r.Context(), workspaceID)
    
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Deployment started (stub)",
        "deployID": deployID,
    })
}

func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
    // Everyone can view logs (Viewer included)
    if _, err := h.getUserId(r); err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }
    
    deployID := chi.URLParam(r, "deployID")
    logs, _ := h.svc.GetLogs(r.Context(), deployID)
    
    json.NewEncoder(w).Encode(map[string]interface{}{
        "logs": logs,
    })
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
