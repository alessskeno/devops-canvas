import React, { useState, useEffect } from 'react';

import api from '../../utils/api';
import { KindClusterConfig, CanvasNode, Connection } from '../../types';
import { KindClusterGeneral } from './kind-cluster/KindClusterGeneral';
import { KindClusterTopology } from './kind-cluster/KindClusterTopology';
import { KindClusterNetworking } from './kind-cluster/KindClusterNetworking';
import { KindClusterStorage } from './kind-cluster/KindClusterStorage';
import { KindClusterAdvanced } from './kind-cluster/KindClusterAdvanced';
import { KindClusterPreview } from './kind-cluster/KindClusterPreview';
import { generateKindConfig } from '../../utils/kindConfig';

interface Props {
    config: KindClusterConfig;
    onChange: (config: KindClusterConfig) => void;
    readOnly?: boolean;
    nodes: CanvasNode[];
    connections: Connection[];
    nodeId: string;
}

export function KindClusterConfigForm({ config, onChange, readOnly, nodes, connections, nodeId }: Props) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'General': true,
        'Topology': false,
        'Networking': false,
        'Storage': false,
        'Advanced': false,
        'Preview': false
    });

    const [versionState, dispatchVersions] = React.useReducer(
        (state: any, action: any) => {
            switch (action.type) {
                case 'FETCH_START': return { ...state, loading: true };
                case 'FETCH_SUCCESS': return { loading: false, versions: action.payload };
                case 'FETCH_ERROR': return { ...state, loading: false };
                default: return state;
            }
        },
        { loading: false, versions: [] }
    );

    useEffect(() => {
        const fetchVersions = async () => {
            dispatchVersions({ type: 'FETCH_START' });
            try {
                const res = await api.get('/components/kind-cluster/versions');
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    dispatchVersions({ type: 'FETCH_SUCCESS', payload: res.data });

                    // Auto-select latest version if none selected or if it was the old default
                    if (!config.version || config.version === 'v1.27.3' || config.version === '') {
                        onChange({ ...config, version: res.data[0].value });
                    }
                } else {
                    dispatchVersions({ type: 'FETCH_ERROR' });
                }
            } catch (error) {
                console.error("Failed to fetch k8s versions", error);
                dispatchVersions({ type: 'FETCH_ERROR', error });
            }
        };
        fetchVersions();
    }, []);
    // ... (fetchedVersions logic unchanged)

    // Ensure config has all fields (migrations for existing nodes)
    const safeConfig: KindClusterConfig = {
        name: config?.name || 'kind',
        version: config?.version || 'kindest/node:v1.31.0',
        topology: {
            controlPlanes: config?.topology?.controlPlanes || 1,
            workers: config?.topology?.workers || 0,
        },
        networking: {
            enableIngress: config?.networking?.enableIngress || false,
            apiServerPort: config?.networking?.apiServerPort,
        },
        mounts: config?.mounts || [],
        advancedConfigNodeId: config?.advancedConfigNodeId || '',
    };

    // Maintain local state for mounts with stable IDs to avoid array index keys
    const [localMounts, setLocalMounts] = useState(() =>
        safeConfig.mounts.map(m => ({ id: crypto.randomUUID(), ...m }))
    );

    // Sync local mounts to config when they change (debounced or direct?)
    // We'll update parent on every change for simplicity, matching existing behavior
    const updateMounts = (newMounts: typeof localMounts) => {
        setLocalMounts(newMounts);
        onChange({ ...safeConfig, mounts: newMounts.map(({ id, ...m }) => m) });
    };

    // Sync from props if external config changes length (reset) - optional but good practice
    useEffect(() => {
        if (config.mounts && config.mounts.length !== localMounts.length) {
            // Only reset if length differs to avoid fighting. 
            // Ideally we'd compare content but that's expensive.
            // For now, trust local state for edits.
        }
    }, [config.mounts]);

    const updateConfig = (updates: Partial<KindClusterConfig>) => {
        onChange({ ...safeConfig, ...updates });
    };

    const getAttachedFileContent = () => {
        if (!safeConfig.advancedConfigNodeId) return undefined;
        const fileNode = nodes.find(n => n.id === safeConfig.advancedConfigNodeId);
        // Assuming file content is stored in 'content' field of data
        return fileNode?.data?.content as string;
    };

    // Helper to determine final config for preview
    const finalConfigContent = getAttachedFileContent() || generateKindConfig(safeConfig, undefined);

    // ... (rest of logic)

    // In Preview Section:
    /*
        <pre ...>
            {finalConfigContent}
        </pre>
    */

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-md">
            {/* Content Groups */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">

                {/* General Group */}
                {/* General Group */}
                <KindClusterGeneral
                    config={safeConfig}
                    updateConfig={updateConfig}
                    readOnly={readOnly}
                    isExpanded={expandedSections['General']}
                    onToggle={toggleSection}
                    versionState={versionState}
                />

                <KindClusterTopology
                    config={safeConfig}
                    updateConfig={updateConfig}
                    readOnly={readOnly}
                    isExpanded={expandedSections['Topology']}
                    onToggle={toggleSection}
                />

                <KindClusterNetworking
                    config={safeConfig}
                    updateConfig={updateConfig}
                    readOnly={readOnly}
                    isExpanded={expandedSections['Networking']}
                    onToggle={toggleSection}
                />

                <KindClusterStorage
                    localMounts={localMounts}
                    updateMounts={updateMounts}
                    readOnly={readOnly}
                    isExpanded={expandedSections['Storage']}
                    onToggle={toggleSection}
                />

                <KindClusterAdvanced
                    config={safeConfig}
                    updateConfig={updateConfig}
                    readOnly={readOnly}
                    nodes={nodes}
                    connections={connections}
                    nodeId={nodeId}
                    isExpanded={expandedSections['Advanced']}
                    onToggle={toggleSection}
                />

                <KindClusterPreview
                    config={safeConfig}
                    isExpanded={expandedSections['Preview']}
                    onToggle={toggleSection}
                    getAttachedFileContent={getAttachedFileContent}
                />

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-600 dark:text-blue-400">
                    Configure parameters specific to kind-cluster.
                </div>
            </div>
        </div>
    );
}
