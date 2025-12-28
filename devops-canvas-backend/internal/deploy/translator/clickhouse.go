package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type ClickHouseConfig struct {
    TCPPort              any    `json:"tcp_port,omitempty"`
    HTTPPort             any    `json:"http_port,omitempty"`
    MaxConnections       any    `json:"max_connections,omitempty"`
    MaxConcurrentQueries any    `json:"max_concurrent_queries,omitempty"`
    MaxMemoryUsage       string `json:"max_memory_usage,omitempty"`
    MaxThreads           any    `json:"max_threads,omitempty"`
    Version              string `json:"version"`
}

type ClickHouseTranslator struct{}

func (t *ClickHouseTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config ClickHouseConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse clickhouse config: %v", err)
    }

    version := config.Version
    if version == "" {
        version = "latest"
    }

    httpPort := fmt.Sprintf("%v", config.HTTPPort)
    if httpPort == "" || httpPort == "<nil>" {
        httpPort = "8123"
    }

    tcpPort := fmt.Sprintf("%v", config.TCPPort)
    if tcpPort == "" || tcpPort == "<nil>" {
        tcpPort = "9000"
    }

    // ClickHouse uses config.xml files, hard to pass specific flags via pure env in official image without mounting config.
    // However, we can use ulimits or some envs if supported. 
    // Official image 'clickhouse/clickhouse-server' supports config via /etc/clickhouse-server/config.d/
    
    compose := &ComposeService{
        Image:       "clickhouse/clickhouse-server:" + version,
        Ports:       []string{httpPort + ":8123", tcpPort + ":9000"},
        Environment: map[string]string{
            "CLICKHOUSE_DB": "default",
        },
        Volumes:     []string{"clickhouse_data_" + node.ID + ":/var/lib/clickhouse"},
        Restart:     "always",
    }
    
    // For specific settings like max_connections, we might need to assume we can't easily set them without mounting a file in standard docker compose without custom logic.
    // But for this translator, we can at least ensure basic connectivity.
    
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
    }, nil
}
