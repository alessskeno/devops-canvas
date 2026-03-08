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

// DefaultComposeByType provides default Docker image and ports for component types
// that use GenericTranslator (no dedicated translator). Ensures every runnable
// component produces at least image, ports, and restart in generated docker-compose.
var DefaultComposeByType = map[string]struct {
	Image string
	Ports []string
}{
	// Databases (no dedicated translator)
	"mongodb":     {"mongo", []string{"27017:27017"}},
	"mariadb":     {"mariadb", []string{"3306:3306"}},
	"cassandra":   {"cassandra", []string{"9042:9042"}},
	"cockroachdb": {"cockroachdb/cockroach", []string{"26257:26257", "8080:8080"}},
	"neo4j":       {"neo4j", []string{"7474:7474", "7687:7687"}},

	// Storage
	"minio": {"minio/minio", []string{"9000:9000", "9001:9001"}},

	// Proxy & Gateway
	"nginx":       {"nginx", []string{"80:80"}},
	"traefik":     {"traefik", []string{"80:80", "8080:8080"}},
	"apache-http": {"httpd", []string{"80:80"}},
	"kong":        {"kong", []string{"8000:8000", "8001:8001"}},

	// Auth & Security
	"keycloak": {"quay.io/keycloak/keycloak", []string{"8080:8080"}},
	"vault":    {"hashicorp/vault", []string{"8200:8200"}},
	"supabase": {"supabase/gotrue", []string{"9999:9999"}}, // placeholder; supabase is multi-service

	// Messaging
	"nats": {"nats", []string{"4222:4222", "8222:8222", "6222:6222"}},

	// Search
	"elasticsearch": {"elasticsearch", []string{"9200:9200"}},
	"meilisearch":   {"getmeili/meilisearch", []string{"7700:7700"}},
	"opensearch":    {"opensearchproject/opensearch", []string{"9200:9200", "9600:9600"}},

	// Monitoring (beyond prometheus/grafana/alertmanager which have dedicated translators)
	"influxdb": {"influxdb", []string{"8086:8086"}},
	"jaeger":   {"jaegertracing/all-in-one", []string{"16686:16686", "14268:14268"}},
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
	"supabase":      "/var/lib/postgresql/data",
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
