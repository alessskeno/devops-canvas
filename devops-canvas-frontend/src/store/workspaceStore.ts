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
            // Mock Data
            await new Promise(resolve => setTimeout(resolve, 500));
            const mockWorkspaces: Workspace[] = [
                {
                    id: 'ws-1',
                    name: 'E-commerce Backend',
                    description: 'Microservices setup for main store',
                    environment: 'development',
                    visibility: 'team',
                    componentCount: 6,
                    lastModified: new Date().toISOString()
                },
                {
                    id: 'ws-2',
                    name: 'Analytics Pipeline',
                    description: 'Data ingestion and processing',
                    environment: 'staging',
                    visibility: 'private',
                    componentCount: 4,
                    lastModified: new Date(Date.now() - 86400000).toISOString()
                }
            ];

            set({ workspaces: mockWorkspaces, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    createWorkspace: async (data) => {
        set({ isLoading: true });
        try {
            await new Promise(resolve => setTimeout(resolve, 600));
            const newWs: Workspace = {
                ...data,
                id: `ws-${Date.now()}`,
                componentCount: 0,
                lastModified: new Date().toISOString()
            };

            set((state) => ({
                workspaces: [newWs, ...state.workspaces],
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    deleteWorkspace: async (id) => {
        // Implementation
        set((state) => ({ workspaces: state.workspaces.filter(w => w.id !== id) }));
    },

    selectWorkspace: (id) => {
        const ws = get().workspaces.find(w => w.id === id) || null;
        set({ currentWorkspace: ws });
    }
}));
