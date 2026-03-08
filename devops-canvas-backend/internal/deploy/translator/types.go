package translator

// ComposeBuild represents the build section in docker-compose.yaml
type ComposeBuild struct {
	Context    string `yaml:"context" json:"context"`
	Dockerfile string `yaml:"dockerfile,omitempty" json:"dockerfile,omitempty"`
}

// ComposeService represents a service definition in docker-compose.yaml
type ComposeService struct {
	Image         string            `yaml:"image,omitempty" json:"image,omitempty"`
	ContainerName string            `yaml:"container_name,omitempty" json:"container_name,omitempty"`
	Build         *ComposeBuild     `yaml:"build,omitempty" json:"build,omitempty"`
	Ports         []string          `yaml:"ports,omitempty" json:"ports,omitempty"`
	Environment   map[string]string `yaml:"environment,omitempty" json:"environment,omitempty"`
	Volumes       []string          `yaml:"volumes,omitempty" json:"volumes,omitempty"`
	Command       []string          `yaml:"command,omitempty" json:"command,omitempty"`
	Restart       string            `yaml:"restart,omitempty" json:"restart,omitempty"`
	Deploy        *DeployConfig     `yaml:"deploy,omitempty" json:"deploy,omitempty"`
	DependsOn     []string          `yaml:"depends_on,omitempty" json:"depends_on,omitempty"`
	Networks      []string          `yaml:"networks,omitempty" json:"networks,omitempty"`
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

// GeneratedManifests holds the output of the translation
type GeneratedManifests struct {
	DockerCompose        *ComposeService           `json:"docker_compose,omitempty"`
	ExtraComposeServices map[string]ComposeService `json:"extra_compose_services,omitempty"` // For translators that generate multiple services
	Configs              map[string]string         `json:"configs,omitempty"`                // Filename -> Content
}

type ConfigFile struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
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

// UniversalNodeConfig reads the standardized Docker Compose overrides sent by the frontend
type UniversalNodeConfig struct {
	Enabled       *bool             `json:"enabled,omitempty"` // nil or true = enabled, false = skip service
	ServiceName   string            `json:"serviceName,omitempty"`
	Image         string            `json:"image,omitempty"`
	Tag           string            `json:"tag,omitempty"`
	ContainerName string            `json:"containerName,omitempty"`
	RestartPolicy string            `json:"restartPolicy,omitempty"`
	Command       string            `json:"command,omitempty"`
	DependsOn     []string          `json:"dependsOn,omitempty"`
	PortMappings  []string          `json:"portMappings,omitempty"`
	EnvVars       map[string]string `json:"envVars,omitempty"`
	Networks      []string          `json:"networks,omitempty"`
	Volumes       []VolumeConfig    `json:"volumes,omitempty"`
	Resources     *ResourceConfig   `json:"resources,omitempty"`
}

type VolumeConfig struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
}
