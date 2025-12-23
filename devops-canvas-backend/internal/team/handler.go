package team

import (
    "encoding/json"
    "net/http"

	"devops-canvas-backend/internal/auth"
	"devops-canvas-backend/internal/models"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
    svc     *Service
    authSvc *auth.Service // Needed for token parsing if not using context middleware yet
}

func NewHandler(svc *Service, authSvc *auth.Service) *Handler {
    return &Handler{svc: svc, authSvc: authSvc}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
    r.Route("/auth/team", func(r chi.Router) { // Nested under auth for now or separate? Plan said /team
        // Using /team but authentication is required.
    })
    
    // In main, we mount at /api. So this will be /api/team
    r.Route("/team", func(r chi.Router) {
        // Here we really need Auth Middleware.
        // For MVP, I will parse token in handler manually like auth handler did, 
        // OR ideally I should fix this to use middleware, but staying consistent with `auth/handler.go` pattern for now.
        r.Get("/members", h.ListMembers)
        r.Post("/invite", h.InviteMember)
        r.Put("/members/{id}/role", h.UpdateRole)
        r.Delete("/members/{id}", h.RemoveMember)
        r.Post("/accept-invite", h.AcceptInvite) // Public endpoint
    })
}

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
    // Verify Auth (Quick Manual Check)
    if _, err := h.getUserId(r); err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    members, err := h.svc.ListMembers(r.Context())
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(members)
}

func (h *Handler) InviteMember(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // RBAC: Only Owner and Admin can invite
    if err := h.authSvc.CheckRole(r.Context(), userID, "Owner", "Admin"); err != nil {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions to invite members")
        return
    }

    var req InviteRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.respondError(w, http.StatusBadRequest, "Invalid request")
        return
    }

    if err := h.svc.InviteMember(r.Context(), req.Email, req.Role, userID); err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to invite member")
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Invitation sent"})
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
    // Verify permission: Only Owner can update roles
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    currentUser, err := h.authSvc.GetUser(r.Context(), userID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to fetch user profile")
        return
    }

    if currentUser.Role != "Owner" {
        h.respondError(w, http.StatusForbidden, "Only owners can manage roles")
        return
    }

    memberID := chi.URLParam(r, "id")

    // Prevent affecting oneself
    if memberID == userID {
        h.respondError(w, http.StatusBadRequest, "Cannot change your own role")
        return
    }

    var req UpdateRoleRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.respondError(w, http.StatusBadRequest, "Invalid request")
        return
    }

    if err := h.svc.UpdateMemberRole(r.Context(), memberID, req.Role); err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to update role")
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Role updated"})
}

func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
    userID, err := h.getUserId(r)
    if err != nil {
        h.respondError(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    memberID := chi.URLParam(r, "id")

    // Prevent self-deletion
    if memberID == userID {
        h.respondError(w, http.StatusBadRequest, "Cannot remove yourself from the team")
        return
    }

    // RBAC Logic
    currentUser, err := h.authSvc.GetUser(r.Context(), userID)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to fetch user profile")
        return
    }

    targetUser, err := h.authSvc.GetUser(r.Context(), memberID)
    if err != nil {
        h.respondError(w, http.StatusNotFound, "Member not found")
        return
    }

    allowed := false
    if currentUser.Role == "Owner" {
        allowed = true
    } else if currentUser.Role == "Admin" {
        // Admin can remove Editor/Viewer, but not Owner or Admin
        if targetUser.Role != "Owner" && targetUser.Role != "Admin" {
            allowed = true
        }
    }

    if !allowed {
        h.respondError(w, http.StatusForbidden, "Insufficient permissions to remove this member")
        return
    }

    if err := h.svc.RemoveMember(r.Context(), memberID); err != nil {
        h.respondError(w, http.StatusInternalServerError, "Failed to remove member")
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"message": "Member removed"})
}

func (h *Handler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Token    string `json:"token"`
        Name     string `json:"name"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.respondError(w, http.StatusBadRequest, "Invalid request")
        return
    }

    // 1. Validate Invitation
    invite, err := h.svc.GetInvitationByToken(r.Context(), req.Token)
    if err != nil {
        h.respondError(w, http.StatusBadRequest, "Invalid or expired invitation")
        return
    }

    // 2. Create User
    createUserReq := models.CreateUserRequest{
        Email:    invite.Email,
        Password: req.Password,
        Name:     req.Name,
    }
    authResponse, err := h.authSvc.RegisterWithRole(r.Context(), createUserReq, invite.Role)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err.Error())
        return
    }

    // 3. Mark Invitation Accepted
    if err := h.svc.MarkInvitationAccepted(r.Context(), req.Token); err != nil {
        // Log error but don't fail the request as user is already created
        // In real app, might want transactional integrity
    }

    // 4. Return Auth Response
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(authResponse)
}

// Helper to extract userID from token
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
