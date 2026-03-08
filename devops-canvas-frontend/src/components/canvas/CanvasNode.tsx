import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CanvasNode as NodeData } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { getComponentByType } from '../../utils/componentRegistry';
import { getComponentIcon } from '../../utils/componentIcons';
import { CanvasNodeHeader } from './CanvasNodeHeader';
import { CanvasNodeBody } from './CanvasNodeBody';

function CanvasNodeComponent({ id, data, selected }: NodeProps) {
    const setContextMenu = useCanvasStore(s => s.setContextMenu);
    const nodes = useCanvasStore(s => s.nodes);

    const node = nodes.find(n => n.id === id);
    if (!node) return null;

    const definition = getComponentByType(node.type);
    const DisplayIcon = getComponentIcon(node.type);
    const iconColorClass = definition?.color || 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400';

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ nodeId: id, x: e.clientX, y: e.clientY });
    };

    return (
        <div
            onContextMenu={handleContextMenu}
            className={`
                canvas-node group w-80 bg-white dark:bg-slate-900 rounded-xl shadow-sm border-2 transition-[box-shadow,border-color,background-color] duration-200 cursor-pointer select-none outline-none
                ${selected
                    ? 'border-blue-500 ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md'
                }
            `}
        >
            {/* Input Handle (Left) */}
            {definition?.allowInput !== false && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3.5 !h-3.5 !bg-slate-300 dark:!bg-slate-500 !border-2 !border-slate-400 dark:!border-slate-700 !rounded-full hover:!bg-blue-500 hover:!border-blue-400 !transition-colors !shadow-md"
                    style={{ top: '53px' }}
                />
            )}

            {/* Output Handle (Right) */}
            {definition?.allowOutput !== false && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3.5 !h-3.5 !bg-slate-300 dark:!bg-slate-500 !border-2 !border-slate-400 dark:!border-slate-700 !rounded-full hover:!bg-blue-500 hover:!border-blue-400 !transition-colors !shadow-md"
                    style={{ top: '53px' }}
                />
            )}

            <CanvasNodeHeader
                node={node}
                definition={definition}
                DisplayIcon={DisplayIcon}
                iconColorClass={iconColorClass}
            />
            <CanvasNodeBody node={node} />
        </div>
    );
}

export const CanvasNode = React.memo(CanvasNodeComponent);
