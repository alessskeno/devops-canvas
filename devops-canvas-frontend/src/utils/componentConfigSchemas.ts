export interface ConfigField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'password' | 'select' | 'boolean' | 'textarea' | 'node-select';
    options?: { label: string; value: string }[];
    dynamicOptions?: boolean; // If true, fetch options from API
    nodeType?: string; // For node-select: 'file' or other component types
    defaultValue?: any;
    placeholder?: string;
    helpText?: string;
    group?: string; // For grouping fields into tabs/accordions
}

export const COMPONENT_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
    'redis': [
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
                        { key: 'root_password', label: 'Root Password', type: 'password' },
        { key: 'database', label: 'Database Name', type: 'text' },
        { key: 'user', label: 'User', type: 'text', placeholder: 'Optional app user' },
        { key: 'password', label: 'Password', type: 'password', placeholder: 'Optional app user password' },
        { key: 'max_connections', label: 'Max Connections', type: 'number', defaultValue: 151 },
        { key: 'innodb_buffer_pool_size', label: 'InnoDB Buffer Pool', type: 'text', placeholder: '128M' },
        { key: 'innodb_file_per_table', label: 'File Per Table', type: 'boolean', defaultValue: true }
    ],
    'clickhouse': [],
    'valkey': [
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
        { key: 'default_user', label: 'Default User', type: 'text', defaultValue: 'guest' },
        { key: 'default_pass', label: 'Default Password', type: 'password' },
        { key: 'channel_max', label: 'Channel Max', type: 'number', defaultValue: 0 },
        { key: 'max_length', label: 'Max Length (Messages)', type: 'number' },
        { key: 'max_length_bytes', label: 'Max Length (Bytes)', type: 'text' },
        { key: 'message_ttl', label: 'Message TTL (ms)', type: 'number' }
    ],

    'prometheus': [
                { key: 'retention', label: 'Retention Period', type: 'text', defaultValue: '15d', placeholder: 'e.g. 15d' },
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
        }
    ],
    'grafana': [
                { key: 'admin_user', label: 'Admin User', type: 'text', defaultValue: 'admin' },
        { key: 'admin_password', label: 'Admin Password', type: 'password' },
        { key: 'allow_sign_up', label: 'Allow Sign Up', type: 'boolean', defaultValue: false }
    ],
    'alertmanager': [
                { key: 'retention', label: 'Retention', type: 'text', defaultValue: '120h' }
    ],
    'custom-container': [
        {
            key: 'buildContext',
            label: 'Source Directory',
            type: 'folder-upload' as any,
            helpText: 'Upload the folder containing your Dockerfile and source code'
        },
        { key: 'containerPort', label: 'Container Port', type: 'number', defaultValue: 8080, helpText: 'Port your app listens on inside the container' },
        { key: 'hostPort', label: 'Host Port', type: 'number', defaultValue: 8080, helpText: 'Port exposed on the host machine' }
    ],
    'mongodb': [
                        { key: 'database', label: 'Database Name', type: 'text', defaultValue: 'app_db' },
        { key: 'root_username', label: 'Root Username', type: 'text', defaultValue: 'admin' },
        { key: 'root_password', label: 'Root Password', type: 'password' },
    ],
    'mariadb': [
                        { key: 'root_password', label: 'Root Password', type: 'password' },
        { key: 'database', label: 'Database Name', type: 'text' },
        { key: 'user', label: 'User', type: 'text', placeholder: 'Optional app user' },
        { key: 'password', label: 'Password', type: 'password', placeholder: 'Optional app user password' },
        { key: 'max_connections', label: 'Max Connections', type: 'number', defaultValue: 151 },
    ],
    'cassandra': [
        { key: 'cluster_name', label: 'Cluster Name', type: 'text', defaultValue: 'Test Cluster' },
        { key: 'num_tokens', label: 'Num Tokens', type: 'number', defaultValue: 256 },
    ],
    'cockroachdb': [
        { key: 'database', label: 'Database Name', type: 'text', defaultValue: 'defaultdb' },
    ],
    'neo4j': [
        { key: 'auth_password', label: 'Auth Password', type: 'password' },
    ],
    'minio': [
        { key: 'root_user', label: 'Root User', type: 'text', defaultValue: 'minioadmin' },
        { key: 'root_password', label: 'Root Password', type: 'password' },
    ],
    'nginx': [
        { key: 'config_file', label: 'Config File', type: 'node-select', nodeType: 'file', placeholder: 'Select a Config File Node' },
    ],
    'traefik': [
        { key: 'enable_dashboard', label: 'Enable Dashboard', type: 'boolean', defaultValue: true },
    ],
    'apache-http': [
        { key: 'public_folder', label: 'Public folder (htdocs)', type: 'text', defaultValue: './public', helpText: 'Host path mounted at /usr/local/apache2/htdocs' },
    ],
    'kong': [
        { key: 'database', label: 'Database', type: 'select', options: [{ label: 'off (DB-less)', value: 'off' }, { label: 'postgres', value: 'postgres' }], defaultValue: 'off' },
    ],
    'keycloak': [
        { key: 'admin_user', label: 'Admin User', type: 'text', defaultValue: 'admin' },
        { key: 'admin_password', label: 'Admin Password', type: 'password' },
    ],
    'vault': [
        { key: 'dev_root_token', label: 'Dev Root Token', type: 'password', placeholder: 'myroot' },
    ],
    'supabase': [
        { key: 'postgres_password', label: 'PostgreSQL Password', type: 'password', placeholder: 'Superuser password for Postgres' },
        { key: 'anon_key', label: 'Anon Key (JWT)', type: 'password' },
        { key: 'service_role_key', label: 'Service Role Key (JWT)', type: 'password' },
    ],
    'nats': [
        { key: 'jetstream', label: 'Enable JetStream', type: 'boolean', defaultValue: false },
    ],
    'elasticsearch': [
        { key: 'cluster_name', label: 'Cluster Name', type: 'text', defaultValue: 'docker-cluster' },
        { key: 'discovery_type', label: 'Discovery Type', type: 'text', defaultValue: 'single-node' },
        { key: 'es_java_opts', label: 'Java Opts (ES_JAVA_OPTS)', type: 'text', defaultValue: '-Xms512m -Xmx512m', placeholder: '-Xms512m -Xmx512m' },
    ],
    'meilisearch': [
        { key: 'master_key', label: 'Master Key', type: 'password' },
        { key: 'environment', label: 'Environment', type: 'select', options: [{ label: 'development', value: 'development' }, { label: 'production', value: 'production' }], defaultValue: 'development' },
    ],
    'opensearch': [
        { key: 'cluster_name', label: 'Cluster Name', type: 'text', defaultValue: 'opensearch-cluster' },
        { key: 'discovery_type', label: 'Discovery Type', type: 'text', defaultValue: 'single-node' },
        { key: 'disable_security', label: 'Disable Security Plugin', type: 'boolean', defaultValue: true, helpText: 'Set DISABLE_SECURITY_PLUGIN=true (recommended for dev/test)' },
    ],
    'influxdb': [
        { key: 'init_mode', label: 'Init Mode', type: 'text', defaultValue: 'setup', helpText: 'DOCKER_INFLUXDB_INIT_MODE (setup or upgrade)' },
        { key: 'username', label: 'Username', type: 'text', defaultValue: 'admin' },
        { key: 'password', label: 'Password', type: 'password' },
        { key: 'org', label: 'Organization', type: 'text', defaultValue: 'my-org' },
        { key: 'bucket', label: 'Bucket', type: 'text', defaultValue: 'my-bucket' },
    ],
    'jaeger': [],
    'file': [
        { key: 'label', label: 'Filename / label', type: 'text', defaultValue: 'config.yaml', helpText: 'Display name and filename hint (e.g. nginx.conf, config.yaml)' },
        { key: 'content', label: 'File content', type: 'textarea', placeholder: 'Paste or type config content…', helpText: 'Content of the config file (e.g. nginx config, pg_hba.conf). Used when this file is attached to a service.' },
    ],
};

