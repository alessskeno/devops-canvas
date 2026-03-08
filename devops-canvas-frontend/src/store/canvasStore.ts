import { create } from 'zustand';
import { CanvasNode, Connection, ComponentConfig } from '../types';
import { COMPONENT_CONFIG_SCHEMAS } from '../utils/componentConfigSchemas';

// Helper to remove connection references from node data
const cleanupNodeConnection = (node: CanvasNode, detachedNodeId: string): CanvasNode => {
    const schema = COMPONENT_CONFIG_SCHEMAS[node.type];
    if (!schema) return node;

    // Use JSON parse/stringify for deep clone to handle nested objects safely
    const data = JSON.parse(JSON.stringify(node.data));
    let changed = false;

    schema.forEach(field => {
        if (field.type === 'node-select') {
            const keys = field.key.split('.');
            let current: any = data;
            let validPath = true;

            // Navigate to the parent object
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
    scale: number;
    pan: { x: number; y: number };
    isDragging: boolean;
    draftConnection: { sourceId: string; sourcePos: { x: number; y: number } } | null;

    // UI State
    contextMenu: { nodeId: string; x: number; y: number } | null;
    activePanelTab: string;

    past: CanvasHistoryState[];
    future: CanvasHistoryState[];

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

    setTransform: (scale: number, pan: { x: number; y: number }) => void;
    // ... rest ...
    setDraftConnection: (draft: { sourceId: string; sourcePos: { x: number; y: number } } | null) => void;
    setContextMenu: (menu: { nodeId: string; x: number; y: number } | null) => void;
    resetView: () => void;
    loadCanvas: (nodes: CanvasNode[], connections: Connection[]) => void;

    undo: () => void;
    redo: () => void;

    // Persistence
    isLoading: boolean;
    isSaving: boolean;
    fetchCanvas: (workspaceId: string) => Promise<void>;
    saveCanvas: (workspaceId: string) => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
    nodes: [],
    connections: [],
    selectedNodeIds: [],
    scale: 1,
    pan: { x: 0, y: 0 },
    isDragging: false,
    draftConnection: null,
    contextMenu: null,
    activePanelTab: 'General',
    past: [],
    future: [],

    addNode: (node) => set((state) => ({
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: [],
        nodes: [...state.nodes, node]
    })),

    removeNode: (id) => set((state) => {
        // Find all connections involving this node to clean up references in other nodes
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

    // Only save history if explicitly asked (e.g. on drag end), otherwise just update
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
        // Data updates might want history too, but maybe less critical for prototype? Let's add it.
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: [],
        nodes: state.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
    })),

    selectNode: (id) =>
        set({
            selectedNodeIds: id != null ? [id] : [],
            activePanelTab: 'General'
        }),
    selectNodes: (ids) => set({ selectedNodeIds: ids, activePanelTab: 'General' }),
    toggleNodeSelection: (id) =>
        set((state) => {
            const set = new Set(state.selectedNodeIds);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            return { selectedNodeIds: Array.from(set), activePanelTab: 'General' };
        }),
    clearSelection: () => set({ selectedNodeIds: [] }),

    addConnection: (connection) => set((state) => {
        // Prevent self-connections
        if (connection.source === connection.target) return state;

        // Check if connection already exists
        const exists = state.connections.find(
            c => c.source === connection.source && c.target === connection.target
        );
        if (exists) return state;

        // Prevent bidirectional connections (no A->B if B->A exists)
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

    setDraftConnection: (draft) => set({ draftConnection: draft }),
    setTransform: (scale, pan) => set({ scale, pan }),

    resetView: () => set({ scale: 1, pan: { x: 0, y: 0 } }),

    loadCanvas: (nodes, connections) => set({ nodes, connections, past: [], future: [], selectedNodeIds: [] }),

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

    fetchCanvas: async (workspaceId: string) => {
        set({ isLoading: true });
        try {
            const { default: api } = await import('../utils/api');
            const response = await api.get(`/workspaces/${workspaceId}/canvas`);

            const { nodes, connections } = response.data;

            // Transform backend flat structure (position_x, position_y) to frontend nested structure (position: {x, y})
            const mappedNodes = (nodes || []).map((n: any) => ({
                ...n,
                position: {
                    x: n.position_x !== undefined ? n.position_x : (n.position?.x || 0),
                    y: n.position_y !== undefined ? n.position_y : (n.position?.y || 0)
                }
            }));

            set({
                nodes: mappedNodes,
                connections: connections || [],
                past: [],
                future: [],
                selectedNodeIds: [],
                isLoading: false
            });
        } catch (error) {
            console.error('Failed to fetch canvas:', error);
            set({ isLoading: false });
        }
    },

    saveCanvas: async (workspaceId: string) => {
        set({ isSaving: true });
        try {
            const { nodes, connections } = get();
            const { default: api } = await import('../utils/api');

            // Transform frontend nested structure to backend flat structure
            const payloadNodes = nodes.map(n => ({
                ...n,
                position_x: n.position.x,
                position_y: n.position.y
            }));

            await api.put(`/workspaces/${workspaceId}/canvas`, {
                nodes: payloadNodes,
                connections
            });
            set({ isSaving: false });
        } catch (error) {
            console.error('Failed to save canvas:', error);
            set({ isSaving: false });
            throw error;
        }
    },
}));
