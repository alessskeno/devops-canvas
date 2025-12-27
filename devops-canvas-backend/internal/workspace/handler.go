package workspace

import (
    "encoding/json"
    "net/http"
    "strings"
    "github.com/go-chi/chi/v5"
    "devops-canvas-backend/internal/auth"
    "devops-canvas-backend/internal/models"
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
        r.Put("/{id}", h.UpdateWorkspace)
        r.Post("/{id}/duplicate", h.DuplicateWorkspace)
        r.Delete("/{id}", h.DeleteWorkspace)
        r.Get("/{id}/canvas", h.GetCanvas)
        r.Put("/{id}/canvas", h.SaveCanvas)
    })
}

func (h *Handler) DuplicateWorkspace(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Check if user has permission to CREATE workspaces (since duplication creates one)
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin", "Editor"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions to create (duplicate) workspace")
        return
    }

    workspaceID := chi.URLParam(r, "id")
    ws, err := h.svc.DuplicateWorkspace(r.Context(), workspaceID, userID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to duplicate workspace: "+err.Error())
        return
    }

    w.WriteHeader(http.StatusOK) // Or Created? StatusOK is fine.
    json.NewEncoder(w).Encode(ws)
}

func (h *Handler) ListWorkspaces(w http.ResponseWriter, r *http.Request) {
	// Everyone can list (Viewer included)
	userID, err := h.getUserId(r)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	
	list, err := h.svc.ListWorkspaces(r.Context(), userID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }

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

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Visibility  string `json:"visibility"`
		Environment string `json:"environment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		req.Name = "New Workspace"
	}

	ws, err := h.svc.CreateWorkspace(r.Context(), req.Name, req.Description, req.Environment, req.Visibility, userID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create workspace: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ws)
}

func (h *Handler) UpdateWorkspace(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserId(r)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// 1. Check Global Admin
	if err := h.authSvc.CheckRole(r.Context(), userID, "Admin"); err == nil {
		// Allowed
	} else {
		// 2. Check Workspace Membership Role
		// We need the ID from the URL first, which is extracted below, but we need it now for permission check.
		// Let's refactor slightly to get ID first.
		workspaceID := chi.URLParam(r, "id")
		role, err := h.svc.GetMemberRole(r.Context(), workspaceID, userID)
		if err != nil {
			// If error (e.g. not found), deny
			h.respondError(w, http.StatusForbidden, "Insufficient permissions to update workspace")
			return
		}
		if role != "owner" && role != "editor" {
			h.respondError(w, http.StatusForbidden, "Insufficient permissions (must be Owner or Editor)")
			return
		}
		// Allowed
	}

	workspaceID := chi.URLParam(r, "id")
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ws, err := h.svc.UpdateWorkspace(r.Context(), workspaceID, req, userID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update workspace: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ws)
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

    workspaceID := chi.URLParam(r, "id")
    if err := h.svc.DeleteWorkspace(r.Context(), workspaceID); err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to delete workspace: "+err.Error())
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Workspace deleted"})
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

func (h *Handler) GetCanvas(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    // Permission check: Viewer can see? Yes.
    // TODO: Verify user access to workspace explicitly if not covered by route middleware or simple ownership checks yet
    
    canvas, err := h.svc.GetCanvas(r.Context(), id)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }
    
    json.NewEncoder(w).Encode(canvas)
}

func (h *Handler) SaveCanvas(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Permission Check
    // Permission Check
    isAllowed := false

    // 1. Global Admin can always save
    if err := h.authSvc.CheckRole(r.Context(), userID, "Admin"); err == nil {
        isAllowed = true
    }

    if !isAllowed {
        // 2. Check Workspace Visibility and Global Permissions
        // We need to fetch workspace metadata first
        ws, err := h.svc.GetWorkspace(r.Context(), id)
        if err != nil {
            h.respondError(w, http.StatusNotFound, "Workspace not found")
            return
        }

        // If Public or Team, allow Editors
        if ws.Visibility == "public" || ws.Visibility == "team" {
             if err := h.authSvc.CheckRole(r.Context(), userID, "Editor", "Owner"); err == nil {
                 isAllowed = true
             }
        }
    }

    if !isAllowed {
        // 3. Workspace Member Check (Private workspaces or Viewers)
        role, err := h.svc.GetMemberRole(r.Context(), id, userID)
        if err == nil {
            roleLower := strings.ToLower(role)
            if roleLower == "owner" || roleLower == "editor" || roleLower == "admin" {
                 isAllowed = true
            }
        }
    }
    
    if !isAllowed {
         h.respondError(w, http.StatusForbidden, "Access denied: Insufficient permissions to save this workspace")
         return
    }

    var state models.CanvasState
    if err := json.NewDecoder(r.Body).Decode(&state); err != nil {
        h.respondError(w, http.StatusBadRequest, "Invalid request body")
        return
    }

    if err := h.svc.SaveCanvas(r.Context(), id, userID, state); err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}
