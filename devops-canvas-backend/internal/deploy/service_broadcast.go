package deploy

import (
	"encoding/json"
	"regexp"
	"strings"
)

// maxDeployStepDetail is the most raw error text we send over the WebSocket for a failed step (modal + polling UIs).
const maxDeployStepDetail = 4000

func (s *Service) broadcastStep(workspaceID, step, status, label, details string) {
	if s.hub == nil {
		return
	}

	// Sanitize error details for user-friendly display
	if status == "error" && details != "" {
		details = sanitizeDeployError(details)
	}

	msg := map[string]interface{}{
		"type":         "deployment.step",
		"workspace_id": workspaceID,
		"payload": map[string]string{
			"step":    step,
			"status":  status,
			"label":   label,
			"details": details,
		},
	}

	jsonBytes, err := json.Marshal(msg)
	if err == nil {
		s.hub.Broadcast <- jsonBytes
	}
}

// sanitizeDeployError converts raw Docker/docker-compose error output into
// concise, actionable messages that developers can understand at a glance.
func sanitizeDeployError(raw string) string {
	lower := strings.ToLower(raw)

	// --- Port Conflicts ---
	// "Bind for 0.0.0.0:8080 failed: port is already allocated"
	portRe := regexp.MustCompile(`[Bb]ind for [^:]+:(\d+) failed: port is already allocated`)
	if matches := portRe.FindStringSubmatch(raw); len(matches) > 1 {
		return "Port " + matches[1] + " is already in use. Change the Host Port in your component config or stop the service using that port."
	}

	// --- Dockerfile Not Found ---
	if strings.Contains(lower, "failed to read dockerfile") || strings.Contains(lower, "no such file or directory") && strings.Contains(lower, "dockerfile") {
		return "Dockerfile not found in the build context. Make sure your uploaded folder contains a Dockerfile at the root level."
	}

	// --- Build Context File Missing ---
	// COPY src/ /app/src/ → "/src": not found
	copyRe := regexp.MustCompile(`failed to calculate checksum.*"(/[^"]+)": not found`)
	if matches := copyRe.FindStringSubmatch(raw); len(matches) > 1 {
		return "Build failed: file or directory '" + matches[1] + "' not found. Check your Dockerfile COPY/ADD instructions — the referenced path doesn't exist in the uploaded source."
	}

	// --- Container Restart Loop ---
	restartRe := regexp.MustCompile(`container ([^\s]+) is in a restart loop`)
	if matches := restartRe.FindStringSubmatch(raw); len(matches) > 1 {
		return "Container '" + matches[1] + "' keeps crashing and restarting. Check the Logs tab for application errors."
	}

	// --- Image Pull Failures ---
	if strings.Contains(lower, "pull access denied") || strings.Contains(lower, "repository does not exist") {
		imageRe := regexp.MustCompile(`pull access denied for ([^\s,]+)`)
		if matches := imageRe.FindStringSubmatch(raw); len(matches) > 1 {
			return "Image '" + matches[1] + "' not found. Check the image name/version or make sure you have access to the registry."
		}
		return "Docker image not found. Check the image name and version in your component config."
	}

	// --- Network Errors ---
	if strings.Contains(lower, "network") && strings.Contains(lower, "failed") {
		return "Docker network setup failed. Try tearing down the workspace first, then deploy again."
	}

	// --- Disk Space ---
	if strings.Contains(lower, "no space left on device") {
		return "No disk space available. Free up space with 'docker system prune' or increase disk allocation."
	}

	// --- Timeout ---
	if strings.Contains(lower, "timeout") || strings.Contains(lower, "deadline exceeded") {
		return "Operation timed out. The deployment is taking longer than expected. Check your network connection and try again."
	}

	// --- Permission Denied ---
	if strings.Contains(lower, "permission denied") {
		return "Permission denied. Check that file permissions are correct in your source directory."
	}

	// --- OOM / Memory ---
	if strings.Contains(lower, "out of memory") || strings.Contains(lower, "oom") {
		return "Container ran out of memory. Increase the memory limit or optimize your application."
	}

	// --- Bind mount / OCI: send the daemon line only (hint lives in deploy docs; avoids repeating the same wall of text in toast + modal + log) ---
	if strings.Contains(lower, "error mounting") || strings.Contains(lower, "failed to create shim") ||
		strings.Contains(lower, "oci runtime create failed") || strings.Contains(lower, "runc create failed") {
		detail := extractDaemonDetailLine(raw)
		if detail == "" {
			detail = strings.TrimSpace(raw)
		}
		return trimForDeployDetail(detail, maxDeployStepDetail)
	}

	// --- Generic: Try to extract the last meaningful line ---
	// Docker output often has a useful error at the end after "Error response from daemon:"
	if idx := strings.LastIndex(raw, "Error response from daemon:"); idx != -1 {
		errMsg := strings.TrimSpace(raw[idx+len("Error response from daemon:"):])
		return trimForDeployDetail("Error: "+errMsg, maxDeployStepDetail)
	}

	// Fallback: truncate very long raw messages
	if len(raw) > maxDeployStepDetail {
		lines := strings.Split(raw, "\n")
		for i := len(lines) - 1; i >= 0; i-- {
			line := strings.TrimSpace(lines[i])
			if line != "" && (strings.Contains(strings.ToLower(line), "error") || strings.Contains(strings.ToLower(line), "failed")) {
				return trimForDeployDetail(line, maxDeployStepDetail)
			}
		}
		return trimForDeployDetail(raw, maxDeployStepDetail)
	}

	return raw
}

func extractDaemonDetailLine(raw string) string {
	lines := strings.Split(raw, "\n")
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		l := strings.ToLower(line)
		if strings.Contains(l, "error mounting") || strings.Contains(l, "error response from daemon") ||
			strings.Contains(l, "failed to create shim") || strings.Contains(l, "oci runtime") {
			return line
		}
	}
	return ""
}

func trimForDeployDetail(s string, max int) string {
	if max <= 10 {
		return s
	}
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max-1]) + "…"
}
