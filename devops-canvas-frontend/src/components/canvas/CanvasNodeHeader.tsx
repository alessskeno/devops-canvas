import React from 'react';
import { Lock } from 'lucide-react';
import { CanvasNode } from '../../types';

interface CanvasNodeHeaderProps {
    node: CanvasNode;
    definition: any;
    DisplayIcon: any;
    iconColorClass: string;
}

export function CanvasNodeHeader({
    node,
    definition,
    DisplayIcon,
    iconColorClass,
}: CanvasNodeHeaderProps) {
    return (
        <div className="p-3 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 relative">
            <div className={`
                p-2 rounded-lg mr-3 shadow-sm border border-black/5 dark:border-white/10
                ${iconColorClass}
            `}>
                <DisplayIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                    {node.data.label}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5" title={node.data.image != null ? `${node.data.image}:${node.data.tag ?? 'latest'}` : undefined}>
                    {node.data.image != null && String(node.data.image).trim() !== ''
                        ? `${node.data.image}:${node.data.tag ?? 'latest'}`
                        : (definition?.name || node.type)}
                </p>
            </div>

            {node.locked && (
                <div className="text-slate-400 dark:text-slate-500 mr-1" title="Node Locked">
                    <Lock size={14} />
                </div>
            )}
        </div>
    );
}
