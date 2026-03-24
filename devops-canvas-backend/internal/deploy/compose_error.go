package deploy

import (
	"errors"
	"strings"
)

// ComposeUpError carries a short user-facing summary and the full docker compose output for logs / API details.
type ComposeUpError struct {
	Summary string
	Full    string
}

func (e *ComposeUpError) Error() string {
	if e == nil {
		return ""
	}
	return e.Summary
}

// AsComposeUpError unwraps a ComposeUpError from err.
func AsComposeUpError(err error) (*ComposeUpError, bool) {
	var cu *ComposeUpError
	if errors.As(err, &cu) {
		return cu, true
	}
	return nil, false
}

const userDeployErrMaxRunes = 900

// SummarizeDockerComposeError returns a short message for HTTP/WebSocket clients and the full text for server logs.
func SummarizeDockerComposeError(output []byte, execErr error) (summary string, full string) {
	full = strings.TrimSpace(string(output))
	if execErr != nil {
		if full != "" {
			full = full + "\n" + execErr.Error()
		} else {
			full = execErr.Error()
		}
	}
	summary = extractComposeFailureSummary(full)
	if summary == "" {
		summary = "Docker Compose could not start all services. Check images, ports, and disk space."
	}
	if len(summary) > userDeployErrMaxRunes {
		summary = summary[:userDeployErrMaxRunes-3] + "..."
	}
	return summary, full
}

func extractComposeFailureSummary(full string) string {
	lines := strings.Split(full, "\n")
	var daemonErrors []string
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		if strings.Contains(lower, "the attribute 'version' is obsolete") {
			continue
		}
		if strings.Contains(lower, "error mounting") || strings.Contains(lower, "failed to create shim") ||
			strings.Contains(lower, "oci runtime create failed") {
			return trimComposeLine(line)
		}
		if strings.Contains(lower, "failed to resolve reference") {
			return trimComposeLine(line)
		}
		if strings.Contains(lower, "pull access denied") || strings.Contains(lower, "repository does not exist") {
			return trimComposeLine(line)
		}
		if strings.Contains(lower, "port is already allocated") || strings.Contains(lower, "address already in use") {
			return trimComposeLine(line)
		}
		if strings.Contains(lower, "error response from daemon") {
			daemonErrors = append(daemonErrors, trimComposeLine(line))
		}
	}
	if len(daemonErrors) > 0 {
		last := daemonErrors[len(daemonErrors)-1]
		if idx := strings.Index(strings.ToLower(last), "failed to resolve"); idx >= 0 {
			return strings.TrimSpace(last[idx:])
		}
		return last
	}
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		lower := strings.ToLower(line)
		if strings.Contains(lower, "error") && len(line) < 360 {
			return line
		}
	}
	return ""
}

func trimComposeLine(line string) string {
	line = strings.TrimSpace(line)
	// Drop common noise prefix from compose pull output
	if i := strings.Index(line, "Error "); i > 0 && i < 40 {
		rest := strings.TrimSpace(line[i:])
		if strings.HasPrefix(strings.ToLower(rest), "error ") {
			return rest
		}
	}
	return line
}
