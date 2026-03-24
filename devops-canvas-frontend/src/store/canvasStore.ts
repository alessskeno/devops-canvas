import { create } from 'zustand';
import { CanvasNode, Connection, ComponentConfig, CanvasViewport } from '../types';
import { COMPONENT_CONFIG_SCHEMAS } from '../utils/componentConfigSchemas';
import type { NodeChange } from '@xyflow/react';
import api from '../utils/api';
import { viewportsCloseEnough } from '../utils/viewport';

const cleanupNodeConnection = (node: CanvasNode, detachedNodeId: string): CanvasNode => {
    const schema = COMPONENT_CONFIG_SCHEMAS[node.type];
    if (!schema) return node;

    const data = JSON.parse(JSON.stringify(node.data));
    let changed = false;

    schema.forEach(field => {
        if (field.type === 'node-select') {
            const keys = field.key.split('.');
            let current: any = data;
            let validPath = true;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    validPath = false;
                    break;
                }
                current = current[keys[i]];
            }

            if (validPath) {
                const lastKey = keys[keys.length - 1];
                if (current[lastKey] === detachedNodeId) {
                    current[lastKey] = undefined;
                    changed = true;
                }
            }
        }
    });

    return changed ? { ...node, data } : node;
};

interface CanvasHistoryState {
    nodes: CanvasNode[];
    connections: Connection[];
}

interface CanvasState {
    nodes: CanvasNode[];
    connections: Connection[];
    selectedNodeIds: string[];

    // UI State
    contextMenu: { nodeId: string; x: number; y: number } | null;
    activePanelTab: string;

    past: CanvasHistoryState[];
    future: CanvasHistoryState[];

    // React Flow change handler
    handleNodeChanges: (changes: NodeChange[]) => void;

    // Actions
    addNode: (node: CanvasNode) => void;
    removeNode: (id: string) => void;
    removeNodes: (ids: string[]) => void;
    duplicateNode: (id?: string) => void;
    toggleLockNode: (id: string) => void;
    updateNodePosition: (id: string, position: { x: number; y: number }, saveToHistory?: boolean) => void;
    updateNodeData: (id: string, data: Partial<ComponentConfig>) => void;
    selectNode: (id: string | null) => void;
    selectNodes: (ids: string[]) => void;
    toggleNodeSelection: (id: string) => void;
    clearSelection: () => void;
    setActivePanelTab: (tab: string) => void;

    addConnection: (connection: Connection) => void;
    removeConnection: (id: string) => void;

    setContextMenu: (menu: { nodeId: string; x: number; y: number } | null) => void;
    loadCanvas: (nodes: CanvasNode[], connections: Connection[]) => void;
    applyRemoteUpdate: (remoteNodes: CanvasNode[], remoteConnections: Connection[]) => void;

    undo: () => void;
    redo: () => void;

    // Persistence
    isLoading: boolean;
    isSaving: boolean;
    /** Last known pan/zoom; restored after load and updated on pan/zoom */
    canvasViewport: CanvasViewport | null;
    /** Last viewport known to match the server (PATCH or full save); avoids redundant viewport writes */
    persistedViewport: CanvasViewport | null;
    /** Incremented when canvas is loaded from API or replaced (import); triggers viewport restore */
    canvasHydrationId: number;
    setCanvasViewport: (viewport: CanvasViewport | null) => void;
    /** Debounced caller: PATCH viewport only; does not affect unsaved/dirty state */
    persistViewportToServer: (workspaceId: string) => Promise<void>;
    fetchCanvas: (workspaceId: string) => Promise<void>;
    saveCanvas: (workspaceId: string) => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
    nodes: [],
    connections: [],
    selectedNodeIds: [],
    contextMenu: null,
    activePanelTab: 'General',
    past: [],
    future: [],

    handleNodeChanges: (changes) => set((state) => {
        let newNodes = [...state.nodes];
        let saveHistory = false;
        let hasSelectChanges = false;

        for (const change of changes) {
            if (change.type === 'position') {
                if (change.position) {
                    const idx = newNodes.findIndex(n => n.id === change.id);
                    if (idx !== -1) {
                        newNodes[idx] = { ...newNodes[idx], position: change.position };
                    }
                }
                if (change.dragging === false) {
                    saveHistory = true;
                }
            } else if (change.type === 'select') {
                const idx = newNodes.findIndex(n => n.id === change.id);
                if (idx !== -1) {
                    newNodes[idx] = { ...newNodes[idx], selected: change.selected };
                }
                hasSelectChanges = true;
            } else if (change.type === 'dimensions' && (change as any).dimensions) {
                const idx = newNodes.findIndex(n => n.id === change.id);
                if (idx !== -1) {
                    newNodes[idx] = { ...newNodes[idx], measured: (change as any).dimensions };
                }
            }
        }

        const newSelectedIds = newNodes.filter(n => n.selected).map(n => n.id);

        const result: Partial<CanvasState> & Record<string, any> = {
            nodes: newNodes,
            selectedNodeIds: newSelectedIds,
        };

        if (hasSelectChanges) {
            result.activePanelTab = 'General';
        }

        if (saveHistory) {
            result.past = [...state.past, { nodes: state.nodes, connections: state.connections }];
            result.future = [];
        }

        return result;
    }),

