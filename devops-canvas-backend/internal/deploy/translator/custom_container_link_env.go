package translator

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"devops-canvas-backend/internal/models"
)

// composeServiceNameForNode matches deploy.resolveServiceNameForNode (type-id4 or custom serviceName).
func composeServiceNameForNode(dep models.Node) string {
	name := fmt.Sprintf("%s-%s", dep.Type, shortNodeID(dep.ID))
	var u UniversalNodeConfig
	if err := json.Unmarshal(dep.Data, &u); err == nil && u.ServiceName != "" {
		name = u.ServiceName
	}
	return name
}

func shortNodeID(id string) string {
	if len(id) >= 4 {
		return id[:4]
	}
	return id
}

func skipLinkedDependencyType(t string) bool {
	switch t {
	case "kind-cluster", "docker-compose", "file", "custom-container":
		return true
	default:
		return false
	}
}

func upperTypeKey(t string) string {
	return strings.ToUpper(strings.ReplaceAll(t, "-", "_"))
}

// extractContainerPort returns the container-side port from a host:container or ip:host:container mapping.
func extractContainerPort(mapping string) string {
	mapping = strings.TrimSpace(mapping)
	if mapping == "" {
		return ""
	}
	parts := strings.Split(mapping, ":")
	if len(parts) < 2 {
		return ""
	}
	return strings.TrimSpace(parts[len(parts)-1])
}

// linkedContainerPort resolves the port a sibling service listens on inside the compose network.
func linkedContainerPort(dep models.Node) string {
	var u UniversalNodeConfig
	_ = json.Unmarshal(dep.Data, &u)
	for _, pm := range u.PortMappings {
		if p := extractContainerPort(pm); p != "" {
			return p
		}
	}
	if d, ok := DefaultComposeByType[dep.Type]; ok {
		for _, pm := range d.Ports {
			if p := extractContainerPort(pm); p != "" {
				return p
			}
		}
	}
	return dedicatedTranslatorDefaultPort(dep.Type)
}

func dedicatedTranslatorDefaultPort(t string) string {
	switch t {
	case "postgres":
		return "5432"
	case "mysql":
		return "3306"
	case "redis", "valkey":
		return "6379"
	case "clickhouse":
		return "8123"
	case "kafka":
		return "29092"
	case "rabbitmq":
		return "5672"
	case "prometheus":
		return "9090"
	case "grafana":
		return "3000"
	case "alertmanager":
		return "9093"
	default:
		return ""
	}
}

