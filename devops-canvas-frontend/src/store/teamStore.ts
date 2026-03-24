import { create } from 'zustand';
import api from '../utils/api';

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'Owner' | 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Invited';
    lastActive?: string;
}

interface TeamState {
    members: TeamMember[];
    isLoading: boolean;
    error: string | null;

    fetchMembers: () => Promise<void>;
    inviteMember: (email: string, role: string) => Promise<string>;
    updateRole: (id: string, role: string) => Promise<void>;
    removeMember: (id: string) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set) => ({
    members: [],
    isLoading: false,
    error: null,

    fetchMembers: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get<TeamMember[]>('/team/members');
            set({ members: response.data, isLoading: false });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch team members', isLoading: false });
        }
    },

    inviteMember: async (email, role) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await api.post<{ message: string; invite_url: string }>('/team/invite', {
                email,
                role,
            });
            const response = await api.get<TeamMember[]>('/team/members');
            set({ members: response.data, isLoading: false });
            return data.invite_url;
        } catch (err: any) {
            set({ error: err.message || 'Failed to invite member', isLoading: false });
            throw err;
        }
    },

    updateRole: async (id, role) => {
        set({ isLoading: true, error: null });
        try {
            await api.put(`/team/members/${id}/role`, { role });
            set((state) => ({
                members: state.members.map((m) =>
                    m.id === id ? { ...m, role: role as any } : m
                ),
                isLoading: false,
            }));
        } catch (err: any) {
            set({ error: err.message || 'Failed to update role', isLoading: false });
            throw err;
        }
    },

    removeMember: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await api.delete(`/team/members/${id}`);
            set((state) => ({
                members: state.members.filter((m) => m.id !== id),
                isLoading: false,
            }));
        } catch (err: any) {
            set({ error: err.message || 'Failed to remove member', isLoading: false });
            throw err;
        }
    },
}));
