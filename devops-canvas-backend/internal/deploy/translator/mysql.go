package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type MySQLConfig struct {
    Version            string `json:"version"`
    Port               any    `json:"port"` // Can be string or int
    RootPassword       string `json:"root_password,omitempty"`
    DatabaseName       string `json:"database,omitempty"` // Key is "database" in frontend
    MaxConnections     any    `json:"max_connections,omitempty"`
    InnoDBBufferPool   string `json:"innodb_buffer_pool_size,omitempty"`
    InnoDBFilePerTable bool   `json:"innodb_file_per_table,omitempty"`
}

type MySQLTranslator struct{}

func (t *MySQLTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config MySQLConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse mysql config: %v", err)
    }

    // Default values
    version := config.Version
    if version == "" {
        version = "8.0"
    }
    
    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "3306"
    }

    // Docker Compose
    env := map[string]string{
        "MYSQL_ROOT_PASSWORD": config.RootPassword,
    }
    if config.DatabaseName != "" {
        env["MYSQL_DATABASE"] = config.DatabaseName
    }

    // Construct command with flags
    // Official image allows passing flags after image name
    command := []string{}
    
    if config.MaxConnections != nil {
        command = append(command, fmt.Sprintf("--max-connections=%v", config.MaxConnections))
    }
    if config.InnoDBBufferPool != "" {
        command = append(command, fmt.Sprintf("--innodb-buffer-pool-size=%s", config.InnoDBBufferPool))
    }
    // innodb_file_per_table is enabled by default in 8.0, checking explicit false if needed or just enforcement
    // Frontend default is true.
    if !config.InnoDBFilePerTable {
         command = append(command, "--innodb-file-per-table=0")
    }

    compose := &ComposeService{
        Image:       "mysql:" + version,
        Ports:       []string{port + ":3306"},
        Environment: env,
        Volumes:     []string{"mysql_data_" + node.ID + ":/var/lib/mysql"},
        Command:     command,
        Restart:     "always",
    }

    // Helm Values (Bitnami structure)
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    helm["auth"] = map[string]interface{}{
        "rootPassword": config.RootPassword,
        "database":     config.DatabaseName,
    }
    helm["primary"] = map[string]interface{}{
        "service": map[string]interface{}{
            "ports": map[string]interface{}{
                "mysql": config.Port,
            },
        },
    }
    
    // Add additional configs to 'configuration' string
    extraConfig := ""
    if config.MaxConnections != nil {
        extraConfig += fmt.Sprintf("max_connections=%v\n", config.MaxConnections)
    }
    if config.InnoDBBufferPool != "" {
        extraConfig += fmt.Sprintf("innodb_buffer_pool_size=%s\n", config.InnoDBBufferPool)
    }
    if !config.InnoDBFilePerTable {
        extraConfig += "innodb_file_per_table=0\n"
    }
    
    if extraConfig != "" {
        helm["primary"].(map[string]interface{})["configuration"] = extraConfig
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
    }, nil
}
