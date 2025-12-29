package deploy

import "devops-canvas-backend/internal/deploy/translator"

// InitHelmRepos exposes the translator's EnsureHelmRepos for startup initialization
func InitHelmRepos() error {
    return translator.EnsureHelmRepos()
}
