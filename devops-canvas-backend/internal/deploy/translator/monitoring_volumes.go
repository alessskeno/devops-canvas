package translator

import "strings"

// SanitizeMonitoringLegacyFileMounts removes bind mounts that target single files under
// /etc/prometheus or /etc/alertmanager. Those collide with files baked into the image and
// break on Docker Desktop/WSL when the host path is wrong type (dir vs file).
// Canvas deploy uses directory mounts (./configs → .../canvas-config) instead.
func SanitizeMonitoringLegacyFileMounts(componentType string, vols []string) []string {
	switch componentType {
	case "prometheus":
		out := stripVolumeMountsToPaths(vols,
			"/etc/prometheus/prometheus.yml",
			"/etc/prometheus/rules.yml",
		)
		return stripCanvasConfigDirMounts(out)
	case "alertmanager":
		out := stripVolumeMountsToPaths(vols, "/etc/alertmanager/config.yml")
		return stripCanvasConfigDirMounts(out)
	default:
		return vols
	}
}

// stripCanvasConfigDirMounts removes ./configs → .../canvas-config binds (stale with compose inline configs; API-in-Docker path mismatch).
func stripCanvasConfigDirMounts(vols []string) []string {
	var out []string
	for _, vol := range vols {
		cp := composeBindMountContainerPath(vol)
		if cp == "/etc/prometheus/canvas-config" || cp == "/etc/alertmanager/canvas-config" {
			continue
		}
		out = append(out, vol)
	}
	return out
}

func stripVolumeMountsToPaths(vols []string, bannedContainerPaths ...string) []string {
	ban := make(map[string]bool, len(bannedContainerPaths))
	for _, p := range bannedContainerPaths {
		ban[p] = true
	}
	var out []string
	for _, vol := range vols {
		if ban[composeBindMountContainerPath(vol)] {
			continue
		}
		out = append(out, vol)
	}
	return out
}

// composeBindMountContainerPath returns the in-container path for a short docker-compose
// volume string (host:container or host:container:ro).
func composeBindMountContainerPath(vol string) string {
	v := strings.TrimSpace(vol)
	low := strings.ToLower(v)
	for _, suf := range []string{":ro", ":rw", ":z", ":Z"} {
		if strings.HasSuffix(low, suf) {
			v = v[:len(v)-len(suf)]
			low = strings.ToLower(v)
			break
		}
	}
	idx := strings.Index(v, ":")
	if idx <= 0 || idx >= len(v)-1 {
		return ""
	}
	return v[idx+1:]
}
