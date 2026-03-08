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
    'prometheus': ['alertmanager', 'grafana', 'file', 'postgres', 'redis', 'mysql', 'kafka', 'rabbitmq', 'clickhouse', 'valkey'],
    'grafana': ['prometheus', 'alertmanager', 'postgres', 'mysql', 'clickhouse'],

    // Config
    'file': ['prometheus', 'alertmanager', 'postgres', 'mysql', 'clickhouse'], // Files can be attached to these
};

export const validateConnection = (sourceType: string, targetType: string): { valid: boolean; message?: string } => {
    const sourceDef = COMPONENT_REGISTRY.find(c => c.type === sourceType);
    const targetDef = COMPONENT_REGISTRY.find(c => c.type === targetType);

    if (!sourceDef || !targetDef) {
        return { valid: false, message: 'Invalid component types.' };
    }

    // Directionality Enforcement
    // Source MUST allow output, because the connection originates from it
    if (sourceDef.allowOutput === false) {
        return { valid: false, message: `${getLabel(sourceType)} cannot have outbound connections.` };
    }

    // Target MUST allow input, because the connection targets it
    if (targetDef.allowInput === false) {
        return { valid: false, message: `${getLabel(targetType)} cannot have inbound connections.` };
    }

    // Rule: Alertmanager can only be connected with Prometheus, Grafana, or File.
    // This applies regardless of who is the 'source' or 'target' in the visual connection.
    const restrictedComponents = ['alertmanager'];
    const isRestricted = (type: string) => restrictedComponents.includes(type);

    // Check Source
    if (isRestricted(sourceType)) {
        const allowed = ['prometheus', 'grafana', 'file'];
        if (!allowed.includes(targetType)) {
            return { valid: false, message: `${getLabel(sourceType)} cannot connect to ${getLabel(targetType)}.` };
        }
    }

    // Check Target
    if (isRestricted(targetType)) {
        const allowed = ['prometheus', 'grafana', 'file'];
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
