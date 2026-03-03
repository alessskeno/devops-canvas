package translator

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "strings"

    "devops-canvas-backend/internal/models"
)

// CustomContainerConfig defines the expected JSON data from the frontend
type CustomContainerConfig struct {
    CommonConfig
    Label          string `json:"label"`
    BuildContextID string `json:"buildContextId"`
    ContainerPort  any    `json:"containerPort"`
    HostPort       any    `json:"hostPort"`
    EnvVars        string `json:"envVars"` // KEY=VALUE pairs, one per line
}

type CustomContainerTranslator struct{}

func (t *CustomContainerTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config CustomContainerConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse custom-container config: %v", err)
    }

    // Check Enabled status
    if config.Enabled != nil && !*config.Enabled {
        return nil, nil
    }

    // Validate build context
    if config.BuildContextID == "" {
        return nil, fmt.Errorf("custom container '%s': no build context uploaded. Please upload your source directory first", config.Label)
    }

    contextDir := filepath.Join("/tmp/contexts", config.BuildContextID)

    // Verify Dockerfile exists in the uploaded context
    dockerfilePath := filepath.Join(contextDir, "Dockerfile")
    if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
        return nil, fmt.Errorf("custom container '%s': no Dockerfile found in uploaded context. The source directory must contain a Dockerfile", config.Label)
    }

    // Parse ports
    containerPort := fmt.Sprintf("%v", config.ContainerPort)
    if containerPort == "" || containerPort == "<nil>" || containerPort == "0" {
        containerPort = "8080"
    }

    hostPort := fmt.Sprintf("%v", config.HostPort)
    if hostPort == "" || hostPort == "<nil>" || hostPort == "0" {
        hostPort = containerPort
    }

    // Build environment variables
    env := make(map[string]string)

    // Parse user-provided env vars
    if config.EnvVars != "" {
        for _, line := range strings.Split(config.EnvVars, "\n") {
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
    var dependsOn []string

    for _, dep := range connectedNodes {
        // Skip infrastructure nodes
        if dep.Type == "kind-cluster" || dep.Type == "docker-compose" || dep.Type == "file" || dep.Type == "custom-container" {
            continue
        }

        // Build the service name the same way GenerateManifests does
        depServiceName := fmt.Sprintf("%s-%s", dep.Type, dep.ID[:4])
        dependsOn = append(dependsOn, depServiceName)

        // Auto-inject common connection environment variables
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
            // Generic: just set HOST
            env[upperType+"_HOST"] = depServiceName
        }
    }

    // Build the ComposeService
    service := &ComposeService{
        Build: &ComposeBuild{
            Context: contextDir,
        },
        Ports: []string{
            fmt.Sprintf("%s:%s", hostPort, containerPort),
        },
        Environment: env,
        Restart:     "unless-stopped",
        DependsOn:   dependsOn,
    }

    return &GeneratedManifests{
        DockerCompose: service,
    }, nil
}
