import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/ws';

// Basic Container Stats from Docker
export interface ContainerStat {
    Name: string;
    CPUPerc: string;
    MemUsage: string;
    MemPerc: string;
    NetIO: string;
    BlockIO: string;
    PIDs: string;
}

export interface WorkspaceStats {
    type: 'workspace_stats';
    workspace_id: string;
    containers: ContainerStat[];
    total_cpu?: number;
    total_memory?: number;
}

export interface SystemStats {
    type: 'system_stats';
    cpu: number;
    memory: number;
    total_memory: number;
}

export const useRealtime = (workspaceId?: string) => {
    const { user } = useAuthStore();
    const ws = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [canvasUpdate, setCanvasUpdate] = useState<any>(null);
    const [activeCursors, setActiveCursors] = useState<{ [key: string]: { x: number, y: number, name: string, lastActive: number } }>({});

    useEffect(() => {
        if (!user || !workspaceId) return;

        const connect = () => {
            // Append workspace ID or token if needed for auth in future
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                setIsConnected(true);
                console.log('WS Connected');
            };

            ws.current.onclose = (e) => {
                if (ws.current) {
                    setIsConnected(false);
                    console.log('WS Disconnected');
                    setTimeout(connect, 3000);
                }
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data); // Expose raw message

                    if (data.type === 'system_stats') {
                        setSystemStats(data);
                    } else if (data.type === 'workspace_stats') {
                        if (data.workspace_id === workspaceId) {
                            setWorkspaceStats(data);
                        }
                    } else if (data.type === 'canvas_update') {
                        // Only update if it's for this workspace and NOT from us
                        if (data.workspace_id === workspaceId) {
                            setCanvasUpdate(data);
                        }
                    } else if (data.type === 'cursor_move') {
                        // Handle peer cursor moves
                        if (data.workspace_id === workspaceId && data.sender_id !== user.id) {
                            setActiveCursors(prev => ({
                                ...prev,
                                [data.sender_id]: {
                                    x: data.x,
                                    y: data.y,
                                    name: data.sender_name || 'Anonymous', // Assuming backend or sender provides this
                                    lastActive: Date.now()
                                }
                            }));
                        }
                    }

                } catch (err) {
                    console.error('Failed to parse WS message', err);
                }
            };
        };

        connect();

        // Cleanup inactive cursors every 1s
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            setActiveCursors(prev => {
                const next = { ...prev };
                let changed = false;
                Object.keys(next).forEach(key => {
                    if (now - next[key].lastActive > 5000) { // 5s timeout
                        delete next[key];
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 1000);

        return () => {
            clearInterval(cleanupInterval);
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close();
                ws.current = null;
            }
        };
    }, [user, workspaceId]);

    const sendMessage = (msg: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(msg));
        }
    };

    const sendCanvasUpdate = (type: string, payload: any) => {
        sendMessage({
            type: 'canvas_update',
            workspace_id: workspaceId,
            action: type,
            payload: payload,
            sender_id: user?.id, // Helps filtering echo
            timestamp: Date.now()
        });
    };

    const sendCursorMove = (x: number, y: number) => {
        sendMessage({
            type: 'cursor_move',
            workspace_id: workspaceId,
            sender_id: user?.id,
            sender_name: user?.email.split('@')[0], // Simple name extraction
            x,
            y,
            timestamp: Date.now()
        });
    };

    return { isConnected, systemStats, workspaceStats, sendMessage, lastMessage, canvasUpdate, sendCanvasUpdate, activeCursors, sendCursorMove };
};
