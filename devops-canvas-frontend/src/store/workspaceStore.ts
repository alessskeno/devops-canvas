import { create } from 'zustand';
import { Workspace } from '../types';
import api from '../utils/api';

interface WorkspaceState {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    isLoading: boolean;
    error: string | null;

    fetchWorkspaces: () => Promise<void>;
    fetchWorkspace: (id: string) => Promise<void>;
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
            const mappedWorkspaces = response.data.map((w: any) => ({
                id: w.id,
                name: w.name,
                description: w.description,
                environment: w.environment || 'development',
                visibility: w.visibility || 'private',
                version: w.version || 'v1.0.0',
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

    fetchWorkspace: async (id: string) => {
        set({ isLoading: true });
        try {
            // We need an endpoint for single workspace. Repository has GetWorkspace but handler needs to expose it?
            // Handler has GetCanvas but does it have GetWorkspace metadata?
            // Handler RegisterRoutes:
            // r.Get("/", h.ListWorkspaces)
            // r.Post("/", h.CreateWorkspace)
            // r.Put("/{id}", h.UpdateWorkspace) // Only updates
            // No Get("/{id}") for metadata! 
            // Wait, GetCanvas is at /{id}/canvas.
            // I need to add GetWorkspace metadata endpoint or re-use ListWorkspaces filtering?
            // Ideally backend should have r.Get("/{id}", h.GetWorkspace).
            // Since I am updating backend too, I should add that route.

            // Assuming I will add the route:
            const response = await api.get<Workspace>(`/workspaces/${id}`);
            const w: any = response.data;
            const ws: Workspace = {
                id: w.id,
                name: w.name,
                description: w.description,
                environment: w.environment || 'development',
                visibility: w.visibility || 'private',
                version: w.version || 'v1.0.0',
                componentCount: w.componentCount || 0,
                componentTypes: w.componentTypes || [],
                lastModified: w.updated_at,
                last_updated_by: w.last_updated_by,
                last_updated_by_name: w.last_updated_by_name
            };
            set({ currentWorkspace: ws, isLoading: false });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch workspace', isLoading: false });
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
            throw err;
        }
    },

    selectWorkspace: (id) => {
        const ws = get().workspaces.find(w => w.id === id) || null;
        set({ currentWorkspace: ws });
    }
}));
