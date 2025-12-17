import React, { useRef } from 'react';
import { CanvasNode as NodeData } from '../../types';
import { Database, Server, Box, Layers, Activity, HardDrive, BarChart2, X, Lock, FileText, Bell } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { getComponentByType } from '../../utils/componentRegistry';
import { isFieldSensitive } from '../../utils/security';

interface CanvasNodeProps {
    node: NodeData;
    scale: number;
    isSelected?: boolean;
}

// Map registry icon strings to Lucide components
const IconMap: Record<string, any> = {
    'Container': Box,
    'Database': Database,
    'Layers': Layers,
    'Activity': Activity,
    'Server': Server,
    'HardDrive': HardDrive,
    'BarChart': BarChart2,
    'Bell': Bell,
    'FileText': FileText
};

function CanvasNodeComponent({ node, scale, isSelected }: CanvasNodeProps) {
    const selectNode = useCanvasStore(s => s.selectNode);
    const removeNode = useCanvasStore(s => s.removeNode);
    const updateNodePosition = useCanvasStore(s => s.updateNodePosition);
    const setDraftConnection = useCanvasStore(s => s.setDraftConnection);
    const addConnection = useCanvasStore(s => s.addConnection);
    const setContextMenu = useCanvasStore(s => s.setContextMenu);

    const nodeRef = useRef<HTMLDivElement>(null);
    const definition = getComponentByType(node.type);

    const isDragging = useRef(false);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isDragging.current) {
            selectNode(node.id);
        }
    };

    // Simple drag implementation
    const handleMouseDown = (e: React.MouseEvent) => {
        // Don't start drag if clicking on a port or if locked
        if ((e.target as HTMLElement).hasAttribute('data-port-type')) return;
        if (node.locked) {
            selectNode(node.id);
            return;
        }

        e.stopPropagation();
        isDragging.current = false;

        const startX = e.clientX;
        const startY = e.clientY;
        const startNodeX = node.position.x;
        const startNodeY = node.position.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            isDragging.current = true;
            const deltaX = (moveEvent.clientX - startX) / scale;
            const deltaY = (moveEvent.clientY - startY) / scale;

            updateNodePosition(node.id, {
                x: startNodeX + deltaX,
                y: startNodeY + deltaY
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            nodeId: node.id,
            x: e.clientX,
            y: e.clientY
        });
    };

    // Connection Handlers
    const handlePortMouseDown = (e: React.MouseEvent, type: 'input' | 'output') => {
        e.stopPropagation();
        e.preventDefault();
        if (node.locked) return; // Prevent connecting if locked? Or maybe just dragging. Let's allow connections for now unless implied otherwise.

        if (type === 'output') {
            // Start connection drafting
            // We need the absolute position of the handle for the draft line start
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            // Adjust center based on handle size (w-3 h-3 = 12px -> 6px offset)
            // However, our coordinates in store are in canvas space (transformed).
            // It's easier to use the node position + offset.
            // Separator is around 53px down.
            // Output port is at right edge: x + 256.
            const sourceX = node.position.x + 256;
            const sourceY = node.position.y + 53;

            setDraftConnection({
                sourceId: node.id,
                sourcePos: { x: sourceX, y: sourceY }
            });
        }
    };

    const handlePortMouseUp = (e: React.MouseEvent, type: 'input' | 'output') => {
        e.stopPropagation();

        const draftConnection = useCanvasStore.getState().draftConnection;

        if (type === 'input' && draftConnection) {
            // Complete connection
            if (draftConnection.sourceId !== node.id) {
                addConnection({
                    id: `conn-${Date.now()}`,
                    source: draftConnection.sourceId,
                    target: node.id,
                    animated: true
                });
            }
            setDraftConnection(null);
        }
    };

    // Determine Icon
    const iconName = definition?.icon || 'Server';
    const DisplayIcon = IconMap[iconName] || Server;

    // Determine Colors
    const iconColorClass = definition?.color || 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400';

    return (
        <div
            ref={nodeRef}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            style={{
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                position: 'absolute',
                zIndex: node.selected ? 10 : 1,
            }}
            className={`
                canvas-node group w-64 bg-white dark:bg-slate-900 rounded-xl shadow-sm border-2 group transition-[box-shadow,border-color,background-color] duration-200 z-10 cursor-pointer select-none
                ${(isSelected || node.selected)
                    ? 'border-blue-500 ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md'
                }
            `}
        >
            {/* Header */}
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
                    onMouseUp={(e) => handlePortMouseUp(e, 'input')}
                ></div>

                {/* Output Port (Right) */}
                <div
                    className="absolute -right-[7px] top-[calc(100%+1px)] -translate-y-1/2 w-3.5 h-3.5 bg-white dark:bg-slate-400 border-2 border-slate-200 dark:border-slate-950 rounded-full hover:bg-blue-500 hover:scale-125 transition-all z-20 cursor-crosshair shadow-md node-interactive"
                    title="Output"
                    data-port-type="output"
                    data-node-id={node.id}
                    onMouseDown={(e) => handlePortMouseDown(e, 'output')}
                ></div>
            </div>

            {/* Body */}
            <div className="p-3 bg-gray-50/50 dark:bg-slate-800/50 rounded-b-xl text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex flex-col space-y-2">
                    {Object.entries(node.data)
                        .filter(([key]) => !['label', 'enabled', 'description', 'icon', 'locked'].includes(key))
                        .reduce((acc, [key, value]) => {
                            if (key === 'resources' && typeof value === 'object' && value !== null) {
                                return [...acc, ...Object.entries(value)];
                            }
                            return [...acc, [key, value]];
                        }, [] as [string, any][])
                        .map(([key, value]) => {
                            const isSensitive = isFieldSensitive(node.type, key);
                            return (
                                <div key={key} className="flex justify-between items-center w-full">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{key}</span>
                                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold truncate max-w-[60%] text-right" title={isSensitive ? 'Hidden' : (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value))}>
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
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        Ready
                    </span>
                </div>
            </div>
        </div>
    );
}

export const CanvasNode = React.memo(CanvasNodeComponent);
