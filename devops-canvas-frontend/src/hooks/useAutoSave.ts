import { useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCanvasStore } from '../store/canvasStore';

interface UseAutoSaveProps {
    workspaceId: string | undefined;
    saveCanvas: (id: string) => Promise<void>;
    dispatch: React.Dispatch<any>;
    state: {
        hasUnsavedChanges: boolean;
        autoSaveEnabled: boolean;
    };
    savedStateRef: React.MutableRefObject<string | null>;
}

export function useAutoSave({
    workspaceId,
    saveCanvas,
    dispatch,
    state,
    savedStateRef
}: UseAutoSaveProps) {
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const { nodes, connections } = useCanvasStore();

    // Helper to serialize state
    const serializeState = (n: any[], c: any[]) => {
        const cleanNodes = n.map(node => {
            const { selected, ...rest } = node;
            return rest;
        });
        return JSON.stringify({ n: cleanNodes, c });
    };

    const saveWorkspace = async () => {
        if (!workspaceId) return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        dispatch({ type: 'SET_IS_AUTO_SAVING', payload: true });

        try {
            await saveCanvas(workspaceId);
            const now = new Date();
            dispatch({ type: 'SET_LAST_SAVED', payload: now });

            // Update snapshot
            savedStateRef.current = serializeState(nodes, connections);
            dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });

            dispatch({ type: 'SET_IS_AUTO_SAVING', payload: false });
            toast.success('Workspace saved');
        } catch (error: any) {
            console.error(error);
            dispatch({ type: 'SET_IS_AUTO_SAVING', payload: false });
            const msg = error.response?.data?.error || error.message || 'Failed to save workspace';
            toast.error(msg);
        }
    };

    // Auto-Save Scheduler
    useEffect(() => {
        if (!state.hasUnsavedChanges) return;

        if (state.autoSaveEnabled) {
            dispatch({ type: 'SET_IS_AUTO_SAVING', payload: true }); // Indicate pending save

            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            autoSaveTimerRef.current = setTimeout(() => {
                saveWorkspace();
            }, 5000);
        } else {
            dispatch({ type: 'SET_IS_AUTO_SAVING', payload: false });
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [nodes, connections, state.autoSaveEnabled, state.hasUnsavedChanges]);

    return { saveWorkspace, serializeState, autoSaveTimerRef };
}
