import { ComponentDefinition } from "../types";

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
    // Infrastructure
    {
        type: 'kind-cluster',
        name: 'Kind Cluster',
        description: 'Local Kubernetes cluster',
        icon: 'Boxes',
        category: 'infrastructure',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: {
            label: 'Kind Cluster',
            kindConfig: {
                name: 'dev-cluster',
                version: '',
                topology: { controlPlanes: 1, workers: 2 },
                networking: { enableIngress: true },
                mounts: []
            }
        }
    },
    {
        type: 'docker-compose',
        name: 'Docker Compose',
        description: 'Local Docker Environment',
        icon: 'Container',
        category: 'infrastructure',
        color: 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30',
        defaultConfig: {
            label: 'Docker Compose',
            composeConfig: {
                version: '3.8',
            }
        }
    },
    // Databases
    {
        type: 'postgres',
        name: 'PostgreSQL',
        description: 'Relational Database',
        icon: 'Database',
        category: 'database',
        color: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
        defaultConfig: { label: 'Primary DB' }
    },
    {
        type: 'mysql',
        name: 'MySQL',
        description: 'Relational Database',
        icon: 'Database',
        category: 'database',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: { label: 'MySQL DB' }
    },
    {
        type: 'clickhouse',
        name: 'ClickHouse',
        description: 'OLAP Database for Analytics',
        icon: 'BarChart',
        category: 'database',
        color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
        defaultConfig: { label: 'Analytics DB' }
    },
    // Caching
    {
        type: 'redis',
        name: 'Redis',
        description: 'In-memory Cache',
        icon: 'Layers',
        category: 'caching',
        color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
        defaultConfig: { label: 'Cache Layer' }
    },
    {
        type: 'valkey',
        name: 'Valkey',
        description: 'High-performance KV Store',
        icon: 'Layers',
        category: 'caching',
        color: 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30',
        defaultConfig: { label: 'Valkey Cache' }
    },
    // Messaging
    {
        type: 'kafka',
        name: 'Kafka',
        description: 'Event Streaming Platform',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
        defaultConfig: { label: 'Event Stream' }
    },
    {
        type: 'rabbitmq',
        name: 'RabbitMQ',
        description: 'Message Broker',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
        defaultConfig: { label: 'Message Queue' }
    },
    // Monitoring

    {
        type: 'monitoring_stack',
        name: 'Monitoring Stack',
        description: 'Kube-Prometheus-Stack (Prometheus + Grafana + Alertmanager)',
        icon: 'Activity',
        category: 'monitoring',
        color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
        defaultConfig: { label: 'Monitoring Stack' }
    },
    // Configuration
    {
        type: 'file',
        name: 'Config File',
        description: 'Text/Config Content',
        icon: 'FileText',
        category: 'configuration',
        color: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700',
        defaultConfig: { label: 'config.yaml' }
    }
];

export const getComponentByType = (type: string) => COMPONENT_REGISTRY.find(c => c.type === type);
