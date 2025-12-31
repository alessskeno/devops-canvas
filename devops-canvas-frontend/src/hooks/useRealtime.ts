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
                    }

                } catch (err) {
                    console.error('Failed to parse WS message', err);
                }
            };
        };

        connect();

        return () => {
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

    return { isConnected, systemStats, workspaceStats, sendMessage, lastMessage };
};
