import { useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useCanvasStore } from '../store/canvasStore';

/** Wait after last edit before persisting. Short enough to feel snappy; batches drags/typing bursts. */
const AUTO_SAVE_DEBOUNCE_MS = 900;

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

export type SaveWorkspaceOptions = {
    /** If true (auto-save), no success toast and quieter UX */
    silent?: boolean;
};

export function useAutoSave({
    workspaceId,
    saveCanvas,
    dispatch,
    state,
    savedStateRef
}: UseAutoSaveProps) {
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const { nodes, connections } = useCanvasStore();

    const serializeState = useCallback((n: any[], c: any[]) => {
        const cleanNodes = n.map(({ selected, measured, dragging, position_x, position_y, ...rest }: any) => rest);
        // Viewport is persisted separately (debounced PATCH) so pan/zoom does not mark unsaved changes.
        return JSON.stringify({ n: cleanNodes, c });
    }, []);

    const saveWorkspace = useCallback(
        async (options?: SaveWorkspaceOptions) => {
            const silent = options?.silent ?? false;
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

                const { nodes: n, connections: c } = useCanvasStore.getState();
                savedStateRef.current = serializeState(n, c);
                dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });

                dispatch({ type: 'SET_IS_AUTO_SAVING', payload: false });
                if (!silent) {
                    toast.success('Workspace saved');
                }
            } catch (error: any) {
                console.error(error);
                dispatch({ type: 'SET_IS_AUTO_SAVING', payload: false });
                const msg = error.response?.data?.error || error.message || 'Failed to save workspace';
                toast.error(msg);
            }
        },
        [workspaceId, saveCanvas, dispatch, savedStateRef, serializeState]
    );

    // Auto-Save Scheduler
    useEffect(() => {
        if (!state.hasUnsavedChanges) return;

        if (state.autoSaveEnabled) {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            autoSaveTimerRef.current = setTimeout(() => {
                autoSaveTimerRef.current = null;
                void saveWorkspace({ silent: true });
            }, AUTO_SAVE_DEBOUNCE_MS);
        } else {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [nodes, connections, state.autoSaveEnabled, state.hasUnsavedChanges, saveWorkspace]);

    return { saveWorkspace, serializeState, autoSaveTimerRef };
}
