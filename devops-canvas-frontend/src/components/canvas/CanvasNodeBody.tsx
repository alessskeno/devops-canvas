import React from 'react';
import { CanvasNode } from '../../types';
import { isFieldSensitive } from '../../utils/security';

interface CanvasNodeBodyProps {
    node: CanvasNode;
}

export function CanvasNodeBody({ node }: CanvasNodeBodyProps) {
    return (
        <div className="p-3 bg-gray-50/50 dark:bg-slate-800/50 rounded-b-xl text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div className="flex flex-col space-y-2">
                {Object.entries(node.data)
                    .filter(([key]) => !['label', 'enabled', 'description', 'icon', 'locked', 'buildContextId', 'workspace_id', 'componentType'].includes(key))
                    // Filter out monitoring stack keys if disabled
                    .filter(([key]) => {
                        if (node.type !== 'monitoring_stack') return true;

                        const data = node.data;
                        const isGrafanaEnabled = data.enable_grafana === true || data.enable_grafana === 'true';
                        const isAlertmanagerEnabled = data.enable_alertmanager === true || data.enable_alertmanager === 'true';
                        const isPrometheusEnabled = data.enable_prometheus === true || data.enable_prometheus === 'true';

                        if (!isGrafanaEnabled && key.startsWith('grafana_')) return false;
                        if (!isAlertmanagerEnabled && key.startsWith('alertmanager_')) return false;
                        if (!isPrometheusEnabled && key.startsWith('prometheus_')) return false;

                        return true;
                    })
                    .reduce((acc, [key, value]) => {
                        if ((key === 'resources' || key === 'kindConfig') && typeof value === 'object' && value !== null) {
                            return [...acc, ...Object.entries(value)];
                        }
                        return [...acc, [key, value]];
                    }, [] as [string, any][])
                    .sort((a, b) => {
                        const priority = ['name', 'version', 'replicas', 'topology', 'networking', 'mounts'];
                        const idxA = priority.indexOf(a[0]);
                        const idxB = priority.indexOf(b[0]);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a[0].localeCompare(b[0]);
                    })
                    .map(([key, value]) => {
                        const isSensitive = isFieldSensitive(node.type, key);
                        return (
                            <div key={key} className="flex justify-between items-center w-full gap-2">
                                <span
                                    className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex-1 min-w-0"
                                    title={key}
                                >
                                    {key}
                                </span>
                                <span
                                    className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold truncate max-w-[50%] text-right shrink-0"
                                    title={isSensitive ? 'Hidden' : (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value))}
                                >
                                    {isSensitive
                                        ? '••••••••'
                                        : (typeof value === 'object' && value !== null
                                            ? JSON.stringify(value).replace(/["{}]/g, '').replace(/,/g, ', ')
                                            : String(value))}
                                </span>
                            </div>
                        );
                    })}

                {/* Render message if empty */}
                {Object.entries(node.data).filter(([key]) => !['label', 'enabled', 'description', 'icon', 'locked'].includes(key)).length === 0 && (
                    <div className="text-center text-[10px] text-slate-400 italic py-1">
                        No configuration
                    </div>
                )}
            </div>

            {/* Status Indicator (Simplified) */}
            <div className="mt-3">
                {node.data.enabled !== false ? (
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        Ready
                    </span>
                ) : (
                    <span className="inline-flex items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></div>
                        Disabled
                    </span>
                )}
            </div>
        </div>
    );
}
