import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthResponse } from '../types';
import api from '../utils/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    isSystemConfigured: boolean;

    checkSystemStatus: () => Promise<boolean>;
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    adminSetup: (data: any) => Promise<void>;
    logout: () => void;
    setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            isSystemConfigured: false, // New state

            checkSystemStatus: async () => {
                // Mock API call to check if admin exists
                // In a real app, this would be: await api.get('/system/status');
                const isConfigured = localStorage.getItem('system_configured') === 'true';
                set({ isSystemConfigured: isConfigured });
                return isConfigured;
            },

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    // Mock login for demo if API not ready
                    await new Promise(resolve => setTimeout(resolve, 800));

                    // NOTE: Replace with actual API call:
                    // const response = await api.post<AuthResponse>('/auth/login', { email, password });
                    // const { user, token } = response.data;

                    // Mock response
                    const token = 'mock-jwt-token-' + Date.now();
                    const user: User = {
                        id: '1',
                        name: 'Jane Doe',
                        email,
                        role: email.includes('admin') ? 'admin' : 'user',
                        createdAt: new Date().toISOString()
                    };

                    set({ user, token, isAuthenticated: true, isLoading: false });
                } catch (err: any) {
                    set({ error: err.message || 'Login failed', isLoading: false });
                    throw err;
                }
            },

            adminSetup: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // const response = await api.post<AuthResponse>('/auth/admin-setup', data);

                    const token = 'admin-jwt-token';
                    const user: User = {
                        id: 'admin-1',
                        name: `${data.firstName} ${data.lastName}`,
                        email: data.email,
                        role: 'admin',
                        createdAt: new Date().toISOString()
                    };

                    localStorage.setItem('system_configured', 'true'); // Persist mock config
                    set({ user, token, isAuthenticated: true, isLoading: false, isSystemConfigured: true });
                } catch (err: any) {
                    set({ error: err.message || 'Setup failed', isLoading: false });
                    throw err;
                }
            },

            register: async (data) => {
                // Placeholder
            },

            logout: () => {
                set({ user: null, token: null, isAuthenticated: false });
            },

            setError: (error) => set({ error }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated, isSystemConfigured: state.isSystemConfigured }),
        }
    )
);
