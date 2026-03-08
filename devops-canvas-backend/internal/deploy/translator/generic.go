package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
	"strings"
)

// GenericTranslator provides Docker Compose generation for component types without a dedicated translator.
// It populates image, ports, restart, tool options (env), and resources from type defaults and node.Data.
type GenericTranslator struct{}

// Translate builds a ComposeService from type defaults and node.Data.
func (t *GenericTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
	// Config/file-only components do not produce a runnable service
	if node.Type == "file" {
		return nil, nil
	}

	var uConfig UniversalNodeConfig
	if err := json.Unmarshal(node.Data, &uConfig); err != nil {
		// Proceed with empty config; use type defaults only
	}

	if uConfig.Enabled != nil && !*uConfig.Enabled {
		return nil, nil
	}

	def, hasDefault := DefaultComposeByType[node.Type]

	image := ""
	tag := "latest"
	if uConfig.Image != "" {
		image = uConfig.Image
		if uConfig.Tag != "" {
			tag = uConfig.Tag
		}
	} else if hasDefault {
		image = def.Image
	}

	ports := uConfig.PortMappings
	if len(ports) == 0 && hasDefault {
		ports = def.Ports
	}
	validPorts := filterValidPorts(ports)

	restart := uConfig.RestartPolicy
	if restart == "" {
		restart = "always"
	}

	compose := &ComposeService{
		Restart: restart,
		Ports:   validPorts,
	}
	if image != "" {
		compose.Image = fmt.Sprintf("%s:%s", image, tag)
	}

	if uConfig.ContainerName != "" {
		compose.ContainerName = uConfig.ContainerName
	}
	if uConfig.Command != "" {
		compose.Command = []string{"sh", "-c", uConfig.Command}
	}
	if len(uConfig.EnvVars) > 0 {
		if compose.Environment == nil {
			compose.Environment = make(map[string]string)
		}
		for k, v := range uConfig.EnvVars {
			compose.Environment[k] = v
		}
	}
	// Tool-options -> environment variables (Config tab fields)
	applyToolOptionsEnv(node.Data, node.Type, compose)
	// Tool-options -> command (e.g. mariadb max_connections, minio server args)
	applyToolOptionsCommand(node.Data, node.Type, compose)
	// Traefik: TRAEFIK_PROVIDERS_DOCKER and TRAEFIK_API_DASHBOARD are documented in Traefik Docker/static configuration.
	if node.Type == "traefik" && compose.Environment != nil {
		compose.Environment["TRAEFIK_PROVIDERS_DOCKER"] = "true"
	}
	if len(uConfig.DependsOn) > 0 {
		compose.DependsOn = append(compose.DependsOn, uConfig.DependsOn...)
	}
	// Default persistent data volume (named volume, created at top level by deploy service); path from defaults.go
	if dataVol := DataVolumeSpec(node.Type, node.ID); dataVol != "" {
		compose.Volumes = append([]string{dataVol}, compose.Volumes...)
	}
	if len(uConfig.Volumes) > 0 {
		for _, v := range uConfig.Volumes {
			if v.Source != "" && v.Target != "" {
				compose.Volumes = append(compose.Volumes, fmt.Sprintf("%s:%s", v.Source, v.Target))
			}
		}
	}
	// Bind mounts (e.g. traefik docker.sock)
	if binds := DefaultBindVolumesByType[node.Type]; len(binds) > 0 {
		compose.Volumes = append(compose.Volumes, binds...)
	}
	// Apache-http: configurable public folder mounted at /usr/local/apache2/htdocs
	if node.Type == "apache-http" {
		publicFolder := "./public"
		var raw map[string]interface{}
		if err := json.Unmarshal(node.Data, &raw); err == nil {
			if v, ok := raw["public_folder"]; ok && v != nil {
				if s, ok := v.(string); ok && s != "" {
					publicFolder = s
				}
			}
		}
		compose.Volumes = append(compose.Volumes, publicFolder+":/usr/local/apache2/htdocs")
	}
	if len(uConfig.Networks) > 0 {
		compose.Networks = append(compose.Networks, uConfig.Networks...)
	}
	// Resource limits (deploy.resources)
	applyResources(uConfig.Resources, compose)

	return &GeneratedManifests{
		DockerCompose: compose,
	}, nil
}

func filterValidPorts(ports []string) []string {
	var out []string
	for _, p := range ports {
		if p != "" && p != ":" {
			out = append(out, p)
		}
	}
	return out
}

func applyToolOptionsEnv(data json.RawMessage, componentType string, compose *ComposeService) {
	envMap := ToolOptionsEnv[componentType]
	if len(envMap) == 0 {
		return
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return
	}
	if compose.Environment == nil {
		compose.Environment = make(map[string]string)
	}
	for dataKey, envName := range envMap {
		v, ok := m[dataKey]
		if !ok || v == nil {
			continue
		}
		s := valueToEnvString(v)
		if s != "" {
			if componentType == "neo4j" && dataKey == "auth_password" && !strings.Contains(s, "/") {
				s = "neo4j/" + s
			}
			compose.Environment[envName] = s
		}
	}

	// Defaults: always emit certain env vars even when not explicitly set by the user
	switch componentType {
	case "elasticsearch":
		if _, exists := compose.Environment["ES_JAVA_OPTS"]; !exists {
			compose.Environment["ES_JAVA_OPTS"] = "-Xms512m -Xmx512m"
		}
	case "influxdb":
		if _, exists := compose.Environment["DOCKER_INFLUXDB_INIT_MODE"]; !exists {
			compose.Environment["DOCKER_INFLUXDB_INIT_MODE"] = "setup"
		}
	}
}

// applyToolOptionsCommand sets compose.Command from tool options when the component uses CLI args (e.g. mariadb --max_connections, minio server --address).
func applyToolOptionsCommand(data json.RawMessage, componentType string, compose *ComposeService) {
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return
	}
	switch componentType {
	case "mariadb":
		if v, ok := m["max_connections"]; ok && v != nil {
			s := valueToEnvString(v)
			if s != "" && s != "0" {
				compose.Command = []string{"mariadbd", fmt.Sprintf("--max_connections=%s", s)}
			}
		}
	case "minio":
		compose.Command = []string{"server", "/data", "--address", ":9000", "--console-address", ":9001"}
	case "nats":
		if v, ok := m["jetstream"]; ok {
			enabled := false
			switch b := v.(type) {
			case bool:
				enabled = b
			case string:
				enabled = b == "true"
			}
			if enabled {
				compose.Command = []string{"-js"}
			}
		}
	}
}

func valueToEnvString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case float64:
		return fmt.Sprintf("%.0f", val)
	case int:
		return fmt.Sprintf("%d", val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprint(v)
	}
}

func applyResources(res *ResourceConfig, compose *ComposeService) {
	if res == nil {
		return
	}
	hasLimit := false
	if compose.Deploy == nil {
		compose.Deploy = &DeployConfig{Resources: &ResourcesBlock{Limits: ResourceLimits{}}}
	}
	if compose.Deploy.Resources == nil {
		compose.Deploy.Resources = &ResourcesBlock{Limits: ResourceLimits{}}
	}
	if res.CPU > 0 {
		compose.Deploy.Resources.Limits.CPUs = fmt.Sprintf("%.1f", res.CPU)
		hasLimit = true
	}
	if res.Memory != "" && res.Memory != "0" {
		compose.Deploy.Resources.Limits.Memory = SanitizeMemoryForCompose(res.Memory)
		hasLimit = true
	}
	if !hasLimit {
		compose.Deploy = nil
	}
}
