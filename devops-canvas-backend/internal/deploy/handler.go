package deploy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"devops-canvas-backend/internal/auth"
	"devops-canvas-backend/internal/deploy/translator"
	"github.com/go-chi/chi/v5"
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
		r.Get("/{workspaceID}/terminal", h.HandleTerminal)
		r.Post("/{workspaceID}/upload-context", h.UploadBuildContext)
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
		"message":  "Deployment successful",
		"status":   status,
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

// UploadBuildContext handles multipart file uploads for custom container build contexts.
// Files are saved preserving their directory structure to /tmp/contexts/{workspaceID}-{componentID}/
//
// The frontend sends:
//   - 'files': multipart file fields (one per file)
//   - 'paths': a JSON array of relative paths (webkitRelativePath) in the same order as files
//
// This is needed because Go's mime/multipart package sanitizes filenames,
// stripping directory components (e.g., "myapp/src/main.py" → "main.py").
func (h *Handler) UploadBuildContext(w http.ResponseWriter, r *http.Request) {
	if _, err := h.getUserId(r); err != nil {
		h.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	workspaceID := chi.URLParam(r, "workspaceID")
	componentID := r.URL.Query().Get("component_id")
	if componentID == "" {
		h.respondError(w, http.StatusBadRequest, "component_id query parameter is required")
		return
	}

	// Parse multipart form — 500MB max
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		h.respondError(w, http.StatusBadRequest, "Failed to parse upload: "+err.Error())
		return
	}

	contextID := fmt.Sprintf("%s-%s", workspaceID, componentID)
	contextDir := filepath.Join("/tmp/contexts", contextID)

	// Clean previous upload
	_ = os.RemoveAll(contextDir)
	if err := os.MkdirAll(contextDir, 0755); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create context directory: "+err.Error())
		return
	}

	// Read the paths JSON array sent alongside files
	pathsJSON := r.FormValue("paths")
	var paths []string
	if pathsJSON != "" {
		if err := json.Unmarshal([]byte(pathsJSON), &paths); err != nil {
			h.respondError(w, http.StatusBadRequest, "Invalid paths JSON: "+err.Error())
			return
		}
	}

	fileHeaders := r.MultipartForm.File["files"]
	fileCount := 0
	hasDockerfile := false

	for i, fh := range fileHeaders {
		// Get the relative path from the paths array
		var relPath string
		if i < len(paths) {
			relPath = paths[i]
		} else {
			relPath = fh.Filename // fallback
		}

		// Security: clean and prevent path traversal
		relPath = filepath.Clean(relPath)
		if strings.Contains(relPath, "..") {
			continue
		}

		// Strip the top-level directory name (the selected folder)
		// webkitdirectory prepends the folder name: "myfolder/Dockerfile"
		parts := strings.SplitN(relPath, "/", 2)
		if len(parts) == 2 {
			relPath = parts[1]
		}

		destPath := filepath.Join(contextDir, relPath)

		// Create parent directories
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			continue
		}

		// Open source file
		src, err := fh.Open()
		if err != nil {
			continue
		}

		// Create destination file
		dst, err := os.Create(destPath)
		if err != nil {
			src.Close()
			continue
		}

		_, err = io.Copy(dst, src)
		src.Close()
		dst.Close()

		if err != nil {
			continue
		}

		fileCount++

		// Check if this is the Dockerfile at the root level
		if relPath == "Dockerfile" {
			hasDockerfile = true
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"buildContextId": contextID,
		"fileCount":      fileCount,
		"hasDockerfile":  hasDockerfile,
	})
}
