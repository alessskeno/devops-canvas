import { create } from 'zustand';
import { Workspace } from '../types';
import api from '../utils/api';

interface WorkspaceState {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    isLoading: boolean;
    error: string | null;

    fetchWorkspaces: () => Promise<void>;
    createWorkspace: (data: Omit<Workspace, 'id' | 'componentCount' | 'lastModified'>) => Promise<void>;
    updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>;
    duplicateWorkspace: (id: string) => Promise<void>;
    deleteWorkspace: (id: string) => Promise<void>;
    selectWorkspace: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    workspaces: [],
    currentWorkspace: null,
    isLoading: false,
    error: null,

    fetchWorkspaces: async () => {
        set({ isLoading: true });
        try {
            const response = await api.get<Workspace[]>('/workspaces');

            // Map backend "created_at" to "lastModified" if needed, 
            // but backend returns JSON keys snake_case usually unless struct tags say otherwise.
            // Our struct tags say "json:created_at", etc.
            // Frontend type expects camelCase where defined.
            // Let's ensure Mapping is correct if keys differ.
            // Backend Model: ID, Name, Description, OwnerID, LastUpdatedBy, LastUpdatedByName, CreatedAt, UpdatedAt
            // Frontend Type: id, name, description, environment, visibility, componentCount, lastModified, last_updated_by...

            // We need to map the response to match Frontend Interface exactly
            // or update Frontend Interface to match Backend.
            // Let's generic map for now since we haven't strictly typed the API response differently
            const mappedWorkspaces = response.data.map((w: any) => ({
                id: w.id,
                name: w.name,
                description: w.description,
                environment: w.environment || 'development',
                visibility: w.visibility || 'private', // Backend provides 'visibility' string
                componentCount: w.componentCount || 0,
                componentTypes: w.componentTypes || [],
                lastModified: w.updated_at,
                last_updated_by: w.last_updated_by,
                last_updated_by_name: w.last_updated_by_name
            }));

            set({ workspaces: mappedWorkspaces, isLoading: false });
        } catch (err: any) {
            console.error(err);
            set({ error: err.message || 'Failed to fetch workspaces', isLoading: false });
        }
    },

    createWorkspace: async (data) => {
        set({ isLoading: true });
        try {
            const response = await api.post<Workspace>('/workspaces', data);
            const w: any = response.data;
            const newWs: Workspace = {
                id: w.id,
                name: w.name,
                description: w.description,
                environment: w.environment,
                visibility: w.visibility,
                componentCount: 0,
                lastModified: w.updated_at,
                last_updated_by: w.last_updated_by
            };

            set((state) => ({
                workspaces: [newWs, ...state.workspaces],
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
            throw err; // Re-throw to allow component to handle success/fail UI
        }
    },

    updateWorkspace: async (id, data) => {
        set({ isLoading: true });
        try {
            const response = await api.put<Workspace>(`/workspaces/${id}`, data);
            const w: any = response.data;
            // Update in local state
            set((state) => ({
                workspaces: state.workspaces.map(ws => ws.id === id ? {
                    ...ws,
                    name: w.name,
                    description: w.description,
                    environment: w.environment,
                    visibility: w.visibility,
                    lastModified: w.updated_at,
                    last_updated_by: w.last_updated_by
                } : ws),
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
            throw err;
        }
    },

    duplicateWorkspace: async (id) => {
        set({ isLoading: true });
        try {
            const response = await api.post<Workspace>(`/workspaces/${id}/duplicate`);
            const w: any = response.data;
            const newWs: Workspace = {
                id: w.id,
                name: w.name,
                description: w.description,
                environment: w.environment,
                visibility: w.visibility,
                componentCount: w.componentCount || 0,
                componentTypes: w.componentTypes || [],
                lastModified: w.updated_at,
                last_updated_by: w.last_updated_by
            };

            set((state) => ({
                workspaces: [newWs, ...state.workspaces],
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
            throw err;
        }
    },

    deleteWorkspace: async (id) => {
        set({ isLoading: true });
        try {
            await api.delete(`/workspaces/${id}`);
            set((state) => ({
                workspaces: state.workspaces.filter(w => w.id !== id),
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    selectWorkspace: (id) => {
        const ws = get().workspaces.find(w => w.id === id) || null;
        set({ currentWorkspace: ws });
    }
}));
