package translator

import (
    "encoding/json"
    "fmt"
    "devops-canvas-backend/internal/models"
)

type GrafanaConfig struct {
    Port             any    `json:"port"`
    AdminUser        string `json:"admin_user"`
    AdminPassword    string `json:"admin_password"`
    AllowSignUp      bool   `json:"allow_sign_up"`
    Version          string `json:"version"`
}

type GrafanaTranslator struct{}

func (t *GrafanaTranslator) Translate(node models.Node, ctx TranslationContext) (*GeneratedManifests, error) {
    var config GrafanaConfig
    if err := json.Unmarshal(node.Data, &config); err != nil {
        return nil, fmt.Errorf("failed to parse grafana config: %v", err)
    }

    version := config.Version
    if version == "" {
        version = "latest"
    }

    port := fmt.Sprintf("%v", config.Port)
    if port == "" || port == "<nil>" {
        port = "3000"
    }
    
    env := map[string]string{
        "GF_SECURITY_ADMIN_USER": config.AdminUser,
        "GF_SECURITY_ADMIN_PASSWORD": config.AdminPassword,
    }
    
    if config.AllowSignUp {
        env["GF_USERS_ALLOW_SIGN_UP"] = "true"
    } else {
        env["GF_USERS_ALLOW_SIGN_UP"] = "false"
    }

    compose := &ComposeService{
        Image:       "grafana/grafana:" + version,
        Ports:       []string{port + ":3000"},
        Environment: env,
        Volumes:     []string{"grafana_data_" + node.ID + ":/var/lib/grafana"},
        Restart:     "always",
    }

    helm := make(HelmValues)
    helm["image"] = map[string]interface{}{
        "tag": version,
    }
    helm["fullnameOverride"] = "grafana-" + node.ID

    grafanaIni := map[string]interface{}{}
    if config.AllowSignUp {
        grafanaIni["users"] = map[string]interface{}{
            "allow_sign_up": true,
        }
    } else {
         grafanaIni["users"] = map[string]interface{}{
            "allow_sign_up": false,
        }
    }
    helm["grafana.ini"] = grafanaIni
    
    helm["adminUser"] = config.AdminUser
    helm["adminPassword"] = config.AdminPassword

    return &GeneratedManifests{
        DockerCompose: compose,
        HelmValues:    &helm,
    }, nil
}
