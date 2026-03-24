/**
 * API base URL for HTTP (axios). Defaults to "/api" so the browser uses the same host
 * as the page (works behind Docker nginx, or http://<server-ip>:3000).
 * Override with VITE_API_URL for special setups (full URL, no trailing slash).
 */
export function getApiBase(): string {
    const v = import.meta.env.VITE_API_URL as string | undefined;
    if (v === undefined || v === '') {
        return '/api';
    }
    return v.replace(/\/$/, '');
}

/**
 * WebSocket URL for a path under the API (e.g. "/ws" -> "/api/ws" on the current host).
 */
export function getApiWebSocketUrl(apiPath: string): string {
    const rel = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const base = getApiBase();

    if (base.startsWith('http://') || base.startsWith('https://')) {
        const wsBase = base.replace(/^http/, 'ws');
        return `${wsBase}${rel}`;
    }

    const { protocol, host } = window.location;
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${host}${base}${rel}`;
}

/** Main app WebSocket (canvas, stats). Set VITE_WS_URL to override the full URL. */
export function getRealtimeWebSocketUrl(): string {
    const v = import.meta.env.VITE_WS_URL as string | undefined;
    if (v !== undefined && v !== '') {
        return v;
    }
    return getApiWebSocketUrl('/ws');
}
