package translator

import (
	"encoding/json"
	"fmt"
	"strconv"

	"devops-canvas-backend/internal/models"
)

// defaultPort safely parses an unknown port value from JSON into an integer, using a fallback.
func defaultPort(val any, def int) int {
	if val == nil {
		return def
	}
	switch v := val.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case string:
		if p, err := strconv.Atoi(v); err == nil {
			return p
		}
	}
	return def
}

// NodeEnabledForDeploy returns false when node.Data explicitly sets enabled to false (omitted or true = deploy).
func NodeEnabledForDeploy(node models.Node) bool {
	var c struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.Unmarshal(node.Data, &c); err == nil && c.Enabled != nil && !*c.Enabled {
		return false
	}
	return true
}

// ComposeServiceNameForNode matches deploy.resolveServiceNameForNode (type-id4 or custom serviceName).
func ComposeServiceNameForNode(node models.Node) string {
	name := fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
	var u UniversalNodeConfig
	if err := json.Unmarshal(node.Data, &u); err == nil && u.ServiceName != "" {
		name = u.ServiceName
	}
	return name
}
