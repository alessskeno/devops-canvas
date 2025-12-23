import { ComponentDefinition } from '../types';
import { COMPONENT_REGISTRY } from './componentRegistry';

/**
 * Defines the allowed connection rules.
 * Key: Source Component Type
 * Value: Array of allowed Target Component Types
 * 
 * If a component type is missing from this map, it defaults to allowing all connections (or none depending on policy).
 * We will assume permissive by default unless specified.
 */

const CONNECTION_RULES: Record<string, string[]> = {
    // Monitoring
    'alertmanager': ['prometheus', 'grafana', 'file'],
    'prometheus': ['alertmanager', 'grafana', 'file', 'kind-cluster', 'postgres', 'redis', 'mysql', 'kafka', 'rabbitmq', 'clickhouse', 'valkey'],
    'grafana': ['prometheus', 'alertmanager', 'postgres', 'mysql', 'clickhouse'],

    // Config
    'file': ['kind-cluster', 'prometheus', 'alertmanager', 'postgres', 'mysql', 'clickhouse'], // Files can be attached to these
};

export const validateConnection = (sourceType: string, targetType: string): { valid: boolean; message?: string } => {
    // Rule: Alertmanager can only be connected with Prometheus, Grafana, or File.
    // This applies regardless of who is the 'source' or 'target' in the visual connection.
    const restrictedComponents = ['alertmanager'];

    const isRestricted = (type: string) => restrictedComponents.includes(type);

    // Check Source
    if (isRestricted(sourceType)) {
        const allowed = ['prometheus', 'grafana', 'file', 'kind-cluster'];
        if (!allowed.includes(targetType)) {
            return { valid: false, message: `${getLabel(sourceType)} cannot connect to ${getLabel(targetType)}.` };
        }
    }

    // Check Target
    if (isRestricted(targetType)) {
        const allowed = ['prometheus', 'grafana', 'file', 'kind-cluster'];
        if (!allowed.includes(sourceType)) {
            return { valid: false, message: `${getLabel(targetType)} cannot connect with ${getLabel(sourceType)}.` };
        }
    }

    return { valid: true };
};

// Helper to get readable name
const getLabel = (type: string) => {
    return COMPONENT_REGISTRY.find(c => c.type === type)?.name || type;
};
