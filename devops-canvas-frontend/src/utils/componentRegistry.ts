import { ComponentDefinition } from "../types";

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
    // ─── Databases ────────────────────────────────────────────────────
    {
        type: 'postgres',
        name: 'PostgreSQL',
        description: 'Relational Database',
        icon: 'Database',
        category: 'databases',
        color: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
        defaultConfig: { label: 'Primary DB', image: 'postgres', tag: 'latest', portMappings: ['5432:5432'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'mysql',
        name: 'MySQL',
        description: 'Relational Database',
        icon: 'Database',
        category: 'databases',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: { label: 'MySQL DB', image: 'mysql', tag: 'latest', portMappings: ['3306:3306'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'mongodb',
        name: 'MongoDB',
        description: 'Document Database',
        icon: 'Database',
        category: 'databases',
        color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
        defaultConfig: { label: 'MongoDB', image: 'mongo', tag: 'latest', portMappings: ['27017:27017'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'mariadb',
        name: 'MariaDB',
        description: 'Relational Database',
        icon: 'Database',
        category: 'databases',
        color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
        defaultConfig: { label: 'MariaDB', image: 'mariadb', tag: 'latest', portMappings: ['3306:3306'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'clickhouse',
        name: 'ClickHouse',
        description: 'OLAP Database for Analytics',
        icon: 'BarChart',
        category: 'databases',
        color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
        defaultConfig: { label: 'Analytics DB', image: 'clickhouse/clickhouse-server', tag: 'latest', portMappings: ['8123:8123', '9000:9000'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'cassandra',
        name: 'Cassandra',
        description: 'Wide-Column NoSQL Database',
        icon: 'Database',
        category: 'databases',
        color: 'text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/30',
        defaultConfig: { label: 'Cassandra', image: 'cassandra', tag: 'latest', portMappings: ['9042:9042'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'cockroachdb',
        name: 'CockroachDB',
        description: 'Distributed SQL Database',
        icon: 'Database',
        category: 'databases',
        color: 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30',
        defaultConfig: { label: 'CockroachDB', image: 'cockroachdb/cockroach', tag: 'latest', portMappings: ['26257:26257', '8080:8080'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'neo4j',
        name: 'Neo4j',
        description: 'Graph Database',
        icon: 'Network',
        category: 'databases',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: { label: 'Neo4j', image: 'neo4j', tag: 'latest', portMappings: ['7474:7474', '7687:7687'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },

    // ─── Cache ────────────────────────────────────────────────────────
    {
        type: 'redis',
        name: 'Redis',
        description: 'In-memory Cache',
        icon: 'Layers',
        category: 'cache',
        color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
        defaultConfig: { label: 'Cache Layer', image: 'redis', tag: 'latest', portMappings: ['6379:6379'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'valkey',
        name: 'Valkey',
        description: 'High-performance KV Store',
        icon: 'Layers',
        category: 'cache',
        color: 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30',
        defaultConfig: { label: 'Valkey Cache', image: 'valkey/valkey', tag: 'latest', portMappings: ['6379:6379'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },

    // ─── Storage ──────────────────────────────────────────────────────
    {
        type: 'minio',
        name: 'MinIO',
        description: 'S3-Compatible Object Storage',
        icon: 'Archive',
        category: 'storage',
        color: 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30',
        defaultConfig: { label: 'MinIO', image: 'minio/minio', tag: 'latest', portMappings: ['9000:9000', '9001:9001'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },

    // ─── Proxy & Gateway ──────────────────────────────────────────────
    {
        type: 'nginx',
        name: 'Nginx',
        description: 'Web Server & Reverse Proxy',
        icon: 'Globe',
        category: 'proxy-gateway',
        color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
        defaultConfig: { label: 'Nginx', image: 'nginx', tag: 'latest', portMappings: ['80:80'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'traefik',
        name: 'Traefik',
        description: 'Cloud-Native Reverse Proxy',
        icon: 'Globe',
        category: 'proxy-gateway',
        color: 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30',
        defaultConfig: { label: 'Traefik', image: 'traefik', tag: 'latest', portMappings: ['80:80', '8080:8080'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'apache-http',
        name: 'Apache HTTP',
        description: 'HTTP Web Server',
        icon: 'Globe',
        category: 'proxy-gateway',
        color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
        defaultConfig: { label: 'Apache HTTP', image: 'httpd', tag: 'latest', portMappings: ['80:80'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'kong',
        name: 'Kong Gateway',
        description: 'API Gateway & Service Mesh',
        icon: 'Globe',
        category: 'proxy-gateway',
        color: 'text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30',
        defaultConfig: { label: 'Kong Gateway', image: 'kong', tag: 'latest', portMappings: ['8000:8000', '8001:8001'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },

    // ─── Auth & Security ──────────────────────────────────────────────
    {
        type: 'keycloak',
        name: 'Keycloak',
        description: 'Identity & Access Management',
        icon: 'Shield',
        category: 'auth-security',
        color: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30',
        defaultConfig: { label: 'Keycloak', image: 'quay.io/keycloak/keycloak', tag: 'latest', portMappings: ['8080:8080'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'vault',
        name: 'Vault',
        description: 'Secrets Management',
        icon: 'Key',
        category: 'auth-security',
        color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
        defaultConfig: { label: 'Vault', image: 'hashicorp/vault', tag: 'latest', portMappings: ['8200:8200'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'supabase',
        name: 'Supabase',
        description: 'Backend-as-a-Service with Auth',
        icon: 'Shield',
        category: 'auth-security',
        color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
        defaultConfig: { label: 'Supabase', image: 'supabase/gotrue', tag: 'latest', portMappings: ['9999:9999'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },

    // ─── Messaging ────────────────────────────────────────────────────
    {
        type: 'rabbitmq',
        name: 'RabbitMQ',
        description: 'Message Broker',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
        defaultConfig: { label: 'Message Queue', image: 'rabbitmq', tag: 'latest', portMappings: ['5672:5672', '15672:15672'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'kafka',
        name: 'Apache Kafka',
        description: 'Event Streaming Platform',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
        defaultConfig: { label: 'Event Stream', image: 'bitnami/kafka', tag: 'latest', portMappings: ['9092:9092'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'nats',
        name: 'NATS',
        description: 'Cloud-Native Messaging System',
        icon: 'Activity',
        category: 'messaging',
        color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
        defaultConfig: { label: 'NATS', image: 'nats', tag: 'latest', portMappings: ['4222:4222', '8222:8222', '6222:6222'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },

    // ─── Search ───────────────────────────────────────────────────────
    {
        type: 'elasticsearch',
        name: 'Elasticsearch',
        description: 'Search & Analytics Engine',
        icon: 'Search',
        category: 'search',
        color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
        defaultConfig: { label: 'Elasticsearch', image: 'elasticsearch', tag: 'latest', portMappings: ['9200:9200'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'meilisearch',
        name: 'Meilisearch',
        description: 'Instant Search Engine',
        icon: 'Search',
        category: 'search',
        color: 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30',
        defaultConfig: { label: 'Meilisearch', image: 'getmeili/meilisearch', tag: 'latest', portMappings: ['7700:7700'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'opensearch',
        name: 'OpenSearch',
        description: 'Open Source Search Suite',
        icon: 'Search',
        category: 'search',
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        defaultConfig: { label: 'OpenSearch', image: 'opensearchproject/opensearch', tag: 'latest', portMappings: ['9200:9200', '9600:9600'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },

    // ─── Monitoring ───────────────────────────────────────────────────
    {
        type: 'prometheus',
        name: 'Prometheus',
        description: 'Metrics & Monitoring',
        icon: 'Gauge',
        category: 'monitoring',
        color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
        defaultConfig: { label: 'Prometheus', image: 'prom/prometheus', tag: 'latest', portMappings: ['9090:9090'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'grafana',
        name: 'Grafana',
        description: 'Observability Dashboard',
        icon: 'Gauge',
        category: 'monitoring',
        color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
        defaultConfig: { label: 'Grafana', image: 'grafana/grafana', tag: 'latest', portMappings: ['3000:3000'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: true
    },
    {
        type: 'alertmanager',
        name: 'Alertmanager',
        description: 'Alert Routing & Notifications',
        icon: 'Bell',
        category: 'monitoring',
        color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
        defaultConfig: { label: 'Alertmanager', image: 'prom/alertmanager', tag: 'latest', portMappings: ['9093:9093'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'influxdb',
        name: 'InfluxDB',
        description: 'Time Series Database',
        icon: 'Gauge',
        category: 'monitoring',
        color: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
        defaultConfig: { label: 'InfluxDB', image: 'influxdb', tag: 'latest', portMappings: ['8086:8086'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },
    {
        type: 'jaeger',
        name: 'Jaeger',
        description: 'Distributed Tracing Platform',
        icon: 'Gauge',
        category: 'monitoring',
        color: 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30',
        defaultConfig: { label: 'Jaeger', image: 'jaegertracing/all-in-one', tag: 'latest', portMappings: ['16686:16686', '14268:14268'], restartPolicy: 'always' },
        allowInput: true,
        allowOutput: false
    },

    // ─── Custom ───────────────────────────────────────────────────────
    {
        type: 'custom-container',
        name: 'Custom Container',
        description: 'Build & run your own Dockerfile',
        icon: 'Code',
        category: 'custom',
        color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
        defaultConfig: {
            label: 'My App',
            buildContextId: '',
            containerPort: 8080,
            hostPort: 8080,
            envVars: {}
        },
        allowInput: true,
        allowOutput: true
    },

    // ─── Config ───────────────────────────────────────────────────────
    {
        type: 'file',
        name: 'Config File',
        description: 'Text/Config Content',
        icon: 'FileText',
        category: 'config',
        color: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700',
        defaultConfig: { label: 'config.yaml' },
        allowInput: false,
        allowOutput: true
    }
];

export const getComponentByType = (type: string) => COMPONENT_REGISTRY.find(c => c.type === type);
