package translator

// ToolOptionsEnv maps component type -> (node.data key -> Docker env var name).
// Used by GenericTranslator to emit Tool Options (Config tab) as environment variables in Docker Compose.
// Port configuration is managed exclusively via the Port Mappings tab.
var ToolOptionsEnv = map[string]map[string]string{
	"meilisearch": {
		"master_key":  "MEILI_MASTER_KEY",
		"environment": "MEILI_ENV",
	},
	"neo4j": {
		"auth_password": "NEO4J_AUTH",
	},
	"mongodb": {
		"database":      "MONGO_INITDB_DATABASE",
		"root_username": "MONGO_INITDB_ROOT_USERNAME",
		"root_password": "MONGO_INITDB_ROOT_PASSWORD",
	},
	"mariadb": {
		"root_password": "MARIADB_ROOT_PASSWORD",
		"database":      "MARIADB_DATABASE",
		"user":          "MARIADB_USER",
		"password":      "MARIADB_PASSWORD",
	},
	"cassandra": {
		"cluster_name": "CASSANDRA_CLUSTER_NAME",
		"num_tokens":   "CASSANDRA_NUM_TOKENS",
	},
	"cockroachdb": {
		"database": "COCKROACH_DATABASE",
	},
	"minio": {
		"root_user":    "MINIO_ROOT_USER",
		"root_password": "MINIO_ROOT_PASSWORD",
	},
	"traefik": {
		"enable_dashboard": "TRAEFIK_API_DASHBOARD",
	},
	"apache-http": {},
	"kong": {
		"database": "KONG_DATABASE",
	},
	"keycloak": {
		"admin_user":     "KC_BOOTSTRAP_ADMIN_USERNAME",
		"admin_password": "KC_BOOTSTRAP_ADMIN_PASSWORD",
	},
	"vault": {
		"dev_root_token": "VAULT_DEV_ROOT_TOKEN_ID",
	},
	"supabase": {
		"postgres_password":  "POSTGRES_PASSWORD",
		"anon_key":          "GOTRUE_JWT_SECRET",
		"service_role_key": "GOTRUE_SERVICE_ROLE_KEY",
	},
	"nats": {},
	"elasticsearch": {
		"cluster_name":   "cluster.name",
		"discovery_type": "discovery.type",
		"es_java_opts":   "ES_JAVA_OPTS",
	},
	"opensearch": {
		"cluster_name":      "cluster.name",
		"discovery_type":    "discovery.type",
		"disable_security":  "DISABLE_SECURITY_PLUGIN",
	},
	"influxdb": {
		"org":        "DOCKER_INFLUXDB_INIT_ORG",
		"bucket":     "DOCKER_INFLUXDB_INIT_BUCKET",
		"username":   "DOCKER_INFLUXDB_INIT_USERNAME",
		"password":   "DOCKER_INFLUXDB_INIT_PASSWORD",
		"init_mode":  "DOCKER_INFLUXDB_INIT_MODE",
	},
}
