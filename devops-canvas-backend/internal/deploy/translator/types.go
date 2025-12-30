package translator

// ComposeService represents a service definition in docker-compose.yaml
type ComposeService struct {
	Image       string            `yaml:"image" json:"image"`
	Ports       []string          `yaml:"ports,omitempty" json:"ports,omitempty"`
	Environment map[string]string `yaml:"environment,omitempty" json:"environment,omitempty"`
	Volumes     []string          `yaml:"volumes,omitempty" json:"volumes,omitempty"`
	Command     []string          `yaml:"command,omitempty" json:"command,omitempty"`
	Restart     string            `yaml:"restart,omitempty" json:"restart,omitempty"`
    Deploy      *DeployConfig     `yaml:"deploy,omitempty" json:"deploy,omitempty"`
}

type DeployConfig struct {
    Resources *ResourcesBlock `yaml:"resources,omitempty" json:"resources,omitempty"`
}

type ResourcesBlock struct {
    Limits ResourceLimits `yaml:"limits,omitempty" json:"limits,omitempty"`
}

type ResourceLimits struct {
    CPUs   string `yaml:"cpus,omitempty" json:"cpus,omitempty"`
    Memory string `yaml:"memory,omitempty" json:"memory,omitempty"`
}

// HelmValues represents a generic structure for values.yaml
// We use map[string]interface{} for maximum flexibility as Helm charts vary wildly
type HelmValues map[string]interface{}

// GeneratedManifests holds the output of the translation
type GeneratedManifests struct {
	DockerCompose *ComposeService           `json:"docker_compose,omitempty"`
    ExtraComposeServices map[string]ComposeService `json:"extra_compose_services,omitempty"` // For translators that generate multiple services
	HelmValues    *HelmValues               `json:"helm_values,omitempty"`
	Configs       map[string]string         `json:"configs,omitempty"` // Filename -> Content
}

type ConfigFile struct {
    Filename string `json:"filename"`
    Content  string `json:"content"`
}

// ChartDependency represents a dependency in Chart.yaml
type ChartDependency struct {
    Name       string `yaml:"name" json:"name"`
    Version    string `yaml:"version" json:"version"`
    Repository string `yaml:"repository" json:"repository"`
    Alias      string `yaml:"alias,omitempty" json:"alias,omitempty"`
}

// ChartMetadata represents Chart.yaml content
type ChartMetadata struct {
    ApiVersion   string            `yaml:"apiVersion" json:"apiVersion"`
    Name         string            `yaml:"name" json:"name"`
    Version      string            `yaml:"version" json:"version"`
    Description  string            `yaml:"description,omitempty" json:"description,omitempty"`
    Dependencies []ChartDependency `yaml:"dependencies,omitempty" json:"dependencies,omitempty"`
}
// ResourceConfig defines CPU and Memory limits
type ResourceConfig struct {
    CPU    float64 `json:"cpu,omitempty"`
    Memory string  `json:"memory,omitempty"`
}

// CommonConfig defines fields shared across most components
type CommonConfig struct {
    Enabled   *bool           `json:"enabled,omitempty"` // Pointer to distinguish false vs missing (default true usually)
    Resources *ResourceConfig `json:"resources,omitempty"`
}
