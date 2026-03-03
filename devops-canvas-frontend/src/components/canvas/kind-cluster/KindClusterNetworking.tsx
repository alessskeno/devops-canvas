import React from 'react';
import { KindClusterConfig } from '../../../types';
import { Input } from '../../shared/Input';
import { Toggle } from '../../shared/Toggle';
import { KindSectionHeader } from './KindSectionHeader';

interface Props {
    config: KindClusterConfig;
    updateConfig: (updates: Partial<KindClusterConfig>) => void;
    readOnly?: boolean;
    isExpanded: boolean;
    onToggle: (section: string) => void;
}

export function KindClusterNetworking({ config, updateConfig, readOnly, isExpanded, onToggle }: Props) {
    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <KindSectionHeader title="Networking" sectionKey="Networking" isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded && (
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ingress Ready</span>
                            <Toggle
                                checked={config.networking.enableIngress}
                                onChange={(v) => updateConfig({
                                    networking: { ...config.networking, enableIngress: v }
                                })}
                                disabled={readOnly}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Automatically maps host ports 80 and 443 to the control plane, allowing you to use Ingress Controllers.
                        </p>
                    </div>

                    <Input
                        type="number"
                        label="API Server Port (Optional)"
                        placeholder="Default: random"
                        value={config.networking.apiServerPort || ''}
                        onChange={(e) => updateConfig({
                            networking: { ...config.networking, apiServerPort: e.target.value ? parseInt(e.target.value) : undefined }
                        })}
                        disabled={readOnly}
                    />
                </div>
            )}
        </div>
    );
}
