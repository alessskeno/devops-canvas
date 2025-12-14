/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // or 'media' or selector strategy
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#3B82F6',
                    hover: '#2563EB',
                    active: '#1D4ED8',
                },
                secondary: {
                    DEFAULT: '#8B5CF6',
                },
                success: {
                    DEFAULT: '#10B981',
                },
                warning: {
                    DEFAULT: '#F59E0B',
                },
                danger: {
                    DEFAULT: '#EF4444',
                },
                background: {
                    DEFAULT: '#F9FAFB',
                    dark: '#1F2937',
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    dark: '#374151',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 150ms ease-out',
                'slide-in': 'slideIn 200ms ease-out',
                'spin-slow': 'spin 3s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            }
        },
    },
    plugins: [],
}
