import React, { useRef, useMemo, useCallback } from 'react';
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    SelectionMode,
    useViewport,
    MarkerType,
    type Connection as RFConnection,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    useReactFlow,
} from '@xyflow/react';
import { AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvasNode } from './CanvasNode';
import { ConnectionLine } from './ConnectionLine';
import { CanvasNode as NodeType } from '../../types';
import { ContextMenu } from './ContextMenu';
import { COMPONENT_CONFIG_SCHEMAS } from '../../utils/componentConfigSchemas';
import { COMPONENT_REGISTRY } from '../../utils/componentRegistry';
import { CursorOverlay } from './CursorOverlay';
import { FileEditorPanel } from './FileEditorPanel';
import { validateConnection } from '../../utils/validation';
import { toast } from 'sonner';
import { Layers, MousePointer2 } from 'lucide-react';

interface CanvasAreaProps {
    runningNodeIds?: Set<string>;
    onNodeExec?: (nodeId: string) => void;
    onViewLogs?: (nodeId: string) => void;
    activeCursors: { [key: string]: { x: number, y: number, name: string } };
    sendCursorMove: (x: number, y: number) => void;
    fileEditorNode?: NodeType | null;
    onCloseFileEditor?: () => void;
}

const nodeTypes: NodeTypes = (() => {
    const types: Record<string, any> = {};
    COMPONENT_REGISTRY.forEach(comp => {
        types[comp.type] = CanvasNode;
    });
    return types;
})();

const edgeTypes: EdgeTypes = {
    custom: ConnectionLine as any,
};

const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2;

