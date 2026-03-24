package translator

import (
	"devops-canvas-backend/internal/models"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"sort"
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
		if d, ok := DefaultComposeByType[node.Type]; ok && d.Tag != "" && (tag == "latest" || tag == "") {
			tag = d.Tag
		}
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
	if node.Type == "minio" {
		ensureMinIORootCredentials(compose)
	}
	applyKongDatabaseAndPostgres(node, ctx, compose)
	extraCompose := applySupabaseGoTrueEnv(node, ctx, compose, validPorts)
	// Tool-options -> command (e.g. mariadb max_connections, minio server args)
	applyToolOptionsCommand(node.Data, node.Type, compose)
	// cockroachdb/cockroach images set ENTRYPOINT to cockroach.sh but no CMD; without arguments the script exits with
	// "mode unset". Dev/single-node local deploys need an explicit subcommand.
	if node.Type == "cockroachdb" && len(compose.Command) == 0 {
		compose.Command = []string{"start-single-node", "--insecure"}
	}
	// quay.io/keycloak/keycloak: ENTRYPOINT is kc.sh with no CMD — container prints help and exits without a subcommand.
	if node.Type == "keycloak" && len(compose.Command) == 0 {
		compose.Command = []string{"start-dev"}
	}
	// Traefik: TRAEFIK_PROVIDERS_DOCKER and TRAEFIK_API_DASHBOARD are documented in Traefik Docker/static configuration.
	if node.Type == "traefik" && compose.Environment != nil {
		compose.Environment["TRAEFIK_PROVIDERS_DOCKER"] = "true"
	}
	if len(uConfig.DependsOn) > 0 {
		if compose.DependsOn == nil {
			compose.DependsOn = &DependsOnSpec{}
		}
		for _, name := range uConfig.DependsOn {
			compose.DependsOn.AppendStarted(name)
		}
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
		DockerCompose:        compose,
		ExtraComposeServices: extraCompose,
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
		if _, exists := compose.Environment["discovery.type"]; !exists {
			compose.Environment["discovery.type"] = "single-node"
		}
		// Elastic 8.x enables security by default; disable for single-node canvas dev unless the user configures auth.
		if _, exists := compose.Environment["xpack.security.enabled"]; !exists {
			compose.Environment["xpack.security.enabled"] = "false"
		}
	case "influxdb":
		if _, exists := compose.Environment["DOCKER_INFLUXDB_INIT_MODE"]; !exists {
			compose.Environment["DOCKER_INFLUXDB_INIT_MODE"] = "setup"
		}
	}
}

// ensureMinIORootCredentials applies MinIO's minimum length rules when values are missing or too short after tool-options mapping.
func ensureMinIORootCredentials(compose *ComposeService) {
	if compose == nil || compose.Environment == nil {
		return
	}
	user := strings.TrimSpace(compose.Environment["MINIO_ROOT_USER"])
	pass := strings.TrimSpace(compose.Environment["MINIO_ROOT_PASSWORD"])
	if len(user) < 3 {
		compose.Environment["MINIO_ROOT_USER"] = "minioadmin"
	}
	if len(pass) < 8 {
		if v := strings.TrimSpace(os.Getenv("DEVOPS_CANVAS_DEFAULT_MINIO_PASSWORD")); len(v) >= 8 {
			compose.Environment["MINIO_ROOT_PASSWORD"] = v
		}
	}
}

