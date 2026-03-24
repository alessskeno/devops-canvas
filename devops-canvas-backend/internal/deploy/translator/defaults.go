package translator

// DataVolumeSpec returns a single named volume spec "<volName>:<mountPath>" for the given component type and node ID.
// Volume name is always <type>_data_<nodeID>. Mount path comes from DefaultDataVolumeByType.
// This is the single source of truth for data volume specs; dedicated and generic translators use it.
func DataVolumeSpec(componentType, nodeID string) string {
	path := DefaultDataVolumeByType[componentType]
	if path == "" {
		return ""
	}
	volName := componentType + "_data_" + nodeID
	return volName + ":" + path
}

// DataVolumeSlice returns a one-element slice with the data volume spec, or nil if the type has no default data volume.
func DataVolumeSlice(componentType, nodeID string) []string {
	s := DataVolumeSpec(componentType, nodeID)
	if s == "" {
		return nil
	}
	return []string{s}
}

// DefaultComposeImage holds default image, ports, and optional tag for generic components.
// Tag is used when the node requests "latest" (or empty) but the registry has no :latest (e.g. supabase/gotrue).
type DefaultComposeImage struct {
	Image string
	Ports []string
	Tag   string
}

// DefaultComposeByType provides default Docker image and ports for component types
// that use GenericTranslator (no dedicated translator). Ensures every runnable
// component produces at least image, ports, and restart in generated docker-compose.
var DefaultComposeByType = map[string]DefaultComposeImage{
	// Databases (no dedicated translator)
	"mongodb":     {Image: "mongo", Ports: []string{"27017:27017"}},
	"mariadb":     {Image: "mariadb", Ports: []string{"3306:3306"}},
	"cassandra":   {Image: "cassandra", Ports: []string{"9042:9042"}},
	"cockroachdb": {Image: "cockroachdb/cockroach", Ports: []string{"26257:26257", "8080:8080"}},
	"neo4j":       {Image: "neo4j", Ports: []string{"7474:7474", "7687:7687"}},

	// Storage
	"minio": {Image: "minio/minio", Ports: []string{"9000:9000", "9001:9001"}},

	// Proxy & Gateway
	"nginx":       {Image: "nginx", Ports: []string{"80:80"}},
	"traefik":     {Image: "traefik", Ports: []string{"80:80", "8080:8080"}},
	"apache-http": {Image: "httpd", Ports: []string{"80:80"}},
	"kong":        {Image: "kong", Ports: []string{"8000:8000", "8001:8001"}},

	// Auth & Security
	"keycloak": {Image: "quay.io/keycloak/keycloak", Ports: []string{"8080:8080"}},
	"vault":    {Image: "hashicorp/vault", Ports: []string{"8200:8200"}},
	// GoTrue has no :latest on Docker Hub; pin a published release (auth API only — full Supabase is multi-service).
	"supabase": {Image: "supabase/gotrue", Ports: []string{"9999:9999"}, Tag: "v2.188.1"},

	// Messaging
	"nats": {Image: "nats", Ports: []string{"4222:4222", "8222:8222", "6222:6222"}},

	// Search
	// Docker Hub library/elasticsearch has no usable :latest; Elastic distributes images on docker.elastic.co.
	"elasticsearch": {Image: "docker.elastic.co/elasticsearch/elasticsearch", Ports: []string{"9200:9200"}, Tag: "8.17.3"},
	"meilisearch":   {Image: "getmeili/meilisearch", Ports: []string{"7700:7700"}},
	"opensearch":    {Image: "opensearchproject/opensearch", Ports: []string{"9200:9200", "9600:9600"}},

	// Monitoring (beyond prometheus/grafana/alertmanager which have dedicated translators)
	"influxdb": {Image: "influxdb", Ports: []string{"8086:8086"}},
	"jaeger":   {Image: "jaegertracing/all-in-one", Ports: []string{"16686:16686", "14268:14268"}},
}

// DefaultDataVolumeByType is the single source of truth for persistent data volume mount paths.
// For each component type, the value is the container path where a named volume is mounted.
// Volume name is always <type>_data_<node.ID> (except Postgres 18+ which uses postgres_data_v18_<node.ID>).
// Used by: generic translator (generic.go), and all dedicated translators via DataVolumeSpec() or by reading this map.
var DefaultDataVolumeByType = map[string]string{
	// Dedicated translators (postgres, mysql, redis, etc.)
	"postgres":     "/var/lib/postgresql/data", // Postgres 18+ overrides to /var/lib/postgresql in postgres.go
	"mysql":        "/var/lib/mysql",
	"redis":        "/data",
	"clickhouse":   "/var/lib/clickhouse",
	"valkey":       "/data",
	"kafka":        "/tmp/kraft-combined-logs",
	"rabbitmq":     "/var/lib/rabbitmq",
	"prometheus":   "/prometheus",
	"grafana":      "/var/lib/grafana",
	"alertmanager": "/alertmanager",

	// Generic translator only
	"cockroachdb":   "/cockroach/cockroach-data",
	"mongodb":       "/data/db",
	"mariadb":       "/var/lib/mysql",
	"cassandra":     "/var/lib/cassandra",
	"neo4j":         "/data",
	"minio":         "/data",
	"vault":         "/vault/data",
	"elasticsearch": "/usr/share/elasticsearch/data",
	"meilisearch":   "/meili_data",
	"opensearch":    "/usr/share/opensearch/data",
	"influxdb":      "/var/lib/influxdb2",
}

// DefaultBindVolumesByType lists bind mounts (host:container) for components that need them.
// These are appended to the service volumes; no top-level named volume is created.
var DefaultBindVolumesByType = map[string][]string{
	"traefik": {"/var/run/docker.sock:/var/run/docker.sock"},
}