/** Dot gap/size scale with zoom so dots stay easy on the eye at all zoom levels. */
function ZoomAwareBackground() {
    const { zoom } = useViewport();
    const roundedZoom = Math.round(zoom * 100) / 100;
    const { gap, size } = useMemo(() => {
        const t = (roundedZoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
        const gap = Math.round(32 - t * 20);
        const size = Math.round((1.8 - t * 0.9) * 10) / 10;
        return { gap: Math.max(10, Math.min(36, gap)), size: Math.max(0.6, Math.min(2, size)) };
    }, [roundedZoom]);
    return (
        <Background
            variant={BackgroundVariant.Dots}
            gap={gap}
            size={size}
            className="!bg-gray-50 dark:!bg-slate-950 canvas-background"
        />
    );
}

export const CanvasArea = React.forwardRef<HTMLDivElement, CanvasAreaProps>(function CanvasArea(
    { runningNodeIds, onNodeExec, onViewLogs, activeCursors, sendCursorMove, fileEditorNode, onCloseFileEditor },
    forwardedRef
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastCursorSend = useRef(0);
    const reactFlowInstance = useReactFlow();

    const {
        nodes, connections, handleNodeChanges,
        addConnection, selectNode,
        removeConnection, addNode,
        contextMenu, setContextMenu,
        duplicateNode, toggleLockNode, removeNode, removeNodes,
        setActivePanelTab, selectedNodeIds, clearSelection
    } = useCanvasStore();

    const rfNodes = useMemo(() =>
        nodes.map(n => ({
            ...n,
            draggable: !n.locked,
        })),
        [nodes]
    );

    const rfEdges: Edge[] = useMemo(() =>
        connections.map(conn => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            type: 'custom',
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
            data: {
                animated: conn.animated || (runningNodeIds?.has(conn.source) && runningNodeIds?.has(conn.target)),
                status: (runningNodeIds?.has(conn.source) && runningNodeIds?.has(conn.target)) ? 'running' : 'default',
            },
        })),
        [connections, runningNodeIds]
    );

    const onConnect = useCallback((connection: RFConnection) => {
        if (!connection.source || !connection.target) return;

        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (sourceNode && targetNode) {
            const validation = validateConnection(sourceNode.type, targetNode.type);
            if (!validation.valid) {
                toast.error(validation.message || 'Invalid connection');
                return;
            }
        }

        addConnection({
            id: crypto.randomUUID(),
            source: connection.source,
            target: connection.target,
            animated: true,
        });
    }, [nodes, addConnection]);

    const isValidConnection = useCallback((connection: RFConnection | Edge) => {
        if (!connection.source || !connection.target) return false;
        if (connection.source === connection.target) return false;

        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) return false;

        const validation = validateConnection(sourceNode.type, targetNode.type);
        return validation.valid;
    }, [nodes]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/react-dnd-component');
        const configStr = e.dataTransfer.getData('application/react-dnd-config');

        if (type) {
            const position = reactFlowInstance.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
            });

            let initialData = configStr ? JSON.parse(configStr) : { label: 'New Component' };

            const schema = COMPONENT_CONFIG_SCHEMAS[type];
            if (schema) {
                const defaults = schema.reduce((acc: any, field: any) => {
                    if (field.defaultValue !== undefined) {
                        acc[field.key] = field.defaultValue;
                    }
                    return acc;
                }, {} as any);
                initialData = { ...defaults, ...initialData };
            }

            const newNode: NodeType = {
                id: crypto.randomUUID(),
                type,
                position,
                data: initialData,
            };

            addNode(newNode);
        }
    }, [reactFlowInstance, addNode]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const now = Date.now();
        if (now - lastCursorSend.current > 50) {
            const position = reactFlowInstance.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
            });
            sendCursorMove(position.x, position.y);
            lastCursorSend.current = now;
        }
    }, [reactFlowInstance, sendCursorMove]);

    const handlePaneClick = useCallback(() => {
        setContextMenu(null);
        clearSelection();
    }, [clearSelection, setContextMenu]);

    const handleNodesDelete = useCallback((nodesToDelete: { id: string; locked?: boolean; data?: { locked?: boolean } }[]) => {
        const ids = nodesToDelete
            .filter((n) => !n.locked && !n.data?.locked)
            .map((n) => n.id);
        if (ids.length > 0) removeNodes(ids);
    }, [removeNodes]);

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
        event.preventDefault();
        setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    }, [setContextMenu]);

    return (
        <div
            ref={(el) => {
                (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                if (typeof forwardedRef === 'function') forwardedRef(el);
                else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-slate-950 selection:bg-transparent select-none"
            style={{ touchAction: 'none' }}
            onMouseMove={handleMouseMove}
        >
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={handleNodeChanges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onConnect={onConnect}
                isValidConnection={isValidConnection}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onPaneClick={handlePaneClick}
                onNodeContextMenu={handleNodeContextMenu}
                onNodesDelete={handleNodesDelete}
                deleteKeyCode={['Backspace', 'Delete']}
                panActivationKeyCode={null}
                multiSelectionKeyCode="Meta"
                selectionMode={SelectionMode.Partial}
                selectNodesOnDrag={false}
                minZoom={ZOOM_MIN}
                maxZoom={ZOOM_MAX}
                fitView={false}
                proOptions={{ hideAttribution: true }}
                defaultEdgeOptions={{ type: 'custom' }}
            >
                <ZoomAwareBackground />
            </ReactFlow>

            {/* Empty state: show when no nodes */}
            {nodes.length === 0 && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    aria-hidden
                >
                    <div className="flex flex-col items-center justify-center max-w-sm mx-4 text-center">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/90 shadow-lg shadow-black/5 dark:shadow-black/20 p-6 mb-5">
                            <Layers className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
                            Canvas is empty
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Drag components from the sidebar onto this canvas, or start from a template
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
                            <MousePointer2 className="w-3.5 h-3.5" />
                            Click and drag to pan · Scroll to zoom
                        </p>
                    </div>
                </div>
            )}

            {/* Multiplayer Cursor Overlay */}
            <CursorOverlay cursors={activeCursors} />

            {/* Context Menu */}
            {contextMenu && (() => {
                const node = nodes.find(n => n.id === contextMenu.nodeId);
                return (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        nodeLocked={node?.locked}
                        onClose={() => setContextMenu(null)}
                        onEdit={() => {
                            if (node) {
                                selectNode(node.id);
                                setActivePanelTab('General');
                            }
                        }}
                        onDuplicate={() => duplicateNode(contextMenu.nodeId)}
                        onLogs={() => {
                            if (node) onViewLogs?.(node.id);
                        }}
                        onExec={() => onNodeExec?.(contextMenu.nodeId)}
                        isRunning={runningNodeIds?.has(contextMenu.nodeId)}
                        onLock={() => toggleLockNode(contextMenu.nodeId)}
                        onDelete={() => removeNode(contextMenu.nodeId)}
                    />
                );
            })()}

            {/* File editor panel: slides up from bottom within canvas area */}
            <AnimatePresence>
                {fileEditorNode && onCloseFileEditor && (
                    <FileEditorPanel
                        key={fileEditorNode.id}
                        node={fileEditorNode}
                        onClose={onCloseFileEditor}
                    />
                )}
            </AnimatePresence>
        </div>
    );
});
