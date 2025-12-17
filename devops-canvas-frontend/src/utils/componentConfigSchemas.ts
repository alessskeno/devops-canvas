export interface ConfigField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'password' | 'select' | 'boolean' | 'textarea' | 'node-select';
    options?: { label: string; value: string }[];
    nodeType?: string; // For node-select: 'file' or other component types
    defaultValue?: any;
    placeholder?: string;
    helpText?: string;
}

export const COMPONENT_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
    'redis': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 6379 },
        { key: 'maxmemory', label: 'Max Memory', type: 'text', placeholder: 'e.g. 512mb' },
        {
            key: 'maxmemory-policy',
            label: 'Eviction Policy',
            type: 'select',
            options: [
                { label: 'noeviction', value: 'noeviction' },
                { label: 'allkeys-lru', value: 'allkeys-lru' },
                { label: 'volatile-lru', value: 'volatile-lru' },
                { label: 'allkeys-random', value: 'allkeys-random' },
            ],
            defaultValue: 'noeviction'
        },
        {
            key: 'appendonly',
            label: 'Append Only (AOF)',
            type: 'select',
            options: [
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' }
            ],
            defaultValue: 'no'
        },
        { key: 'requirepass', label: 'Password', type: 'password' }
    ],
    'postgres': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 5432 },
        { key: 'dbName', label: 'Database Name', type: 'text', defaultValue: 'app_db' },
        { key: 'user', label: 'User', type: 'text', defaultValue: 'postgres' },
        { key: 'password', label: 'Password', type: 'password' },
        { key: 'shared_buffers', label: 'Shared Buffers', type: 'text', placeholder: '128MB' },
        { key: 'work_mem', label: 'Work Memory', type: 'text', placeholder: '4MB' },
        { key: 'maintenance_work_mem', label: 'Maintenance Work Mem', type: 'text', placeholder: '64MB' },
        { key: 'effective_cache_size', label: 'Effective Cache Size', type: 'text', placeholder: '4GB' },
        { key: 'max_connections', label: 'Max Connections', type: 'number', defaultValue: 100 },
        { key: 'listen_addresses', label: 'Listen Addresses', type: 'text', defaultValue: '*' },
        { key: 'max_wal_size', label: 'Max WAL Size', type: 'text', placeholder: '1GB' },
        {
            key: 'pg_hba',
            label: 'pg_hba.conf File',
            type: 'node-select',
            nodeType: 'file',
            placeholder: 'Select a Config File Node'
        }
    ],
    'mysql': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 3306 },
        { key: 'root_password', label: 'Root Password', type: 'password' },
        { key: 'database', label: 'Database Name', type: 'text' },
        { key: 'max_connections', label: 'Max Connections', type: 'number', defaultValue: 151 },
        { key: 'innodb_buffer_pool_size', label: 'InnoDB Buffer Pool', type: 'text', placeholder: '128M' },
        { key: 'innodb_file_per_table', label: 'File Per Table', type: 'boolean', defaultValue: true }
    ],
    'clickhouse': [
        { key: 'tcp_port', label: 'TCP Port', type: 'number', defaultValue: 9000 },
        { key: 'http_port', label: 'HTTP Port', type: 'number', defaultValue: 8123 },
        { key: 'max_connections', label: 'Max Connections', type: 'number', defaultValue: 4096 },
        { key: 'max_concurrent_queries', label: 'Max Concurrent Queries', type: 'number', defaultValue: 100 },
        { key: 'max_memory_usage', label: 'Max Memory Usage', type: 'text', placeholder: '0 (unlimited)' },
        { key: 'max_threads', label: 'Max Threads', type: 'number' }
    ],
    'valkey': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 6379 },
        { key: 'maxmemory', label: 'Max Memory', type: 'text', placeholder: '256mb' },
        {
            key: 'maxmemory-policy',
            label: 'Eviction Policy',
            type: 'select',
            options: [
                { label: 'noeviction', value: 'noeviction' },
                { label: 'allkeys-lru', value: 'allkeys-lru' },
                { label: 'volatile-lru', value: 'volatile-lru' },
                { label: 'allkeys-random', value: 'allkeys-random' },
            ],
            defaultValue: 'noeviction'
        },
        {
            key: 'appendonly',
            label: 'Append Only (AOF)',
            type: 'select',
            options: [
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' }
            ],
            defaultValue: 'no'
        },
        { key: 'requirepass', label: 'Password', type: 'password' }
    ],
    'kafka': [
        { key: 'brokers', label: 'Brokers Count', type: 'number', defaultValue: 3 },
        { key: 'retention_ms', label: 'Retention (ms)', type: 'number', defaultValue: 604800000 },
        { key: 'retention_bytes', label: 'Retention (bytes)', type: 'text', placeholder: '-1 (unlimited)' },
        {
            key: 'cleanup_policy',
            label: 'Cleanup Policy',
            type: 'select',
            options: [
                { label: 'delete', value: 'delete' },
                { label: 'compact', value: 'compact' }
            ],
            defaultValue: 'delete'
        },
        { key: 'replication_factor', label: 'Replication Factor', type: 'number', defaultValue: 1 },
        { key: 'partitions', label: 'Default Partitions', type: 'number', defaultValue: 1 }
    ],
    'rabbitmq': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 5672 },
        { key: 'management_port', label: 'Management Port', type: 'number', defaultValue: 15672 },
        { key: 'default_user', label: 'Default User', type: 'text', defaultValue: 'guest' },
        { key: 'default_pass', label: 'Default Password', type: 'password' },
        { key: 'channel_max', label: 'Channel Max', type: 'number', defaultValue: 0 },
        { key: 'max_length', label: 'Max Length (Messages)', type: 'number' },
        { key: 'max_length_bytes', label: 'Max Length (Bytes)', type: 'text' },
        { key: 'message_ttl', label: 'Message TTL (ms)', type: 'number' }
    ],
    'kind-cluster': [
        { key: 'version', label: 'Kubernetes Version', type: 'text', defaultValue: 'v1.27.3' },
        { key: 'nodes', label: 'Node Count', type: 'number', defaultValue: 1 },
        {
            key: 'role',
            label: 'Node Role',
            type: 'select',
            options: [
                { label: 'control-plane', value: 'control-plane' },
                { label: 'worker', value: 'worker' }
            ],
            defaultValue: 'control-plane'
        },
        { key: 'featureGates', label: 'Feature Gates', type: 'text', placeholder: 'GateA=true,GateB=false' },
        { key: 'runtimeConfig', label: 'Runtime Config', type: 'text' }
    ],
    'prometheus': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 9090 },
        { key: 'retention', label: 'Retention Period', type: 'text', defaultValue: '15d' },
        { key: 'scrape_interval', label: 'Scrape Interval', type: 'text', defaultValue: '15s' },
        { key: 'scrape_timeout', label: 'Scrape Timeout', type: 'text', defaultValue: '10s' },
        { key: 'evaluation_interval', label: 'Evaluation Interval', type: 'text', defaultValue: '15s' },
        {
            key: 'scrape_configs',
            label: 'Scrape Configs File',
            type: 'node-select',
            nodeType: 'file',
            placeholder: 'Select a Config File Node'
        },
        {
            key: 'rules_files',
            label: 'Rules Files',
            type: 'node-select',
            nodeType: 'file',
            placeholder: 'Select a Config File Node'
        },
        {
            key: 'alerting',
            label: 'Alerting (Alertmanager)',
            type: 'node-select',
            nodeType: 'alertmanager',
            placeholder: 'Select Alertmanager Node'
        }
    ],
    'alertmanager': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 9093 },
        { key: 'retention', label: 'Retention', type: 'text', defaultValue: '120h' },
        {
            key: 'config_file',
            label: 'Config File',
            type: 'node-select',
            nodeType: 'file',
            placeholder: 'Select Config File Node'
        }
    ],
    'grafana': [
        { key: 'port', label: 'Port', type: 'number', defaultValue: 3000 },
        { key: 'admin_user', label: 'Admin User', type: 'text', defaultValue: 'admin' },
        { key: 'admin_password', label: 'Admin Password', type: 'password' },
        { key: 'allow_sign_up', label: 'Allow Sign Up', type: 'boolean', defaultValue: false }
    ],
    'file': [
        { key: 'filename', label: 'Filename', type: 'text', defaultValue: 'config.yaml' },
        { key: 'content', label: 'File Content', type: 'textarea', placeholder: 'Write your configuration here...' }
    ]
};