// applyKongDatabaseAndPostgres wires Kong to PostgreSQL when the canvas has an edge to an enabled Postgres node.
// Otherwise Kong defaults to DB-less mode unless the user already set KONG_DATABASE via tool options (e.g. postgres without a neighbor — blocked at validation).
func applyKongDatabaseAndPostgres(node models.Node, ctx TranslationContext, compose *ComposeService) {
	if node.Type != "kong" || compose == nil {
		return
	}
	if compose.Environment == nil {
		compose.Environment = make(map[string]string)
	}
	pgNode := pickConnectedPostgresNeighbor(ctx, node.ID)
	if pgNode != nil {
		compose.Environment["KONG_DATABASE"] = "postgres"
		wireKongPostgresEnv(pgNode, compose)
	} else if strings.TrimSpace(compose.Environment["KONG_DATABASE"]) == "" {
		compose.Environment["KONG_DATABASE"] = "off"
	}
	if strings.ToLower(strings.TrimSpace(compose.Environment["KONG_DATABASE"])) == "postgres" {
		setKongPostgresStartupCommand(compose)
	}
}

// setKongPostgresStartupCommand runs DB migrations then delegates to the image entrypoint for kong docker-start (nginx).
// Bootstrap applies on first run; subsequent deploys use migrations up when bootstrap is no longer applicable.
func setKongPostgresStartupCommand(compose *ComposeService) {
	if compose == nil {
		return
	}
	compose.Command = []string{"/bin/bash", "-c", "(kong migrations bootstrap -y || kong migrations up -y) && exec /docker-entrypoint.sh kong docker-start"}
}

// applySupabaseGoTrueEnv sets required GoTrue (supabase/gotrue) env vars and wires PostgreSQL from the canvas.
// GoTrue migrations expect PostgreSQL schema "auth" to exist; we add a one-shot init service that creates it.
func applySupabaseGoTrueEnv(node models.Node, ctx TranslationContext, compose *ComposeService, validPorts []string) map[string]ComposeService {
	if node.Type != "supabase" || compose == nil {
		return nil
	}
	if compose.Environment == nil {
		compose.Environment = make(map[string]string)
	}
	hostPort := hostPortFromMappings(validPorts, "9999")
	publicBase := fmt.Sprintf("http://127.0.0.1:%s", hostPort)
	if strings.TrimSpace(compose.Environment["API_EXTERNAL_URL"]) == "" {
		compose.Environment["API_EXTERNAL_URL"] = publicBase
	}
	if strings.TrimSpace(compose.Environment["GOTRUE_SITE_URL"]) == "" {
		compose.Environment["GOTRUE_SITE_URL"] = publicBase
	}
	if strings.TrimSpace(compose.Environment["GOTRUE_JWT_SECRET"]) == "" {
		if v := strings.TrimSpace(os.Getenv("DEVOPS_CANVAS_GOTRUE_JWT_SECRET")); v != "" {
			compose.Environment["GOTRUE_JWT_SECRET"] = v
		}
	}
	if pgNode := pickConnectedPostgresNeighbor(ctx, node.ID); pgNode != nil {
		wireGoTruePostgres(pgNode, compose)
		const initKey = "gotrue-auth-schema"
		if compose.DependsOn == nil {
			compose.DependsOn = &DependsOnSpec{}
		}
		compose.DependsOn.AppendCompleted(fmt.Sprintf("%s-%s", initKey, node.ID[:4]))
		return map[string]ComposeService{
			initKey: goTrueAuthSchemaInitService(pgNode),
		}
	}
	return nil
}

// goTrueAuthSchemaInitService runs before GoTrue so migrations/00_init_auth_schema.up.sql can create auth.* tables.
func goTrueAuthSchemaInitService(pgNode *models.Node) ComposeService {
	var pg struct {
		User         string `json:"user"`
		Password     string `json:"password"`
		DatabaseName string `json:"dbName"`
	}
	_ = json.Unmarshal(pgNode.Data, &pg)
	user := pg.User
	if user == "" {
		user = "postgres"
	}
	dbName := pg.DatabaseName
	if dbName == "" {
		dbName = "app_db"
	}
	pgSvc := ComposeServiceNameForNode(*pgNode)
	script := `until pg_isready -h "$PGHOST" -p 5432 -U "$PGUSER"; do sleep 1; done && ` +
		`psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA IF NOT EXISTS auth;'`
	initDep := &DependsOnSpec{}
	initDep.AppendStarted(pgSvc)
	return ComposeService{
		Image:   "postgres:16-alpine",
		Restart: "no",
		Environment: map[string]string{
			"PGHOST":     pgSvc,
			"PGUSER":     user,
			"PGDATABASE": dbName,
			"PGPASSWORD": pg.Password,
		},
		Command:   []string{"sh", "-c", script},
		DependsOn: initDep,
	}
}

