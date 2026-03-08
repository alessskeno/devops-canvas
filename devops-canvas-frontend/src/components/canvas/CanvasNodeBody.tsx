import React from 'react';
import { CanvasNode } from '../../types';
import { isFieldSensitive } from '../../utils/security';
import { useRunningNodeIds } from '../../contexts/RunningNodesContext';

interface CanvasNodeBodyProps {
    node: CanvasNode;
}

export function CanvasNodeBody({ node }: CanvasNodeBodyProps) {
    const runningNodeIds = useRunningNodeIds();
    const isRunning = Boolean(runningNodeIds?.has(node.id));

    return (
        <div className="p-3 bg-gray-50/50 dark:bg-slate-800/50 rounded-b-xl text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div className="flex flex-col space-y-2">
                {Object.entries(node.data)
                    .filter(([key]) => !['label', 'enabled', 'description', 'icon', 'locked', 'buildContextId', 'workspace_id', 'componentType', 'image', 'tag'].includes(key))
                    .reduce((acc, [key, value]) => {
                        if (key === 'resources' && typeof value === 'object' && value !== null) {
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
                {Object.entries(node.data).filter(([key]) => !['label', 'enabled', 'description', 'icon', 'locked', 'image', 'tag'].includes(key)).length === 0 && (
                    <div className="text-center text-[10px] text-slate-400 italic py-1">
                        No configuration
                    </div>
                )}
            </div>

            {/* Status Indicator: Running (when container is up) or Ready / Disabled */}
            <div className="mt-3">
                {node.data.enabled === false ? (
                    <span className="inline-flex items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></div>
                        Disabled
                    </span>
                ) : isRunning ? (
                    <span className="inline-flex items-center text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse"></div>
                        Running
                    </span>
                ) : (
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        Ready
                    </span>
                )}
            </div>
        </div>
    );
}
