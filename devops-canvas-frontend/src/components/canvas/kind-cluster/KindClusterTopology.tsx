import React from 'react';
import { KindClusterConfig } from '../../../types';
import { Input } from '../../shared/Input';
import { KindSectionHeader } from './KindSectionHeader';

interface Props {
    config: KindClusterConfig;
    updateConfig: (updates: Partial<KindClusterConfig>) => void;
    readOnly?: boolean;
    isExpanded: boolean;
    onToggle: (section: string) => void;
}

export function KindClusterTopology({ config, updateConfig, readOnly, isExpanded, onToggle }: Props) {
    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <KindSectionHeader title="Topology" sectionKey="Topology" isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded && (
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            type="number"
                            label="Control Planes"
                            value={config.topology.controlPlanes}
                            onChange={(e) => updateConfig({
                                topology: { ...config.topology, controlPlanes: parseInt(e.target.value) || 1 }
                            })}
                            min={1}
                            disabled={readOnly}
                        />
                        <Input
                            type="number"
                            label="Workers"
                            value={config.topology.workers}
                            onChange={(e) => updateConfig({
                                topology: { ...config.topology, workers: parseInt(e.target.value) || 0 }
                            })}
                            min={0}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900/50">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                            Total Nodes: {config.topology.controlPlanes + config.topology.workers}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