// injectLinkedDependencyEnvs fills env from canvas edges (custom container <-> other components).
// Call before merging user-defined envVars so the user can override any key.
func injectLinkedDependencyEnvs(env map[string]string, selfID string, ctx TranslationContext) (*DependsOnSpec, error) {
	connected, err := ctx.FindConnectedNodes(selfID)
	if err != nil {
		return nil, err
	}
	depends := &DependsOnSpec{}

	for _, dep := range connected {
		if skipLinkedDependencyType(dep.Type) {
			continue
		}
		svc := composeServiceNameForNode(dep)
		depends.AppendStarted(svc)
		ut := upperTypeKey(dep.Type)
		port := linkedContainerPort(dep)

		switch dep.Type {
		case "postgres":
			var c struct {
				Port     any    `json:"port"`
				User     string `json:"user"`
				Password string `json:"password"`
				DbName   string `json:"dbName"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			pgPort := fmt.Sprintf("%v", c.Port)
			if pgPort == "" || pgPort == "<nil>" {
				pgPort = "5432"
			}
			user := c.User
			if user == "" {
				user = "postgres"
			}
			db := c.DbName
			if db == "" {
				db = "app_db"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = pgPort
			env[ut+"_USER"] = user
			env[ut+"_PASSWORD"] = c.Password
			env[ut+"_DB"] = db
			u := url.URL{Scheme: "postgres", User: url.UserPassword(user, c.Password), Host: fmt.Sprintf("%s:%s", svc, pgPort), Path: "/" + db}
			env["DATABASE_URL"] = u.String()

		case "mysql":
			var c struct {
				Port         any    `json:"port"`
				RootPassword string `json:"root_password"`
				Database     string `json:"database"`
				User         string `json:"user"`
				Password     string `json:"password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			myPort := fmt.Sprintf("%v", c.Port)
			if myPort == "" || myPort == "<nil>" {
				myPort = "3306"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = myPort
			env[ut+"_ROOT_PASSWORD"] = c.RootPassword
			env[ut+"_DATABASE"] = c.Database
			env[ut+"_USER"] = c.User
			env[ut+"_PASSWORD"] = c.Password
			if c.User != "" {
				u := url.URL{Scheme: "mysql", User: url.UserPassword(c.User, c.Password), Host: fmt.Sprintf("%s:%s", svc, myPort), Path: "/" + c.Database}
				env["MYSQL_URL"] = u.String()
			} else if c.RootPassword != "" {
				u := url.URL{Scheme: "mysql", User: url.UserPassword("root", c.RootPassword), Host: fmt.Sprintf("%s:%s", svc, myPort), Path: "/" + c.Database}
				env["MYSQL_URL"] = u.String()
			}

		case "redis", "valkey":
			var c struct {
				Port        any    `json:"port"`
				RequirePass string `json:"requirepass"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			rPort := fmt.Sprintf("%v", c.Port)
			if rPort == "" || rPort == "<nil>" {
				rPort = "6379"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = rPort
			if c.RequirePass != "" {
				env[ut+"_PASSWORD"] = c.RequirePass
			}
			ru := &url.URL{Scheme: "redis", Host: fmt.Sprintf("%s:%s", svc, rPort)}
			if c.RequirePass != "" {
				ru.User = url.UserPassword("", c.RequirePass)
			}
			env[ut+"_URL"] = ru.String()

		case "mongodb":
			var c struct {
				Database      string `json:"database"`
				RootUsername  string `json:"root_username"`
				RootPassword  string `json:"root_password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			mPort := port
			if mPort == "" {
				mPort = "27017"
			}
			db := c.Database
			if db == "" {
				db = "app_db"
			}
			user := c.RootUsername
			if user == "" {
				user = "admin"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = mPort
			env[ut+"_USER"] = user
			env[ut+"_PASSWORD"] = c.RootPassword
			env[ut+"_DATABASE"] = db
			if c.RootPassword != "" {
				u := url.URL{Scheme: "mongodb", User: url.UserPassword(user, c.RootPassword), Host: fmt.Sprintf("%s:%s", svc, mPort), Path: "/" + db}
				env["MONGODB_URI"] = u.String()
				env["MONGO_URL"] = u.String()
			}

		case "mariadb":
			var c struct {
				Port         any    `json:"port"`
				RootPassword string `json:"root_password"`
				Database     string `json:"database"`
				User         string `json:"user"`
				Password     string `json:"password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			mPort := fmt.Sprintf("%v", c.Port)
			if mPort == "" || mPort == "<nil>" {
				mPort = "3306"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = mPort
			env[ut+"_ROOT_PASSWORD"] = c.RootPassword
			env[ut+"_DATABASE"] = c.Database
			env[ut+"_USER"] = c.User
			env[ut+"_PASSWORD"] = c.Password
			if c.User != "" {
				u := url.URL{Scheme: "mysql", User: url.UserPassword(c.User, c.Password), Host: fmt.Sprintf("%s:%s", svc, mPort), Path: "/" + c.Database}
				env["MARIADB_URL"] = u.String()
			}

		case "cassandra":
			cPort := port
			if cPort == "" {
				cPort = "9042"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = cPort
			env[ut+"_CQL_PORT"] = cPort

		case "cockroachdb":
			var c struct {
				Database string `json:"database"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			sqlPort := port
			if sqlPort == "" {
				sqlPort = "26257"
			}
			db := c.Database
			if db == "" {
				db = "defaultdb"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_SQL_PORT"] = sqlPort
			env[ut+"_DATABASE"] = db
			env[ut+"_URL"] = fmt.Sprintf("postgresql://root@%s:%s/%s", svc, sqlPort, db)

		case "neo4j":
			var c struct {
				AuthPassword string `json:"auth_password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			// Default image exposes 7474 (HTTP) and 7687 (Bolt); first portMapping is often 7474 only.
			boltPort, httpPort := "7687", "7474"
			var neoPorts UniversalNodeConfig
			_ = json.Unmarshal(dep.Data, &neoPorts)
			for _, pm := range neoPorts.PortMappings {
				switch extractContainerPort(pm) {
				case "7687":
					boltPort = "7687"
				case "7474":
					httpPort = "7474"
				}
			}
			env[ut+"_HOST"] = svc
			env[ut+"_BOLT_PORT"] = boltPort
			env[ut+"_HTTP_PORT"] = httpPort
			env[ut+"_PASSWORD"] = c.AuthPassword
			env["NEO4J_URI"] = fmt.Sprintf("bolt://%s:%s", svc, boltPort)

		case "minio":
			var c struct {
				RootUser     string `json:"root_user"`
				RootPassword string `json:"root_password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			apiPort := port
			if apiPort == "" {
				apiPort = "9000"
			}
			u := c.RootUser
			if u == "" {
				u = "minioadmin"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_API_PORT"] = apiPort
			env[ut+"_ROOT_USER"] = u
			env[ut+"_ROOT_PASSWORD"] = c.RootPassword
			env["MINIO_ENDPOINT"] = fmt.Sprintf("http://%s:%s", svc, apiPort)
			env["AWS_ENDPOINT_URL"] = env["MINIO_ENDPOINT"]
			env["S3_ENDPOINT"] = env["MINIO_ENDPOINT"]

		case "elasticsearch":
			esPort := port
			if esPort == "" {
				esPort = "9200"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = esPort
			env["ELASTICSEARCH_URL"] = fmt.Sprintf("http://%s:%s", svc, esPort)

		case "meilisearch":
			var c struct {
				MasterKey string `json:"master_key"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			msPort := port
			if msPort == "" {
				msPort = "7700"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = msPort
			env["MEILISEARCH_URL"] = fmt.Sprintf("http://%s:%s", svc, msPort)
			env["MEILI_HOST"] = svc
			if c.MasterKey != "" {
				env["MEILI_MASTER_KEY"] = c.MasterKey
				env["MEILISEARCH_MASTER_KEY"] = c.MasterKey
			}

		case "opensearch":
			osPort := port
			if osPort == "" {
				osPort = "9200"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = osPort
			env["OPENSEARCH_URL"] = fmt.Sprintf("http://%s:%s", svc, osPort)

		case "nats":
			nPort := port
			if nPort == "" {
				nPort = "4222"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = nPort
			env["NATS_URL"] = fmt.Sprintf("nats://%s:%s", svc, nPort)

		case "kafka":
			env[ut+"_HOST"] = svc
			env[ut+"_BROKERS"] = svc + ":29092"
			env["KAFKA_BOOTSTRAP_SERVERS"] = svc + ":29092"

		case "rabbitmq":
			var c struct {
				Port        any    `json:"port"`
				DefaultUser string `json:"default_user"`
				DefaultPass string `json:"default_pass"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			rmqPort := fmt.Sprintf("%v", c.Port)
			if rmqPort == "" || rmqPort == "<nil>" {
				rmqPort = "5672"
			}
			rmqUser := c.DefaultUser
			if rmqUser == "" {
				rmqUser = "guest"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = rmqPort
			env[ut+"_USER"] = rmqUser
			env[ut+"_PASSWORD"] = c.DefaultPass
			ru := &url.URL{Scheme: "amqp", User: url.UserPassword(rmqUser, c.DefaultPass), Host: fmt.Sprintf("%s:%s", svc, rmqPort)}
			env["RABBITMQ_URL"] = ru.String()

		case "clickhouse":
			chHTTP := port
			if chHTTP == "" {
				chHTTP = "8123"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_HTTP_PORT"] = chHTTP
			env[ut+"_NATIVE_PORT"] = "9000"
			env["CLICKHOUSE_URL"] = fmt.Sprintf("http://%s:%s", svc, chHTTP)

		case "nginx", "apache-http":
			webPort := port
			if webPort == "" {
				webPort = "80"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = webPort
			env[ut+"_URL"] = fmt.Sprintf("http://%s:%s", svc, webPort)

		case "traefik":
			// First published port is often 80; dashboard 8080
			webPort := port
			if webPort == "" {
				webPort = "80"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_HTTP_PORT"] = webPort
			env[ut+"_DASHBOARD_PORT"] = "8080"

		case "kong":
			proxyPort := port
			if proxyPort == "" {
				proxyPort = "8000"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PROXY_PORT"] = proxyPort
			env[ut+"_ADMIN_PORT"] = "8001"
			env["KONG_PROXY_URL"] = fmt.Sprintf("http://%s:%s", svc, proxyPort)

		case "keycloak":
			kcPort := port
			if kcPort == "" {
				kcPort = "8080"
			}
			var c struct {
				AdminUser     string `json:"admin_user"`
				AdminPassword string `json:"admin_password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = kcPort
			env["KEYCLOAK_URL"] = fmt.Sprintf("http://%s:%s", svc, kcPort)
			env[ut+"_ADMIN_USER"] = c.AdminUser
			env[ut+"_ADMIN_PASSWORD"] = c.AdminPassword

		case "vault":
			vPort := port
			if vPort == "" {
				vPort = "8200"
			}
			var c struct {
				DevRootToken string `json:"dev_root_token"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = vPort
			env["VAULT_ADDR"] = fmt.Sprintf("http://%s:%s", svc, vPort)
			if c.DevRootToken != "" {
				env["VAULT_TOKEN"] = c.DevRootToken
			}

		case "supabase":
			sPort := port
			if sPort == "" {
				sPort = "9999"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = sPort
			env["GOTRUE_URL"] = fmt.Sprintf("http://%s:%s", svc, sPort)

		case "influxdb":
			var c struct {
				Username string `json:"username"`
				Password string `json:"password"`
				Org      string `json:"org"`
				Bucket   string `json:"bucket"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			inPort := port
			if inPort == "" {
				inPort = "8086"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = inPort
			env["INFLUXDB_URL"] = fmt.Sprintf("http://%s:%s", svc, inPort)
			env["INFLUXDB_ORG"] = c.Org
			env["INFLUXDB_BUCKET"] = c.Bucket
			env["INFLUXDB_USERNAME"] = c.Username
			env["INFLUXDB_PASSWORD"] = c.Password

		case "jaeger":
			uiPort := port
			if uiPort == "" {
				uiPort = "16686"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_UI_PORT"] = uiPort
			env[ut+"_COLLECTOR_HTTP_PORT"] = "14268"
			env["JAEGER_UI_URL"] = fmt.Sprintf("http://%s:%s", svc, uiPort)

		case "prometheus":
			pPort := port
			if pPort == "" {
				pPort = "9090"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = pPort
			env["PROMETHEUS_URL"] = fmt.Sprintf("http://%s:%s", svc, pPort)

		case "grafana":
			var c struct {
				AdminUser     string `json:"admin_user"`
				AdminPassword string `json:"admin_password"`
			}
			_ = json.Unmarshal(dep.Data, &c)
			gPort := port
			if gPort == "" {
				gPort = "3000"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = gPort
			env["GRAFANA_URL"] = fmt.Sprintf("http://%s:%s", svc, gPort)
			env[ut+"_ADMIN_USER"] = c.AdminUser
			env[ut+"_ADMIN_PASSWORD"] = c.AdminPassword

		case "alertmanager":
			aPort := port
			if aPort == "" {
				aPort = "9093"
			}
			env[ut+"_HOST"] = svc
			env[ut+"_PORT"] = aPort
			env["ALERTMANAGER_URL"] = fmt.Sprintf("http://%s:%s", svc, aPort)

		default:
			// Any other runnable component: HOST + PORT when we can infer a port
			env[ut+"_HOST"] = svc
			if port != "" {
				env[ut+"_PORT"] = port
				env[ut+"_URL"] = fmt.Sprintf("http://%s:%s", svc, port)
			}
		}
	}

	if len(depends.Started) == 0 {
		return nil, nil
	}
	return depends, nil
}
