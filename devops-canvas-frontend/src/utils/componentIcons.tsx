import React from 'react';
import {
    SiPostgresql,
    SiMysql,
    SiMongodb,
    SiMariadb,
    SiClickhouse,
    SiApachecassandra,
    SiCockroachlabs,
    SiNeo4j,
    SiRedis,
    SiMinio,
    SiNginx,
    SiTraefikproxy,
    SiApache,
    SiKong,
    SiKeycloak,
    SiVault,
    SiSupabase,
    SiRabbitmq,
    SiApachekafka,
    SiNatsdotio,
    SiElasticsearch,
    SiMeilisearch,
    SiOpensearch,
    SiPrometheus,
    SiGrafana,
    SiInfluxdb,
    SiJaeger,
    SiDocker,
    SiYaml,
} from '@icons-pack/react-simple-icons';

/** Icon component type: accepts size (number or string), className, color. */
type SimpleIconComponent = React.ComponentType<{ size?: number | string; className?: string; color?: string }>;

/** Map component type to Simple Icons component. Used for canvas nodes and component library. */
const COMPONENT_ICON_MAP: Record<string, SimpleIconComponent> = {
    postgres: SiPostgresql,
    mysql: SiMysql,
    mongodb: SiMongodb,
    mariadb: SiMariadb,
    clickhouse: SiClickhouse,
    cassandra: SiApachecassandra,
    cockroachdb: SiCockroachlabs,
    neo4j: SiNeo4j,
    redis: SiRedis,
    valkey: SiRedis,
    minio: SiMinio,
    nginx: SiNginx,
    traefik: SiTraefikproxy,
    'apache-http': SiApache,
    kong: SiKong,
    keycloak: SiKeycloak,
    vault: SiVault,
    supabase: SiSupabase,
    rabbitmq: SiRabbitmq,
    kafka: SiApachekafka,
    nats: SiNatsdotio,
    elasticsearch: SiElasticsearch,
    meilisearch: SiMeilisearch,
    opensearch: SiOpensearch,
    prometheus: SiPrometheus,
    grafana: SiGrafana,
    alertmanager: SiPrometheus,
    influxdb: SiInfluxdb,
    jaeger: SiJaeger,
    'custom-container': SiDocker,
    file: SiYaml,
};

const DEFAULT_ICON = SiDocker;

/**
 * Returns the Simple Icon component for a given component type.
 * Icons accept size (string | number) and optional className/color.
 */
export function getComponentIcon(type: string): SimpleIconComponent {
    return COMPONENT_ICON_MAP[type] ?? DEFAULT_ICON;
}
