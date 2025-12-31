package deploy

import (
    "encoding/json"
)

func (s *Service) broadcastStep(workspaceID, step, status, label, details string) {
    if s.hub == nil { return }
    
    msg := map[string]interface{}{
        "type": "deployment.step",
        "workspace_id": workspaceID, // Add workspace_id so frontend can filter
        "payload": map[string]string{
            "step": step,
            "status": status,
            "label": label,
            "details": details,
        },
    }
    
    jsonBytes, err := json.Marshal(msg)
    if err == nil {
        s.hub.Broadcast <- jsonBytes
    }
}
