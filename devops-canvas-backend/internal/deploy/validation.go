package deploy

import (
	"encoding/json"
	"fmt"
	"strings"

	"devops-canvas-backend/internal/deploy/translator"
	"devops-canvas-backend/internal/models"
)

// requiredField describes a mandatory tool-option field for a component type (JSON key in node.Data and human-readable label).
type requiredField struct {
	DataKey string // key in node.Data (e.g. "root_password", "password")
	Label   string // human-readable name for error message (e.g. "Root Password")
}

// requiredFieldsByType defines mandatory fields per component type. If a field is missing or empty, deployment fails.
var requiredFieldsByType = map[string][]requiredField{
	"mysql":    {{DataKey: "root_password", Label: "Root Password"}},
	"mariadb":  {{DataKey: "root_password", Label: "Root Password"}},
	"postgres": {{DataKey: "password", Label: "Password"}},
	"rabbitmq": {{DataKey: "default_pass", Label: "Default Password"}},
	"mongodb":  {{DataKey: "root_username", Label: "Root Username"}, {DataKey: "root_password", Label: "Root Password"}},
	"minio":    {{DataKey: "root_user", Label: "Root User"}, {DataKey: "root_password", Label: "Root Password"}},
	"keycloak": {{DataKey: "admin_user", Label: "Admin User"}, {DataKey: "admin_password", Label: "Admin Password"}},
	"vault":    {{DataKey: "dev_root_token", Label: "Dev Root Token"}},
	"influxdb": {{DataKey: "username", Label: "Username"}, {DataKey: "password", Label: "Password"}},
	"grafana":  {{DataKey: "admin_user", Label: "Admin User"}, {DataKey: "admin_password", Label: "Admin Password"}},
	"neo4j": {{DataKey: "auth_password", Label: "Auth Password"}},
}

// ValidateCanvasForDeploy enforces hard requirements before manifests are generated or Docker runs:
//   - Required credentials / fields per component type (requiredFieldsByType)
//   - MinIO root user/password minimum lengths
//   - Kong ↔ PostgreSQL: at most one Postgres neighbor, neighbor must be enabled; explicit "postgres"
//     database mode requires a canvas connection to Postgres
//   - Supabase Auth (GoTrue): exactly one enabled PostgreSQL neighbor; DB URL is generated from that node
func ValidateCanvasForDeploy(canvas *models.CanvasState) error {
	for _, node := range canvas.Nodes {
		if node.Type == "group" || node.Type == "file" {
			continue
		}
		var data map[string]interface{}
		if err := json.Unmarshal(node.Data, &data); err != nil {
			continue
		}
		label := componentLabel(data)

		if required, ok := requiredFieldsByType[node.Type]; ok && len(required) > 0 {
			for _, f := range required {
				val := getDataValue(data, f.DataKey)
				if isEmpty(val) {
					return fmt.Errorf("component %q: field %q is not configured or set", label, f.Label)
				}
			}
		}
		if node.Type == "minio" {
			if err := validateMinioCredentialLengths(data, label); err != nil {
				return err
			}
		}
		if err := validateKongGuardrails(canvas, node, data, label); err != nil {
			return err
		}
		if err := validateSupabaseGuardrails(canvas, node, label); err != nil {
			return err
		}
	}
	return nil
}

func componentLabel(data map[string]interface{}) string {
	if l, ok := data["label"].(string); ok && strings.TrimSpace(l) != "" {
		return strings.TrimSpace(l)
	}
	return "Unnamed"
}

func getDataValue(data map[string]interface{}, key string) interface{} {
	v, ok := data[key]
	if !ok {
		return nil
	}
	return v
}

func validateMinioCredentialLengths(data map[string]interface{}, label string) error {
	user := strings.TrimSpace(fmt.Sprint(getDataValue(data, "root_user")))
	pass := strings.TrimSpace(fmt.Sprint(getDataValue(data, "root_password")))
	if len(user) < 3 {
		return fmt.Errorf("component %q: MinIO Root User must be at least 3 characters (required by MinIO)", label)
	}
	if len(pass) < 8 {
		return fmt.Errorf("component %q: MinIO Root Password must be at least 8 characters (required by MinIO)", label)
	}
	return nil
}

func validateKongGuardrails(canvas *models.CanvasState, node models.Node, data map[string]interface{}, label string) error {
	if node.Type != "kong" {
		return nil
	}
	pgNeighbors := kongPostgresNeighborIDs(canvas, node.ID)
	dbMode := strings.ToLower(strings.TrimSpace(fmt.Sprint(getDataValue(data, "database"))))

	if len(pgNeighbors) > 1 {
		return fmt.Errorf("component %q: Kong is connected to more than one PostgreSQL node; connect exactly one PostgreSQL component", label)
	}
	for _, pid := range pgNeighbors {
		pn := findCanvasNodeByID(canvas, pid)
		if pn == nil {
			continue
		}
		if !translator.NodeEnabledForDeploy(*pn) {
			return fmt.Errorf("component %q: Kong is connected to a disabled PostgreSQL node; enable that database or remove the connection", label)
		}
	}

	if dbMode == "postgres" && len(pgNeighbors) == 0 {
		return fmt.Errorf("component %q: Kong Database is set to PostgreSQL but no PostgreSQL node is connected on the canvas; add a connection or set Database to \"off (DB-less)\"", label)
	}
	return nil
}

func validateSupabaseGuardrails(canvas *models.CanvasState, node models.Node, label string) error {
	if node.Type != "supabase" {
		return nil
	}
	ids := postgresNeighborIDsForNode(canvas, node.ID)
	if len(ids) == 0 {
		return fmt.Errorf("component %q: Supabase Auth (GoTrue) requires a PostgreSQL node on the canvas; connect this component to PostgreSQL", label)
	}
	if len(ids) > 1 {
		return fmt.Errorf("component %q: connect Supabase Auth to at most one PostgreSQL node", label)
	}
	pn := findCanvasNodeByID(canvas, ids[0])
	if pn != nil && !translator.NodeEnabledForDeploy(*pn) {
		return fmt.Errorf("component %q: connected PostgreSQL is disabled; enable it or remove the connection", label)
	}
	return nil
}

func postgresNeighborIDsForNode(canvas *models.CanvasState, nodeID string) []string {
	var ids []string
	seen := make(map[string]bool)
	for _, conn := range canvas.Connections {
		otherID := ""
		switch {
		case conn.SourceID == nodeID:
			otherID = conn.TargetID
		case conn.TargetID == nodeID:
			otherID = conn.SourceID
		}
		if otherID == "" || seen[otherID] {
			continue
		}
		for _, n := range canvas.Nodes {
			if n.ID == otherID && n.Type == "postgres" {
				ids = append(ids, otherID)
				seen[otherID] = true
				break
			}
		}
	}
	return ids
}

func kongPostgresNeighborIDs(canvas *models.CanvasState, kongNodeID string) []string {
	return postgresNeighborIDsForNode(canvas, kongNodeID)
}

func findCanvasNodeByID(canvas *models.CanvasState, id string) *models.Node {
	for i := range canvas.Nodes {
		if canvas.Nodes[i].ID == id {
			return &canvas.Nodes[i]
		}
	}
	return nil
}

func isEmpty(v interface{}) bool {
	if v == nil {
		return true
	}
	switch x := v.(type) {
	case string:
		return strings.TrimSpace(x) == ""
	case []interface{}:
		return len(x) == 0
	case map[string]interface{}:
		return len(x) == 0
	default:
		return false
	}
}
