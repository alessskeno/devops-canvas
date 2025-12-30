import { CanvasNode, Connection } from '../types';
import { isFieldSensitive } from './security';
import yaml from 'js-yaml';

const sanitizeData = (data: any, componentType: string): any => {
    if (!data) return data;
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item, componentType));
    }
    if (typeof data === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(data)) {
            // Check if this specific field is sensitive for this component type
            if (isFieldSensitive(componentType, key)) {
                sanitized[key] = '********';
            } else {
                // Recursively sanitize, passing the component type down
                // Note: Nested objects might not strictly follow the top-level schema check, 
                // but usually sensitive fields are unique enough or we recurse.
                // However, isFieldSensitive likely checks the top-level keys.
                // If value is an object, we should recurse.
                sanitized[key] = sanitizeData(value, componentType);
            }
        }
        return sanitized;
    }
    return data;
};

export const generateConfig = (
    nodes: CanvasNode[],
    connections: Connection[],
    format: 'yaml' | 'json',
    excludeSecrets: boolean
): string => {
    let exportedNodes = nodes;

    if (excludeSecrets) {
        exportedNodes = nodes.map(node => ({
            ...node,
            data: sanitizeData(node.data, node.type)
        }));
    }

    const config: Record<string, any> = {
        version: '1.0',
        nodes: exportedNodes,
        connections: connections
    };

    // Services generation removed as per user request for "only canvas state"
    // The previous logic transformed nodes into a simplified "services" map for GitOps.
    // If we need this back, we should add a specific toggle for "Include Service Config".

    if (format === 'json') {
        return JSON.stringify(config, null, 2);
    } else {
        return yaml.dump(config);
    }
};
