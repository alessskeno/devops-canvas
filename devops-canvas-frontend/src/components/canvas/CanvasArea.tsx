import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvasNode } from './CanvasNode';
import { ConnectionLine } from './ConnectionLine';
import { useDrop } from '../../utils/dragDrop'; // Placeholder for hook
import { CanvasNode as NodeType } from '../../types';
import { ContextMenu } from './ContextMenu';

export function CanvasArea() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

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

    // Handle Pan and Zoom
    const handleDetachConnection = (connectionId: string, sourceId: string, sourcePos: { x: number, y: number }) => {
        removeConnection(connectionId);
        setDraftConnection({
            sourceId: sourceId,
            sourcePos
        });
    };

    const handleWheel = (e: React.WheelEvent) => {
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
            // Check if dropped on a valid target port
            // The target port should handle the mouseup event and creating the connection
            // checks. Here we just clear the draft if it wasn't handled.
            // We defer clearing slightly to allow the port's onMouseUp to fire first
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

            const newNode: NodeType = {
                id: `node-${Date.now()}`,
                type,
                position: { x, y },
                data: configStr ? JSON.parse(configStr) : { label: 'New Component' }
            };

            addNode(newNode);
        }
    };

    // Handle Connections Logic
    // This usually requires detecting if we are over a port. 
    // For simplicity, we'll assume clicks on ports initiate/end connections in the Node component
    // But actually the Node Ports are DOM elements. We can listen to clicks on them.
    // A robust implementation would use a specialized library or context. 
    // Here we'll just handle the visual temp line.

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-slate-950 grid-bg cursor-default selection:bg-transparent"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
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

                        // Calculate handle positions 
                        // Right handle for source (x + width, y + height/2)
                        // Left handle for target (x, y + height/2)
                        // Node width is w-64 (256px), header+body makes height variable but let's estimate or measure
                        // For now using fixed offsets based on typical node size. 
                        // Ideally we should use refs or measured handle positions.
                        // Assuming separator line is at ~50px height.
                        const x1 = fromNode.position.x + 256;
                        const y1 = fromNode.position.y + 53; // Approx separator height
                        const x2 = toNode.position.x;
                        const y2 = toNode.position.y + 53;

                        return (
                            <ConnectionLine
                                key={activeConn.id}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                animated={activeConn.animated}
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
                                setActivePanelTab('General'); // Explicitly switch to General
                            }
                        }}
                        onDuplicate={() => duplicateNode(contextMenu.nodeId)}
                        onLogs={() => {
                            if (node) {
                                selectNode(node.id);
                                setActivePanelTab('Logs');
                            }
                        }}
                        onLock={() => toggleLockNode(contextMenu.nodeId)}
                        onDelete={() => removeNode(contextMenu.nodeId)}
                    />
                );
            })()}

            {/* Controls / Info overlay could go here */}
            <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow text-xs text-gray-500 font-mono">
                Scale: {(scale * 100).toFixed(0)}% | Pan: {pan.x.toFixed(0)}, {pan.y.toFixed(0)}
            </div>
        </div>
    );
}
