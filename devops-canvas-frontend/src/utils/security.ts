import { COMPONENT_CONFIG_SCHEMAS } from './componentConfigSchemas';

/**
 * Determines if a configuration field is sensitive and should be masked.
 * 
 * Logic:
 * 1. Checks the component schema. If the field is defined as type 'password', it is sensitive.
 * 2. If not defined in schema (or no schema exists), checks for sensitive keywords in the key name.
 * 
 * @param componentType The type of the component (e.g., 'postgres', 'redis')
 * @param key The configuration key (e.g., 'password', 'requirepass')
 * @returns true if the field should be treated as sensitive
 */
export const isFieldSensitive = (componentType: string, key: string): boolean => {
    // 1. Schema Check
    const schema = COMPONENT_CONFIG_SCHEMAS[componentType];
    if (schema) {
        const field = schema.find(f => f.key === key);
        if (field) {
            // If explicitly defined in schema, rely on the type
            return field.type === 'password';
        }
    }

    // 2. Fallback Heuristics (for custom fields or undefined components)
    const lowerKey = key.toLowerCase();
    // Extended list of sensitive keywords
    const sensitiveKeywords = ['password', 'secret', 'token', 'key', 'auth', 'credential', 'passphrase'];

    return sensitiveKeywords.some(keyword => lowerKey.includes(keyword));
};
