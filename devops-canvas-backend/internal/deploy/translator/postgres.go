package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type PostgresConfig struct {
    Version            string `json:"version"`
    Port               any    `json:"port"`
    User               string `json:"user,omitempty"`
    Password           string `json:"password,omitempty"`
    DatabaseName       string `json:"dbName,omitempty"` // Frontend key is "dbName"
    SharedBuffers      string `json:"shared_buffers,omitempty"`
    WorkMem            string `json:"work_mem,omitempty"`
    MaintenanceWorkMem string `json:"maintenance_work_mem,omitempty"`
    EffectiveCacheSize string `json:"effective_cache_size,omitempty"`
    MaxConnections     any    `json:"max_connections,omitempty"`
    ListenAddresses    string `json:"listen_addresses,omitempty"`
    MaxWalSize         string `json:"max_wal_size,omitempty"`
}

type PostgresTranslator struct{}

func (t *PostgresTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config PostgresConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse postgres config: %v", err)
    }

    // Default values
    version := config.Version
    if version == "" {
        version = "15"
    }
    
    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "5432"
    }
    
    user := config.User
    if user == "" {
        user = "postgres"
    }

    // Docker Compose
    env := map[string]string{
        "POSTGRES_USER":     user,
        "POSTGRES_PASSWORD": config.Password,
    }
    if config.DatabaseName != "" {
        env["POSTGRES_DB"] = config.DatabaseName
    }

    // Postgres config tuning via command args
    command := []string{"postgres"}
    
    if config.SharedBuffers != "" {
        command = append(command, "-c", "shared_buffers="+config.SharedBuffers)
    }
    if config.WorkMem != "" {
        command = append(command, "-c", "work_mem="+config.WorkMem)
    }
    if config.MaxConnections != nil {
        command = append(command, "-c", fmt.Sprintf("max_connections=%v", config.MaxConnections))
    }
    if config.MaxWalSize != "" {
        command = append(command, "-c", "max_wal_size="+config.MaxWalSize)
    }
    
    // File Generation
    generatedConfigs := make(map[string]string)
    volumes := []string{"postgres_data_" + node.ID + ":/var/lib/postgresql/data"}
    
    // Handle pg_hba.conf
    // The schema says `pg_hba` is the key for the node-select
    // We need to parse this locally; struct definition didn't have it before, adding it via map check or updating struct
    // Let's rely on Unmarshal into a map for dynamic fields or update struct above.
    // I will use a map to extract the node ID string first because the struct field might depend on how it was saved.
    // Actually, I'll just check if I can add it to the struct.
    // Wait, I can't easily modify the struct inside this Replace block if I don't see the top. 
    // I will assume explicit map parsing for safety or re-declare struct in this block if possible.
    // Re-declaring struct here works if I replace the whole function.
    
    // Look for pg_hba in raw data map to be safe
    var rawData map[string]interface{}
    _ = json.Unmarshal(node.Data, &rawData)
    
    if pgHbaNodeID, ok := rawData["pg_hba"].(string); ok && pgHbaNodeID != "" {
         fileNode, err := ctx.FindNodeByID(pgHbaNodeID)
         if err == nil {
             var fileConfig ConfigFile
             if err := json.Unmarshal(fileNode.Data, &fileConfig); err == nil {
                 // Use consistent naming for volume mount
                 fileName := fmt.Sprintf("pg_hba_%s.conf", node.ID)
                 generatedConfigs[fileName] = fileConfig.Content
                 // Mount it
                 volumes = append(volumes, fmt.Sprintf("./configs/%s:/etc/postgresql/pg_hba.conf", fileName))
                 // Postgres requires explicit config file enabling if hba is swapped sometimes, but usually just overwriting /var/lib/postgresql/data/pg_hba.conf works if volume is data.
                 // However, official image uses /var/lib/postgresql/data. Mounting single file into volume dir is tricky.
                 // Better to mount to /etc/postgresql/pg_hba.conf and use -c hba_file=...
                 command = append(command, "-c", "hba_file=/etc/postgresql/pg_hba.conf")
             }
         }
    }

    compose := &ComposeService{
        Image:       "postgres:" + version,
        Ports:       []string{port + ":5432"},
        Environment: env,
        Volumes:     volumes,
        Command:     command,
        Restart:     "always",
    }

    // Helm Values (Bitnami structure)
    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    helm["auth"] = map[string]interface{}{
        "username": user,
        "password": config.Password,
        "database": config.DatabaseName,
    }
    helm["primary"] = map[string]interface{}{
        "service": map[string]interface{}{
            "ports": map[string]interface{}{
                "postgresql": config.Port,
            },
        },
    }
    
    // Additional configuration via 'primary.configuration' or 'postgresqlConfiguration'
    extraConfig := ""
    if config.SharedBuffers != "" {
        extraConfig += fmt.Sprintf("shared_buffers = %s\n", config.SharedBuffers)
    }
    if config.MaxConnections != nil {
        extraConfig += fmt.Sprintf("max_connections = %v\n", config.MaxConnections)
    }
    if extraConfig != "" {
         helm["primary"].(map[string]interface{})["extendedConfiguration"] = extraConfig
    }
    
    // For Helm, we would add pgHbaConfiguration
    if pgHbaNodeID, ok := rawData["pg_hba"].(string); ok && pgHbaNodeID != "" {
         // Re-fetch logic or reuse if I extracted it cleanly. 
         // For brevity in block, assuming logical flow. 
         // In production code, I'd extract this lookup to top.
          fileNode, _ := ctx.FindNodeByID(pgHbaNodeID)
          if fileNode != nil {
              var fileConfig ConfigFile
              _ = json.Unmarshal(fileNode.Data, &fileConfig)
              helm["primary"].(map[string]interface{})["pgHbaConfiguration"] = fileConfig.Content
          }
    }

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
        Configs:       generatedConfigs,
    }, nil
}
