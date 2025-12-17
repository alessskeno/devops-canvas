import { CanvasNode, Connection } from '../types';
import { isFieldSensitive } from './security';

export const generateConfig = (
    nodes: CanvasNode[],
    connections: Connection[],
    format: 'yaml' | 'json',
    excludeSecrets: boolean
): string => {
    const config: Record<string, any> = {
        version: '1.0',
        services: {}
    };

    nodes.forEach(node => {
        // Skip config files from the main services list, they are attachments
        if (node.type === 'file') return;

        // Create a specialized ID/Name for the service
        const serviceName = `${node.type}-${node.id.slice(0, 4)}`;
        const serviceData: Record<string, any> = {};

        // Iterate through all data fields
        Object.entries(node.data).forEach(([key, value]) => {
            // Skip UI-only fields
            if (['label', 'enabled', 'description', 'icon', 'locked', 'componentId'].includes(key)) return;

            // Check sensitivity
            if (excludeSecrets && isFieldSensitive(node.type, key)) {
                return; // Exclude sensitive data
            }

            serviceData[key] = value;
        });

        // Add type info
        serviceData['_type'] = node.type;
        serviceData['_label'] = node.data.label;

        config.services[serviceName] = serviceData;
    });

    if (format === 'json') {
        return JSON.stringify(config, null, 2);
    } else {
        return toYaml(config);
    }
};

/**
 * Simple YAML serializer for basic configuration objects.
 * Supports nested objects and arrays.
 */
function toYaml(obj: any, indentLevel = 0): string {
    const indent = ' '.repeat(indentLevel);

    if (obj === null || obj === undefined) return '';

    if (typeof obj !== 'object') {
        return String(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'object') {
                return `${indent}- \n${toYaml(item, indentLevel + 2).replace(/^\s+/, indent + '  ')}`;
            }
            return `${indent}- ${item}`;
        }).join('\n');
    }

    return Object.entries(obj).map(([key, value]) => {
        if (value === undefined) return '';

        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value) && value.length === 0) {
                return `${indent}${key}: []`;
            }
            const nested = toYaml(value, indentLevel + 2);
            if (!nested.trim()) return `${indent}${key}: {}`;
            return `${indent}${key}:\n${nested}`;
        }

        return `${indent}${key}: ${value}`;
    }).filter(line => line !== '').join('\n');
}
