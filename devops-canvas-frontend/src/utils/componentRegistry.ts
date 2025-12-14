import { ComponentDefinition } from "../types";

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
    // Infrastructure
    {
        type: 'kind-cluster',
        name: 'Kind Cluster',
        description: 'Local Kubernetes cluster',
        icon: 'Container',
        category: 'infrastructure',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: { label: 'Kind Cluster', nodes: 3, version: '1.27.3' }
    },
    // Databases
    {
        type: 'postgres',
        name: 'PostgreSQL',
        description: 'Relational Database',
        icon: 'Database',
        category: 'database',
        color: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
        defaultConfig: { label: 'Primary DB', port: 5432, dbName: 'app_prod', user: 'postgres' }
    },
    {
        type: 'mysql',
        name: 'MySQL',
        description: 'Relational Database',
        icon: 'Database',
        category: 'database',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: { label: 'MySQL DB', port: 3306, user: 'root' }
    },
    {
        type: 'clickhouse',
        name: 'ClickHouse',
        description: 'OLAP Database for Analytics',
        icon: 'BarChart',
        category: 'database',
        color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
        defaultConfig: { label: 'Analytics DB', port: 8123 }
    },
    // Caching
    {
        type: 'redis',
        name: 'Redis',
        description: 'In-memory Cache',
        icon: 'Layers',
        category: 'caching',
        color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
        defaultConfig: { label: 'Cache Layer', port: 6379, maxMemory: '512mb' }
    },
    {
        type: 'valkey',
        name: 'Valkey',
        description: 'High-performance KV Store',
        icon: 'Layers',
        category: 'caching',
        color: 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30',
        defaultConfig: { label: 'Valkey Cache', port: 6379 }
    },
    // Messaging
    {
        type: 'kafka',
        name: 'Kafka',
        description: 'Event Streaming Platform',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
        defaultConfig: { label: 'Event Stream', brokers: 3 }
    },
    {
        type: 'rabbitmq',
        name: 'RabbitMQ',
        description: 'Message Broker',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
        defaultConfig: { label: 'Message Queue', port: 5672, managementPort: 15672 }
    }
];

export const getComponentByType = (type: string) => COMPONENT_REGISTRY.find(c => c.type === type);
