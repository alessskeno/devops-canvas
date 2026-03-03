export const config = {
    edition: import.meta.env.VITE_EDITION || 'oss', // 'oss' | 'saas'
    isSaaS: import.meta.env.VITE_EDITION === 'saas',
};
