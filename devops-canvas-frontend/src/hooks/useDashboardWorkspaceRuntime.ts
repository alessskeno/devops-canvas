import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getRealtimeWebSocketUrl } from '../utils/apiOrigin';

/**
 * Subscribes to realtime `workspace_stats` for all workspaces (Docker monitor broadcast).
 * Used on the dashboard to show Running vs Ready on each card.
 */
export function useDashboardWorkspaceRuntime(): Record<string, boolean> {
    const user = useAuthStore((s) => s.user);
    const [runningById, setRunningById] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!user) return;

        let ws: WebSocket | null = null;
        let stopped = false;

        const connect = () => {
            if (stopped) return;
            ws = new WebSocket(getRealtimeWebSocketUrl());

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== 'workspace_stats' || typeof data.workspace_id !== 'string') {
                        return;
                    }
                    const running = Array.isArray(data.containers) && data.containers.length > 0;
                    setRunningById((prev) => {
                        if (prev[data.workspace_id] === running) return prev;
                        return { ...prev, [data.workspace_id]: running };
                    });
                } catch {
                    /* ignore malformed */
                }
            };

            ws.onclose = () => {
                if (!stopped) {
                    setTimeout(connect, 3000);
                }
            };
        };

        connect();

        return () => {
            stopped = true;
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [user]);

    return runningById;
}
