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

export interface NodePort {
    id: string;
    type: 'input' | 'output';
    label?: string;
}

export interface CanvasNode {
    id: string;
    type: string; // 'kind-cluster', 'postgres', 'redis', etc.
    position: { x: number; y: number };
    data: ComponentConfig;
    selected?: boolean;
    locked?: boolean;
}

export interface Connection {
    id: string;
    source: string; // Node ID
    target: string; // Node ID
    sourceHandle?: string;
    targetHandle?: string;
    animated?: boolean;
}

export interface KindClusterConfig {
    name: string;
    version: string;
    topology: {
        controlPlanes: number;
        workers: number;
    };
    networking: {
        enableIngress: boolean;
        apiServerPort?: number;
    };
    mounts: Array<{ hostPath: string; containerPath: string }>;
    advancedConfigNodeId?: string;
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
    componentType: 'infrastructure' | 'database' | 'queue' | 'caching' | 'custom' | 'messaging' | 'analytics' | 'monitoring' | 'configuration';
    version?: string;
    kindConfig?: KindClusterConfig;
    alertmanagerConfig?: AlertmanagerConfig;
    status?: 'idle' | 'starting' | 'running' | 'error' | 'stopped';
    ports?: Record<string, string | number>;
    resources?: {
        cpu?: number;
        memory?: string;
        disk?: string;
    };
    env?: Record<string, string>;
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
