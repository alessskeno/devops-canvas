import { create } from 'zustand';
import { CanvasNode, Connection, ComponentConfig } from '../types';

interface CanvasHistoryState {
    nodes: CanvasNode[];
    connections: Connection[];
}

interface CanvasState {
    nodes: CanvasNode[];
    connections: Connection[];
    selectedNodeId: string | null;
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
    duplicateNode: (id: string) => void;
    toggleLockNode: (id: string) => void;
    updateNodePosition: (id: string, position: { x: number; y: number }, saveToHistory?: boolean) => void;
    updateNodeData: (id: string, data: Partial<ComponentConfig>) => void;
    selectNode: (id: string | null) => void;
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
}

export const useCanvasStore = create<CanvasState>((set) => ({
    nodes: [],
    connections: [],
    selectedNodeId: null,
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

    removeNode: (id) => set((state) => ({
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: [],
        nodes: state.nodes.filter((n) => n.id !== id),
        connections: state.connections.filter((c) => c.source !== id && c.target !== id),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

    duplicateNode: (id) => set((state) => {
        const nodeToDuplicate = state.nodes.find(n => n.id === id);
        if (!nodeToDuplicate) return state;

        const newNode: CanvasNode = {
            ...nodeToDuplicate,
            id: `node-${Date.now()}`,
            position: {
                x: nodeToDuplicate.position.x + 50,
                y: nodeToDuplicate.position.y + 50
            },
            selected: false,
            data: { ...nodeToDuplicate.data, label: `${nodeToDuplicate.data.label} (Copy)` }
        };

        return {
            past: [...state.past, { nodes: state.nodes, connections: state.connections }],
            future: [],
            nodes: [...state.nodes, newNode]
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

    selectNode: (id) => set({ selectedNodeId: id, activePanelTab: 'General' }),

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

    removeConnection: (id) => set((state) => ({
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: [],
        connections: state.connections.filter((c) => c.id !== id)
    })),

    setDraftConnection: (draft) => set({ draftConnection: draft }),
    setTransform: (scale, pan) => set({ scale, pan }),

    resetView: () => set({ scale: 1, pan: { x: 0, y: 0 } }),

    loadCanvas: (nodes, connections) => set({ nodes, connections, past: [], future: [] }),

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
}));
