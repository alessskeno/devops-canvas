import React from 'react';
import { KindClusterConfig } from '../../../types';
import { Input } from '../../shared/Input';
import { Select } from '../../shared/Select';
import { KindSectionHeader } from './KindSectionHeader';

interface Props {
    config: KindClusterConfig;
    updateConfig: (updates: Partial<KindClusterConfig>) => void;
    readOnly?: boolean;
    isExpanded: boolean;
    onToggle: (section: string) => void;
    versionState: { loading: boolean; versions: { label: string; value: string }[] };
}

export function KindClusterGeneral({ config, updateConfig, readOnly, isExpanded, onToggle, versionState }: Props) {
    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <KindSectionHeader title="General" sectionKey="General" isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded && (
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <Input
                        label="Cluster Name"
                        value={config.name}
                        onChange={(e) => updateConfig({ name: e.target.value })}
                        disabled={readOnly}
                        placeholder="e.g. my-cluster"
                    />
                    <Select
                        label="Kubernetes Version"
                        value={config.version}
                        onChange={(e) => updateConfig({ version: e.target.value })}
                        options={versionState.loading ? [{ label: "Loading versions...", value: "" }] : versionState.versions}
                        disabled={readOnly || versionState.loading}
                    />
                </div>
            )}
        </div>
    );
}
