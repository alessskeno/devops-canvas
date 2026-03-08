package translator

import (
    "encoding/json"
    "fmt"
    "path/filepath"
    "strings"

    "devops-canvas-backend/internal/models"
)

// CustomContainerConfig defines the expected JSON data from the frontend
type CustomContainerConfig struct {
    CommonConfig
    Label          string   `json:"label"`
    BuildContextID string   `json:"buildContextId"`
    PortMappings   []string `json:"portMappings"`
    ContainerPort  any      `json:"containerPort"`
    HostPort       any      `json:"hostPort"`
}

type CustomContainerTranslator struct{}

func (t *CustomContainerTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    // Use raw JSON map for flexible parsing — avoids type mismatches
    // (e.g. envVars may be {} object or "KEY=VAL" string depending on frontend version)
    var raw map[string]interface{}
    if err := json.Unmarshal(node.Data, &raw); err != nil {
        return nil, fmt.Errorf("failed to parse custom-container config: %v", err)
    }

    // Also unmarshal into typed struct for typed fields
    var config CustomContainerConfig
    // Use a lenient approach: unmarshal what we can, ignore mismatches
    _ = json.Unmarshal(node.Data, &config)

    // Fallback for buildContextId from raw map
    if config.BuildContextID == "" {
        if id, _ := raw["buildContextId"].(string); id != "" {
            config.BuildContextID = id
        } else if id, _ := raw["buildContext"].(string); id != "" {
            config.BuildContextID = id
        }
    }

    label := config.Label
    if label == "" {
        if l, _ := raw["label"].(string); l != "" {
            label = l
        } else {
            label = "Custom Container"
        }
    }

    // Check Enabled status
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }

    // Validate build context
    if config.BuildContextID == "" {
        return nil, fmt.Errorf("custom container '%s': no build context uploaded. Please upload your source directory first", label)
    }

    contextDir := filepath.Join("/tmp/contexts", config.BuildContextID)

    // Parse ports: prefer portMappings, fall back to containerPort/hostPort (legacy)
    var ports []string
    if len(config.PortMappings) > 0 {
        for _, p := range config.PortMappings {
            p = strings.TrimSpace(p)
            if p != "" {
                ports = append(ports, p)
            }
        }
    }
    if len(ports) == 0 {
        containerPort := fmt.Sprintf("%v", config.ContainerPort)
        if containerPort == "" || containerPort == "<nil>" || containerPort == "0" {
            containerPort = "8080"
        }
        hostPort := fmt.Sprintf("%v", config.HostPort)
        if hostPort == "" || hostPort == "<nil>" || hostPort == "0" {
            hostPort = containerPort
        }
        ports = []string{fmt.Sprintf("%s:%s", hostPort, containerPort)}
    }

    // Build environment variables from envVars (handle both map and string formats)
    env := make(map[string]string)
    if envObj, ok := raw["envVars"].(map[string]interface{}); ok {
        for k, v := range envObj {
            env[k] = fmt.Sprintf("%v", v)
        }
    } else if envStr, ok := raw["envVars"].(string); ok && envStr != "" {
        for _, line := range strings.Split(envStr, "\n") {
            line = strings.TrimSpace(line)
            if line == "" || strings.HasPrefix(line, "#") {
                continue
            }
            parts := strings.SplitN(line, "=", 2)
            if len(parts) == 2 {
                env[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
            }
        }
    }

    // Auto-inject connection info for connected dependencies
    connectedNodes, _ := ctx.FindConnectedNodes(node.ID)

    for _, dep := range connectedNodes {
        if dep.Type == "kind-cluster" || dep.Type == "docker-compose" || dep.Type == "file" || dep.Type == "custom-container" {
            continue
        }

        depServiceName := fmt.Sprintf("%s-%s", dep.Type, dep.ID[:4])
        upperType := strings.ToUpper(strings.ReplaceAll(dep.Type, "-", "_"))

        switch dep.Type {
        case "postgres":
            var pgConfig struct {
                Port     any    `json:"port"`
                User     string `json:"user"`
                Password string `json:"password"`
                DbName   string `json:"dbName"`
            }
            _ = json.Unmarshal(dep.Data, &pgConfig)

            pgPort := fmt.Sprintf("%v", pgConfig.Port)
            if pgPort == "" || pgPort == "<nil>" { pgPort = "5432" }
            pgUser := pgConfig.User
            if pgUser == "" { pgUser = "postgres" }
            pgDb := pgConfig.DbName
            if pgDb == "" { pgDb = "app_db" }

            env[upperType+"_HOST"] = depServiceName
            env[upperType+"_PORT"] = pgPort
            env[upperType+"_USER"] = pgUser
            env[upperType+"_PASSWORD"] = pgConfig.Password
            env[upperType+"_DB"] = pgDb
            env["DATABASE_URL"] = fmt.Sprintf("postgres://%s:%s@%s:%s/%s", pgUser, pgConfig.Password, depServiceName, pgPort, pgDb)

        case "mysql":
            var myConfig struct {
                Port         any    `json:"port"`
                RootPassword string `json:"root_password"`
                Database     string `json:"database"`
            }
            _ = json.Unmarshal(dep.Data, &myConfig)

            myPort := fmt.Sprintf("%v", myConfig.Port)
            if myPort == "" || myPort == "<nil>" { myPort = "3306" }

            env[upperType+"_HOST"] = depServiceName
            env[upperType+"_PORT"] = myPort
            env[upperType+"_ROOT_PASSWORD"] = myConfig.RootPassword
            env[upperType+"_DATABASE"] = myConfig.Database

        case "redis", "valkey":
            var rConfig struct {
                Port        any    `json:"port"`
                RequirePass string `json:"requirepass"`
            }
            _ = json.Unmarshal(dep.Data, &rConfig)

            rPort := fmt.Sprintf("%v", rConfig.Port)
            if rPort == "" || rPort == "<nil>" { rPort = "6379" }

            env[upperType+"_HOST"] = depServiceName
            env[upperType+"_PORT"] = rPort
            if rConfig.RequirePass != "" {
                env[upperType+"_PASSWORD"] = rConfig.RequirePass
            }
            env[upperType+"_URL"] = fmt.Sprintf("redis://%s:%s", depServiceName, rPort)

        case "kafka":
            env[upperType+"_BROKERS"] = depServiceName + ":9092"

        case "rabbitmq":
            var rmqConfig struct {
                Port        any    `json:"port"`
                DefaultUser string `json:"default_user"`
                DefaultPass string `json:"default_pass"`
            }
            _ = json.Unmarshal(dep.Data, &rmqConfig)

            rmqPort := fmt.Sprintf("%v", rmqConfig.Port)
            if rmqPort == "" || rmqPort == "<nil>" { rmqPort = "5672" }
            rmqUser := rmqConfig.DefaultUser
            if rmqUser == "" { rmqUser = "guest" }

            env[upperType+"_HOST"] = depServiceName
            env[upperType+"_PORT"] = rmqPort
            env[upperType+"_USER"] = rmqUser
            env[upperType+"_PASSWORD"] = rmqConfig.DefaultPass

        case "clickhouse":
            env[upperType+"_HOST"] = depServiceName

        default:
            env[upperType+"_HOST"] = depServiceName
        }
    }

    service := &ComposeService{
        Build: &ComposeBuild{
            Context: contextDir,
        },
        Ports:       ports,
        Environment: env,
        Restart:     "unless-stopped",
    }

    return &GeneratedManifests{
        DockerCompose: service,
    }, nil
}
