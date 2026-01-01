/// <reference types="vite/client" />
import axios from 'axios';
import { ApiError } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 300000,
});

// Request interceptor for Auth Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Standardize error format
        const customError: ApiError = {
            message: error.response?.data?.message || error.message || 'An unexpected error occurred',
            code: error.response?.data?.code || String(error.response?.status),
            details: error.response?.data?.details,
        };

        // Handle 401 Unauthorized
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            // Only redirect if not already on public auth pages
            if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/admin-setup')) {
                window.location.href = '/login';
            }
        }

        return Promise.reject(customError);
    }
);

export default api;