    addNode: (node) => set((state) => ({
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: [],
        nodes: [...state.nodes, node]
    })),

    removeNode: (id) => set((state) => {
        const relatedConnections = state.connections.filter(c => c.source === id || c.target === id);
        let newNodes = state.nodes;

        relatedConnections.forEach(conn => {
            const otherNodeId = conn.source === id ? conn.target : conn.source;
            const otherNode = newNodes.find(n => n.id === otherNodeId);
            if (otherNode) {
                const cleanNode = cleanupNodeConnection(otherNode, id);
                if (cleanNode !== otherNode) {
                    newNodes = newNodes.map(n => n.id === otherNodeId ? cleanNode : n);
                }
            }
        });

        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: [],
            nodes: newNodes.filter((n) => n.id !== id),
            connections: state.connections.filter((c) => c.source !== id && c.target !== id),
            selectedNodeIds: state.selectedNodeIds.filter((sid) => sid !== id),
        };
    }),

    removeNodes: (ids) => set((state) => {
        if (ids.length === 0) return state;
        const idSet = new Set(ids);
        let newNodes = state.nodes.filter((n) => !idSet.has(n.id));
        const newConnections = state.connections.filter(
            (c) => !idSet.has(c.source) && !idSet.has(c.target)
        );
        ids.forEach((id) => {
            newNodes = newNodes.map((n) => cleanupNodeConnection(n, id));
        });
        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: [],
            nodes: newNodes,
            connections: newConnections,
            selectedNodeIds: state.selectedNodeIds.filter((sid) => !idSet.has(sid)),
        };
    }),

    duplicateNode: (id) => set((state) => {
        const idsToDup = id != null ? [id] : state.selectedNodeIds;
        if (idsToDup.length === 0) return state;

        const newNodes: CanvasNode[] = [];
        idsToDup.forEach((nodeId) => {
            const nodeToDuplicate = state.nodes.find((n) => n.id === nodeId);
            if (!nodeToDuplicate || nodeToDuplicate.locked) return;
            newNodes.push({
                ...nodeToDuplicate,
                id: crypto.randomUUID(),
                position: {
                    x: nodeToDuplicate.position.x + 50,
                    y: nodeToDuplicate.position.y + 50
                },
                selected: false,
                data: { ...nodeToDuplicate.data, label: `${nodeToDuplicate.data.label} (Copy)` }
            });
        });
        if (newNodes.length === 0) return state;

        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: [],
            nodes: [...state.nodes, ...newNodes]
        };
    }),

    toggleLockNode: (id) => set((state) => ({
        nodes: state.nodes.map(n => n.id === id ? { ...n, locked: !n.locked } : n)
    })),

    setActivePanelTab: (tab) => set({ activePanelTab: tab }),

    setContextMenu: (menu) => set({ contextMenu: menu }),

    updateNodePosition: (id, position, saveToHistory = false) => set((state) => {
        const newState = {
            nodes: state.nodes.map((n) => n.id === id ? { ...n, position } : n)
        };
        if (saveToHistory) {
            return {
                past: [...state.past, { nodes: state.nodes, connections: state.connections }],
                future: [],
                ...newState
            };
        }
        return newState;
    }),

    updateNodeData: (id, data) => set((state) => ({
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: [],
        nodes: state.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
    })),

    selectNode: (id) => set((state) => ({
        selectedNodeIds: id != null ? [id] : [],
        activePanelTab: 'General',
        nodes: state.nodes.map(n => ({ ...n, selected: n.id === id }))
    })),

    selectNodes: (ids) => set((state) => {
        const idSet = new Set(ids);
        return {
            selectedNodeIds: ids,
            activePanelTab: 'General',
            nodes: state.nodes.map(n => ({ ...n, selected: idSet.has(n.id) }))
        };
    }),

    toggleNodeSelection: (id) => set((state) => {
        const isSelected = state.selectedNodeIds.includes(id);
        const newSelectedIds = isSelected
            ? state.selectedNodeIds.filter(sid => sid !== id)
            : [...state.selectedNodeIds, id];
        const idSet = new Set(newSelectedIds);
        return {
            selectedNodeIds: newSelectedIds,
            activePanelTab: 'General',
            nodes: state.nodes.map(n => ({ ...n, selected: idSet.has(n.id) }))
        };
    }),

    clearSelection: () => set((state) => ({
        selectedNodeIds: [],
        nodes: state.nodes.map(n => n.selected ? { ...n, selected: false } : n)
    })),

    addConnection: (connection) => set((state) => {
        if (connection.source === connection.target) return state;

        const exists = state.connections.find(
            c => c.source === connection.source && c.target === connection.target
        );
        if (exists) return state;

        const reverseExists = state.connections.find(
            c => c.source === connection.target && c.target === connection.source
        );
        if (reverseExists) return state;

        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: [],
            connections: [...state.connections, connection]
        };
    }),

    removeConnection: (id) => set((state) => {
        const connection = state.connections.find(c => c.id === id);
        if (!connection) return state;

        const sourceNode = state.nodes.find(n => n.id === connection.source);
        const targetNode = state.nodes.find(n => n.id === connection.target);

        let newNodes = state.nodes;

        if (sourceNode && targetNode) {
            const cleanSource = cleanupNodeConnection(sourceNode, targetNode.id);
            const cleanTarget = cleanupNodeConnection(targetNode, sourceNode.id);

            if (cleanSource !== sourceNode || cleanTarget !== targetNode) {
                newNodes = state.nodes.map(n => {
                    if (n.id === sourceNode.id) return cleanSource;
                    if (n.id === targetNode.id) return cleanTarget;
                    return n;
                });
            }
        }

        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: [],
            nodes: newNodes,
            connections: state.connections.filter((c) => c.id !== id)
        };
    }),

    loadCanvas: (nodes, connections) =>
        set((state) => ({
            nodes,
            connections,
            past: [],
            future: [],
            selectedNodeIds: [],
            canvasViewport: null,
            persistedViewport: null,
            canvasHydrationId: state.canvasHydrationId + 1,
        })),

    applyRemoteUpdate: (remoteNodes, remoteConnections) => set((state) => {
        const remoteNodeMap = new Map(remoteNodes.map(n => [n.id, n]));

        const updatedNodes: CanvasNode[] = remoteNodes.map(remoteNode => {
            const localNode = state.nodes.find(n => n.id === remoteNode.id);
            if (localNode) {
                return {
                    ...remoteNode,
                    selected: localNode.selected,
                    measured: localNode.measured,
                };
            }
            return remoteNode;
        });

        const newSelectedIds = state.selectedNodeIds.filter(id => remoteNodeMap.has(id));

        return {
            nodes: updatedNodes,
            connections: remoteConnections,
            selectedNodeIds: newSelectedIds,
        };
    }),

    undo: () => set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        return {
            past: newPast,
            future: [{ nodes: state.nodes, connections: state.connections }, ...state.future],
            nodes: previous.nodes,
            connections: previous.connections
        };
    }),

    redo: () => set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: newFuture,
            nodes: next.nodes,
            connections: next.connections
        };
    }),

    isLoading: false,
    isSaving: false,
    canvasViewport: null,
    persistedViewport: null,
    canvasHydrationId: 0,

    setCanvasViewport: (viewport) => set({ canvasViewport: viewport }),

    persistViewportToServer: async (workspaceId: string) => {
        const { canvasViewport, persistedViewport } = get();
        if (!canvasViewport || viewportsCloseEnough(canvasViewport, persistedViewport)) {
            return;
        }
        try {
            await api.patch(`/workspaces/${workspaceId}/canvas/viewport`, canvasViewport);
            set({ persistedViewport: { ...canvasViewport } });
        } catch (e) {
            console.error('Failed to persist canvas viewport:', e);
        }
    },

    fetchCanvas: async (workspaceId: string) => {
        set({ isLoading: true });
        try {
            const response = await api.get(`/workspaces/${workspaceId}/canvas`);

            const { nodes, connections, viewport: rawVp } = response.data;

            const mappedNodes = (nodes || []).map((n: any) => ({
                ...n,
                position: {
                    x: n.position_x !== undefined ? n.position_x : (n.position?.x || 0),
                    y: n.position_y !== undefined ? n.position_y : (n.position?.y || 0)
                }
            }));

            let viewport: CanvasViewport | null = null;
            if (
                rawVp &&
                typeof rawVp.x === 'number' &&
                typeof rawVp.y === 'number' &&
                typeof rawVp.zoom === 'number'
            ) {
                viewport = { x: rawVp.x, y: rawVp.y, zoom: rawVp.zoom };
            }

            set((state) => ({
                nodes: mappedNodes,
                connections: connections || [],
                past: [],
                future: [],
                selectedNodeIds: [],
                canvasViewport: viewport,
                persistedViewport: viewport,
                canvasHydrationId: state.canvasHydrationId + 1,
                isLoading: false,
            }));
        } catch (error) {
            console.error('Failed to fetch canvas:', error);
            set({ isLoading: false });
        }
    },

    saveCanvas: async (workspaceId: string) => {
        set({ isSaving: true });
        try {
            const { nodes, connections } = get();

            const payloadNodes = nodes.map(n => {
                const { measured, selected, ...rest } = n as any;
                return {
                    ...rest,
                    position_x: n.position.x,
                    position_y: n.position.y
                };
            });

            const { canvasViewport } = get();
            await api.put(`/workspaces/${workspaceId}/canvas`, {
                nodes: payloadNodes,
                connections,
                ...(canvasViewport ? { viewport: canvasViewport } : {}),
            });
            const vp = get().canvasViewport;
            set({
                isSaving: false,
                persistedViewport: vp ? { ...vp } : null,
            });
        } catch (error) {
            console.error('Failed to save canvas:', error);
            set({ isSaving: false });
            throw error;
        }
    },
}));
