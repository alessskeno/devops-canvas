package deploy

// Init performs any startup initialization for the deploy package.
// Helm repo initialization is no longer needed since the app is Docker Compose only.
func Init() error {
	return nil
}
