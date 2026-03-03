import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';

interface UseCanvasSyncProps {
    workspaceId: string | undefined;
    fetchCanvas: (id: string) => Promise<void>;
    fetchWorkspace: (id: string) => Promise<void>;
    loadCanvas: (nodes: any[], connections: any[]) => void;
    canvasUpdate: any;
    sendCanvasUpdate: (type: string, payload: any) => void;
    user: any;
    dispatch: React.Dispatch<any>;
    savedStateRef: React.MutableRefObject<string | null>;
    serializeState: (n: any[], c: any[]) => string;
    nodes: any[];
    connections: any[];
}

export function useCanvasSync({
    workspaceId,
    fetchCanvas,
    fetchWorkspace,
    loadCanvas,
    canvasUpdate,
    sendCanvasUpdate,
    user,
    dispatch,
    savedStateRef,
    serializeState,
    nodes,
    connections
}: UseCanvasSyncProps) {
    const isRemoteUpdate = useRef(false);
    const sendUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

    // Load from Backend on Mount
    useEffect(() => {
        if (workspaceId) {
            fetchWorkspace(workspaceId);
            fetchCanvas(workspaceId).then(() => {
                setTimeout(() => {
                    const store = useCanvasStore.getState();
                    savedStateRef.current = serializeState(store.nodes, store.connections);
                    dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });
                }, 100);
            });
        }
    }, [workspaceId, fetchCanvas, fetchWorkspace]);

    // Receive Updates
    useEffect(() => {
        if (!canvasUpdate) return;
        if (user && canvasUpdate.sender_id === user.id) return;

        const { n, c } = canvasUpdate.payload;
        if (n && c) {
            isRemoteUpdate.current = true;
            loadCanvas(n, c);
            savedStateRef.current = JSON.stringify({ n, c });
            dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });
            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, 100);
        }
    }, [canvasUpdate, loadCanvas, user]);

    // Send Updates (Track Changes)
    useEffect(() => {
        if (savedStateRef.current === null) return;

        const currentSerialized = serializeState(nodes, connections);
        if (currentSerialized !== savedStateRef.current) {
            dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: true });

            if (!isRemoteUpdate.current) {
                if (sendUpdateTimeout.current) clearTimeout(sendUpdateTimeout.current);
                sendUpdateTimeout.current = setTimeout(() => {
                    const payload = {
                        n: nodes.map(({ selected, ...rest }: any) => rest),
                        c: connections
                    };
                    sendCanvasUpdate('sync', payload);
                }, 50);
            }
        } else {
            dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });
        }
    }, [nodes, connections, sendCanvasUpdate]);
}
