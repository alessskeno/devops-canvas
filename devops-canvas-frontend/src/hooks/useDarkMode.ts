import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export const useDarkMode = () => {
    const { user, updatePreferences, isAuthenticated } = useAuthStore();

    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Sync from User Preferences (Backend) to Local State
    useEffect(() => {
        if (isAuthenticated && user?.preferences?.theme) {
            const backendThemeIsDark = user.preferences.theme === 'dark';
            if (backendThemeIsDark !== isDark) {
                setIsDark(backendThemeIsDark);
            }
        }
    }, [user?.preferences?.theme, isAuthenticated]);

    // Apply theme to DOM and LocalStorage
    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggle = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);

        // Sync to Backend if authenticated
        if (isAuthenticated) {
            updatePreferences({ theme: newTheme ? 'dark' : 'light' });
        }
    };

    return { isDark, toggle };
};
