export interface User {
    id: string;
    email: string;
    name: string;
    job_title?: string;
    mfa_enabled?: boolean;
    preferences?: Record<string, any>;
    role: string;
    createdAt: string;
}

export interface Workspace {
    id: string;
    name: string;
    description?: string;
    environment: 'development' | 'staging' | 'production' | 'custom';
    visibility: 'private' | 'team' | 'public';
    version?: string;
    componentCount: number;
    lastModified: string;
    last_updated_by?: string;
    last_updated_by_name?: string;
    componentTypes?: string[];
}



export interface CanvasNode {
    id: string;
    type: string; // 'postgres', 'redis', 'prometheus', etc.
    position: { x: number; y: number };
    data: ComponentConfig;
    selected?: boolean;
    locked?: boolean;
    measured?: { width?: number; height?: number };
}

export interface Connection {
    id: string;
    source: string; // Node ID
    target: string; // Node ID
    sourceHandle?: string;
    targetHandle?: string;
    animated?: boolean;
}

/** React Flow viewport (pan + zoom), persisted with the workspace canvas. */
export interface CanvasViewport {
    x: number;
    y: number;
    zoom: number;
}



export interface AlertmanagerConfig {
    destination: 'discord' | 'telegram';
    discord?: {
        webhook_url: string;
    };
    telegram?: {
        bot_token: string;
        chat_id: string;
    };
}

export interface ComponentConfig {
    label: string;
    componentType: 'databases' | 'cache' | 'storage' | 'proxy-gateway' | 'auth-security' | 'messaging' | 'search' | 'monitoring' | 'custom' | 'config';
    version?: string;
    alertmanagerConfig?: AlertmanagerConfig;
    status?: 'idle' | 'starting' | 'running' | 'error' | 'stopped';
    ports?: Record<string, string | number>;
    resources?: {
        cpu?: number;
        memory?: string;
        disk?: string;
    };
    env?: Record<string, string>;

    // Generic Docker Compose overrides
    serviceName?: string;
    image?: string;
    tag?: string;
    containerName?: string;
    restartPolicy?: 'always' | 'on-failure' | 'unless-stopped' | 'no';
    command?: string;
    dependsOn?: string[];
    portMappings?: string[]; // e.g., ["5432:5432", "8080:80"]
    envVars?: Record<string, string>; // Preferred generic replacement for `env`
    volumes?: { source: string; target: string; type: 'bind' | 'named' | 'tmpfs' }[];
    networks?: string[];

    // Dynamic properties based on component type
    [key: string]: any;
}

export interface ComponentDefinition {
    type: string;
    name: string;
    description: string;
    icon: string; // simple string identifier for icon component
    category: ComponentConfig['componentType'];
    color?: string; // Tailwind class string, e.g. "text-blue-500 bg-blue-100"
    defaultConfig: Partial<ComponentConfig>;
    allowInput?: boolean;
    allowOutput?: boolean;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface ApiError {
    message: string;
    code?: string;
    details?: any;
}
