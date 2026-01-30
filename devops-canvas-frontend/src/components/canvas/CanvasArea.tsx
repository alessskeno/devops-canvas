import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvasNode } from './CanvasNode';
import { ConnectionLine } from './ConnectionLine';
import { useDrop } from '../../utils/dragDrop';
import { CanvasNode as NodeType } from '../../types';
import { ContextMenu } from './ContextMenu';
import { COMPONENT_CONFIG_SCHEMAS } from '../../utils/componentConfigSchemas';
import { CursorOverlay } from './CursorOverlay';

interface CanvasAreaProps {
    runningNodeIds?: Set<string>;
    onNodeExec?: (nodeId: string) => void;
    activeCursors: { [key: string]: { x: number, y: number, name: string } };
    sendCursorMove: (x: number, y: number) => void;
}

export function CanvasArea({ runningNodeIds, onNodeExec, activeCursors, sendCursorMove }: CanvasAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const lastCursorSend = useRef(0);

    const {
        nodes, connections, scale, pan,
        setTransform, addConnection, selectNode,
        draftConnection, setDraftConnection,
        removeConnection, addNode,
        contextMenu, setContextMenu,
        duplicateNode, toggleLockNode, removeNode,
        setActivePanelTab, selectedNodeId
    } = useCanvasStore();

    // Pan State
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Local temp mouse pos for draft line rendering (avoiding store thrashing for high freq updates)
    const [tempMousePos, setTempMousePos] = useState({ x: 0, y: 0 });

    // Sync tempMousePos when draft starts (fix for jumping line)
    useEffect(() => {
        if (draftConnection) {
            setTempMousePos(mouseRef.current);
        }
    }, [draftConnection]);

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const oldScale = scale;
        const newScale = Math.min(Math.max(scale - e.deltaY * zoomSensitivity, 0.1), 5);

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate world position under mouse
            const worldX = (mouseX - pan.x) / oldScale;
            const worldY = (mouseY - pan.y) / oldScale;

            // Calculate new pan to keep world position under mouse
            const newPanX = mouseX - worldX * newScale;
            const newPanY = mouseY - worldY * newScale;

            setTransform(newScale, { x: newPanX, y: newPanY });
        } else {
            setTransform(newScale, pan);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent panning/interaction if clicking on a node or interactive element
        const target = e.target as HTMLElement;
        if (target.closest('.canvas-node') || target.closest('.node-interactive')) {
            return;
        }

        // Pan with Left Click (hold) or Middle Click on background
        if (e.button === 0 || e.button === 1) {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });

            // Deselect callback (background click)
            if (e.button === 0) {
                selectNode(null);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Always track mouse position in canvas coordinates
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left - pan.x) / scale;
            const canvasY = (e.clientY - rect.top - pan.y) / scale;
            mouseRef.current = { x: canvasX, y: canvasY };

            if (draftConnection) {
                setTempMousePos({ x: canvasX, y: canvasY });
            }

            // Send Cursor Move (Throttled)
            const now = Date.now();
            if (now - lastCursorSend.current > 50) {
                sendCursorMove(canvasX, canvasY);
                lastCursorSend.current = now;
            }
        }

        if (isPanning) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setTransform(scale, { x: pan.x + dx, y: pan.y + dy });
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsPanning(false);
        if (draftConnection) {
            setTimeout(() => {
                setDraftConnection(null);
            }, 50);
        }
    };

    // Drag and Drop (Accept items from Sidebar)
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/react-dnd-component');
        const configStr = e.dataTransfer.getData('application/react-dnd-config');

        if (type && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left - pan.x) / scale;
            const y = (e.clientY - rect.top - pan.y) / scale;

            let initialData = configStr ? JSON.parse(configStr) : { label: 'New Component' };

            // Merge Schema Defaults
            const schema = COMPONENT_CONFIG_SCHEMAS[type];
            if (schema) {
                const defaults = schema.reduce((acc, field) => {
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
                position: { x, y },
                data: initialData
            };

            addNode(newNode);
        }
    };

    // Use useEffect for non-passive wheel listener
    useEffect(() => {
        const element = containerRef.current;
        if (element) {
            element.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (element) {
                element.removeEventListener('wheel', handleWheel);
            }
        };
    }, [handleWheel]);

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-slate-950 grid-bg cursor-default selection:bg-transparent"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Cursor Overlay */}
            <CursorOverlay cursors={activeCursors} scale={scale} pan={pan} />

            {/* Transform Container - everything inside here scales/pans */}
            <div
                className="absolute origin-top-left transition-transform duration-75 ease-out"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
                <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
                    {/* Render Existing Connections */}
                    {connections.map(activeConn => {
                        const fromNode = nodes.find(n => n.id === activeConn.source);
                        const toNode = nodes.find(n => n.id === activeConn.target);
                        if (!fromNode || !toNode) return null;

                        const x1 = fromNode.position.x + 256;
                        const y1 = fromNode.position.y + 53;
                        const x2 = toNode.position.x;
                        const y2 = toNode.position.y + 53;

                        const isRunning = runningNodeIds?.has(fromNode.id) && runningNodeIds?.has(toNode.id);
                        const isAnimated = activeConn.animated || isRunning;

                        return (
                            <ConnectionLine
                                key={activeConn.id}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                animated={isAnimated}
                                status={isRunning ? 'running' : 'default'}
                                onRemove={() => removeConnection(activeConn.id)}
                            />
                        );
                    })}

                    {/* Render Draft Connection */}
                    {draftConnection && (
                        <ConnectionLine
                            x1={draftConnection.sourcePos.x}
                            y1={draftConnection.sourcePos.y}
                            x2={tempMousePos.x}
                            y2={tempMousePos.y}
                            animated={true}
                            isDraft={true}
                        />
                    )}
                </svg>

                {/* Render Nodes */}
                {nodes.map(node => (
                    <CanvasNode
                        key={node.id}
                        node={node}
                        scale={scale}
                        isSelected={selectedNodeId === node.id}
                    />
                ))}
            </div>

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
                            if (node) {
                                selectNode(node.id);
                                setActivePanelTab('Logs');
                            }
                        }}
                        onExec={() => onNodeExec?.(contextMenu.nodeId)}
                        isRunning={runningNodeIds?.has(contextMenu.nodeId)}
                        onLock={() => toggleLockNode(contextMenu.nodeId)}
                        onDelete={() => removeNode(contextMenu.nodeId)}
                    />
                );
            })()}

            <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow text-xs text-gray-500 font-mono">
                Scale: {(scale * 100).toFixed(0)}% | Pan: {pan.x.toFixed(0)}, {pan.y.toFixed(0)}
            </div>
        </div>
    );
}