func hostPortFromMappings(ports []string, fallback string) string {
	for _, p := range ports {
		p = strings.TrimSpace(p)
		if p == "" || p == ":" {
			continue
		}
		parts := strings.SplitN(p, ":", 2)
		if h := strings.TrimSpace(parts[0]); h != "" {
			return h
		}
	}
	return fallback
}

func wireGoTruePostgres(pgNode *models.Node, compose *ComposeService) {
	if pgNode == nil || compose == nil || compose.Environment == nil {
		return
	}
	var pg struct {
		User         string `json:"user"`
		Password     string `json:"password"`
		DatabaseName string `json:"dbName"`
	}
	_ = json.Unmarshal(pgNode.Data, &pg)
	user := pg.User
	if user == "" {
		user = "postgres"
	}
	dbName := pg.DatabaseName
	if dbName == "" {
		dbName = "app_db"
	}
	svc := ComposeServiceNameForNode(*pgNode)
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, pg.Password),
		Host:   fmt.Sprintf("%s:5432", svc),
		Path:   "/" + dbName,
	}
	u.RawQuery = "sslmode=disable"
	compose.Environment["GOTRUE_DB_DRIVER"] = "postgres"
	compose.Environment["GOTRUE_DB_DATABASE_URL"] = u.String()
	if compose.DependsOn == nil {
		compose.DependsOn = &DependsOnSpec{}
	}
	for _, d := range compose.DependsOn.Started {
		if d == svc {
			return
		}
	}
	compose.DependsOn.AppendStarted(svc)
}

func pickConnectedPostgresNeighbor(ctx TranslationContext, nodeID string) *models.Node {
	connected, err := ctx.FindConnectedNodes(nodeID)
	if err != nil {
		return nil
	}
	var postgresNodes []models.Node
	for i := range connected {
		if connected[i].Type != "postgres" || !NodeEnabledForDeploy(connected[i]) {
			continue
		}
		postgresNodes = append(postgresNodes, connected[i])
	}
	if len(postgresNodes) == 0 {
		return nil
	}
	sort.Slice(postgresNodes, func(i, j int) bool { return postgresNodes[i].ID < postgresNodes[j].ID })
	return &postgresNodes[0]
}

func wireKongPostgresEnv(pgNode *models.Node, compose *ComposeService) {
	if pgNode == nil || compose == nil || compose.Environment == nil {
		return
	}
	var pg struct {
		User         string `json:"user"`
		Password     string `json:"password"`
		DatabaseName string `json:"dbName"`
	}
	_ = json.Unmarshal(pgNode.Data, &pg)
	user := pg.User
	if user == "" {
		user = "postgres"
	}
	dbName := pg.DatabaseName
	if dbName == "" {
		dbName = "app_db"
	}
	svc := ComposeServiceNameForNode(*pgNode)
	compose.Environment["KONG_PG_HOST"] = svc
	compose.Environment["KONG_PG_PORT"] = "5432"
	compose.Environment["KONG_PG_USER"] = user
	compose.Environment["KONG_PG_PASSWORD"] = pg.Password
	compose.Environment["KONG_PG_DATABASE"] = dbName
	if compose.DependsOn == nil {
		compose.DependsOn = &DependsOnSpec{}
	}
	for _, d := range compose.DependsOn.Started {
		if d == svc {
			return
		}
	}
	compose.DependsOn.AppendStarted(svc)
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
