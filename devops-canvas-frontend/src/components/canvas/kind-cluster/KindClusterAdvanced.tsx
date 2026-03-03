import React from 'react';
import { KindClusterConfig, CanvasNode, Connection } from '../../../types';
import { Select } from '../../shared/Select';
import { KindSectionHeader } from './KindSectionHeader';

interface Props {
    config: KindClusterConfig;
    updateConfig: (updates: Partial<KindClusterConfig>) => void;
    readOnly?: boolean;
    nodes: CanvasNode[];
    connections: Connection[];
    nodeId: string;
    isExpanded: boolean;
    onToggle: (section: string) => void;
}

export function KindClusterAdvanced({ config, updateConfig, readOnly, nodes, connections, nodeId, isExpanded, onToggle }: Props) {
    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <KindSectionHeader title="Advanced" sectionKey="Advanced" isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded && (
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <Select
                        label="Attach Config File"
                        value={config.advancedConfigNodeId || ''}
                        onChange={(e) => updateConfig({ advancedConfigNodeId: e.target.value })}
                        options={[
                            { label: 'Select a connected node...', value: '' },
                            ...nodes
                                .filter(n => {
                                    const isCorrectType = n.type === 'file';
                                    const isConnected = connections.some(conn =>
                                        (conn.source === nodeId && conn.target === n.id) ||
                                        (conn.target === nodeId && conn.source === n.id)
                                    );
                                    return isCorrectType && isConnected;
                                })
                                .map(n => ({ label: `${n.data.label} (${n.id.slice(0, 4)})`, value: n.id }))
                        ]}
                        disabled={readOnly}
                    />
                    <p className="text-[10px] text-slate-500">
                        Create a "Config File" node, write your YAML patch there, and connect it to this cluster node.
                    </p>
                </div>
            )}
        </div>
    );
}
