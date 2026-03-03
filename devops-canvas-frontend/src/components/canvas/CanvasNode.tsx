import React, { useRef } from 'react';
import { CanvasNode as NodeData } from '../../types';
import { Database, Server, Box, Layers, Activity, HardDrive, BarChart2, FileText, Bell, Boxes, Container, Code } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { getComponentByType } from '../../utils/componentRegistry';
import { validateConnection } from '../../utils/validation';
import toast from 'react-hot-toast';
import { CanvasNodeHeader } from './CanvasNodeHeader';
import { CanvasNodeBody } from './CanvasNodeBody';

interface CanvasNodeProps {
    node: NodeData;
    scale: number;
    isSelected?: boolean;
}

// Map registry icon strings to Lucide components
const IconMap: Record<string, any> = {
    'Container': Container,
    'Box': Box,
    'Boxes': Boxes,
    'Database': Database,
    'Layers': Layers,
    'Activity': Activity,
    'Server': Server,
    'HardDrive': HardDrive,
    'BarChart': BarChart2,
    'Bell': Bell,
    'FileText': FileText,
    'Code': Code
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
            // Validate Connection
            const sourceNode = useCanvasStore.getState().nodes.find(n => n.id === draftConnection.sourceId);
            const targetNode = node; // Current node is target

            if (sourceNode && targetNode) {
                const validation = validateConnection(sourceNode.type, targetNode.type);
                if (!validation.valid) {
                    toast.error(validation.message || 'Invalid connection');
                    setDraftConnection(null);
                    return;
                }
            }

            // Complete connection
            if (draftConnection.sourceId !== node.id) {
                addConnection({
                    id: crypto.randomUUID(),
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
                canvas-node group w-80 bg-white dark:bg-slate-900 rounded-xl shadow-sm border-2 group transition-[box-shadow,border-color,background-color] duration-200 z-10 cursor-pointer select-none outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900
                ${(isSelected || node.selected)
                    ? 'border-blue-500 ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md'
                }
            `}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isSelected) selectNode(node.id);
                }
            }}
        >
            <CanvasNodeHeader
                node={node}
                definition={definition}
                DisplayIcon={DisplayIcon}
                iconColorClass={iconColorClass}
                onPortMouseDown={handlePortMouseDown}
                onPortMouseUp={handlePortMouseUp}
            />
            <CanvasNodeBody node={node} />
        </div>
    );
}

export const CanvasNode = React.memo(CanvasNodeComponent);
