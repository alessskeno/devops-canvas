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
    fetchUser: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    updateProfile: (data: any) => Promise<void>;
    changePassword: (data: any) => Promise<void>;
    toggleMFA: (enabled: boolean) => Promise<void>;
    updatePreferences: (prefs: Record<string, any>) => Promise<void>;
    acceptInvite: (token: string, name: string, password: string) => Promise<void>;
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
                // For MVP, always return true to skip forced admin setup check
                set({ isSystemConfigured: true });
                return true;
            },

            fetchUser: async () => {
                set({ isLoading: true });
                try {
                    const response = await api.get<User>('/auth/me');
                    set({ user: response.data, isAuthenticated: true, isLoading: false });
                } catch (err: any) {
                    // If 401, likely token expired or invalid
                    console.error('Fetch user error:', err);
                    set({ isLoading: false });
                }
            },

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<AuthResponse>('/auth/login', { email, password });
                    const { user, token } = response.data;

                    localStorage.setItem('auth_token', token);

                    set({ user, token, isAuthenticated: true, isLoading: false });
                } catch (err: any) {
                    console.error('Login error:', err);
                    set({ error: err.message || 'Login failed', isLoading: false });
                    throw err;
                }
            },

            adminSetup: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<AuthResponse>('/auth/register', {
                        email: data.email,
                        password: data.password,
                        name: `${data.firstName} ${data.lastName}`
                    });

                    const { user, token } = response.data;

                    localStorage.setItem('auth_token', token);
                    localStorage.setItem('system_configured', 'true');

                    set({ user, token, isAuthenticated: true, isLoading: false, isSystemConfigured: true });
                } catch (err: any) {
                    console.error('Register error:', err);
                    set({ error: err.message || 'Setup failed', isLoading: false });
                    throw err;
                }
            },

            register: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<AuthResponse>('/auth/register', {
                        email: data.email,
                        password: data.password,
                        name: `${data.firstName} ${data.lastName}`
                    });

                    const { user, token } = response.data;
                    localStorage.setItem('auth_token', token);
                    set({ user, token, isAuthenticated: true, isLoading: false });
                } catch (err: any) {
                    set({ error: err.message || 'Registration failed', isLoading: false });
                    throw err;
                }
            },

            updateProfile: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.put<User>('/auth/profile', data);
                    set((state) => ({
                        user: state.user ? { ...state.user, ...response.data } : response.data,
                        isLoading: false
                    }));
                } catch (err: any) {
                    set({ error: err.message || 'Profile update failed', isLoading: false });
                    throw err;
                }
            },

            changePassword: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    await api.put('/auth/password', data);
                    set({ isLoading: false });
                } catch (err: any) {
                    set({ error: err.message || 'Password update failed', isLoading: false });
                    throw err;
                }
            },

            toggleMFA: async (enabled) => {
                set({ isLoading: true, error: null });
                try {
                    await api.put('/auth/mfa', { enabled });
                    set((state) => ({
                        user: state.user ? { ...state.user, mfa_enabled: enabled } : null,
                        isLoading: false
                    }));
                } catch (err: any) {
                    set({ error: err.message || 'MFA update failed', isLoading: false });
                    throw err;
                }
            },

            updatePreferences: async (prefs) => {
                set({ isLoading: true, error: null });
                try {
                    await api.put('/auth/preferences', prefs);
                    set((state) => {
                        if (!state.user) return { isLoading: false };
                        return {
                            user: {
                                ...state.user,
                                preferences: { ...state.user.preferences, ...prefs }
                            },
                            isLoading: false
                        };
                    });
                } catch (err: any) {
                    set({ error: err.message || 'Preferences update failed', isLoading: false });
                    // Optionally rethrow if the UI needs to handle specific errors
                }
            },

            acceptInvite: async (token, name, password) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<AuthResponse>('/team/accept-invite', {
                        token,
                        name,
                        password
                    });
                    const { user, token: authToken } = response.data;
                    localStorage.setItem('auth_token', authToken);
                    set({ user, token: authToken, isAuthenticated: true, isLoading: false });
                } catch (err: any) {
                    set({ error: err.message || 'Invitation acceptance failed', isLoading: false });
                    throw err;
                }
            },

            logout: () => {
                localStorage.removeItem('auth_token');
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
