package deploy

import (
    "encoding/json"
    "net/http"
    "github.com/go-chi/chi/v5"
    "devops-canvas-backend/internal/auth"
    "devops-canvas-backend/internal/deploy/translator"
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
        r.Post("/{workspaceID}/teardown", h.TeardownWorkspace)
        r.Post("/{workspaceID}/manifests", h.GenerateManifests)
        r.Get("/{deployID}/logs", h.GetLogs)
    })
    
    // Config related routes
    r.Route("/components", func(r chi.Router) {
        r.Get("/{type}/versions", h.GetVersions)
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
    status, err := h.svc.DeployWorkspace(r.Context(), workspaceID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, "Deployment failed: "+err.Error())
        return
    }
    
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Deployment successful",
        "status": status,
        "deployID": workspaceID, // For now, deployID IS workspaceID
    })
}

func (h *Handler) TeardownWorkspace(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin", "Editor"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions")
        return
    }

    workspaceID := chi.URLParam(r, "workspaceID")
    if err := h.svc.TeardownWorkspace(r.Context(), workspaceID); err != nil {
        h.respondError(w, http.StatusInternalServerError, "Teardown failed: "+err.Error())
        return
    }
    
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Teardown initiated",
    })
}

func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
    // Everyone can view logs (Viewer included)
    if _, err := h.getUserId(r); err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }
    
    // In our MVP, deployID is the workspaceID because we overwrite the deployment in /tmp/workspaces/{id}
    workspaceID := chi.URLParam(r, "deployID")
    componentID := r.URL.Query().Get("component_id")

    logs, err := h.svc.GetLogs(r.Context(), workspaceID, componentID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }
    
    json.NewEncoder(w).Encode(map[string]interface{}{
        "logs": logs,
    })
}

func (h *Handler) GenerateManifests(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Role check (Viewer can also preview manifests?)
    // Let's allow Viewer to preview.
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin", "Editor", "Viewer"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions")
        return
    }

    workspaceID := chi.URLParam(r, "workspaceID")
    manifests, err := h.svc.GenerateManifests(r.Context(), workspaceID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(manifests)
}

func (h *Handler) getUserId(r *http.Request) (string, error) {
    tokenString := r.Header.Get("Authorization")
    if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
        tokenString = tokenString[7:]
    }
    return h.authSvc.ParseToken(tokenString)
}



func (h *Handler) GetVersions(w http.ResponseWriter, r *http.Request) {
    if _, err := h.getUserId(r); err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    componentType := chi.URLParam(r, "type")
    
    versions, err := translator.GetAvailableVersions(componentType)
    if err != nil {
        h.respondError(w, http.StatusBadRequest, err.Error())
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(versions)
}

func (h *Handler) respondError(w http.ResponseWriter, code int, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(map[string]string{
        "message": message,
        "code":    http.StatusText(code),
    })
}
