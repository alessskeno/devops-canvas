import React from 'react';
import { Lock } from 'lucide-react';
import { CanvasNode } from '../../types';

interface CanvasNodeHeaderProps {
    node: CanvasNode;
    definition: any;
    DisplayIcon: any;
    iconColorClass: string;
    onPortMouseDown: (e: React.MouseEvent, type: 'input' | 'output') => void;
    onPortMouseUp: (e: React.MouseEvent, type: 'input' | 'output') => void;
}

export function CanvasNodeHeader({
    node,
    definition,
    DisplayIcon,
    iconColorClass,
    onPortMouseDown,
    onPortMouseUp
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
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate mt-0.5">
                    {definition?.name || node.type}
                </p>
            </div>

            {node.locked && (
                <div className="text-slate-400 dark:text-slate-500 mr-1" title="Node Locked">
                    <Lock size={14} />
                </div>
            )}

            {/* Port Handles - Positioned on the separator line */}
            {/* Input Port (Left) */}
            <div
                className="absolute -left-[7px] top-[calc(100%+1px)] -translate-y-1/2 w-3.5 h-3.5 bg-white dark:bg-slate-400 border-2 border-slate-200 dark:border-slate-950 rounded-full hover:bg-blue-500 hover:scale-125 transition-all z-20 cursor-crosshair shadow-md node-interactive"
                title="Input"
                data-port-type="input"
                data-node-id={node.id}
                role="button"
                tabIndex={0}
                aria-label="Input Port"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                    }
                }}
                onMouseUp={(e) => onPortMouseUp(e, 'input')}
            ></div>

            {/* Output Port (Right) - Only if NOT infrastructure */}
            {definition?.category !== 'infrastructure' && (
                <div
                    className="absolute -right-[7px] top-[calc(100%+1px)] -translate-y-1/2 w-3.5 h-3.5 bg-white dark:bg-slate-400 border-2 border-slate-200 dark:border-slate-950 rounded-full hover:bg-blue-500 hover:scale-125 transition-all z-20 cursor-crosshair shadow-md node-interactive"
                    title="Output"
                    data-port-type="output"
                    data-node-id={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label="Output Port"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                        }
                    }}
                    onMouseDown={(e) => onPortMouseDown(e, 'output')}
                ></div>
            )}
        </div>
    );
}
