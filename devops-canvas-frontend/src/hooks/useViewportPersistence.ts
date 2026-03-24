import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { viewportsCloseEnough } from '../utils/viewport';

const VIEWPORT_SAVE_DEBOUNCE_MS = 1000;

/**
 * Persists pan/zoom via PATCH without marking the canvas as "unsaved" (nodes/connections unchanged).
 */
export function useViewportPersistence(workspaceId: string | undefined) {
    const canvasViewport = useCanvasStore((s) => s.canvasViewport);
    const isLoading = useCanvasStore((s) => s.isLoading);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!workspaceId || isLoading) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        const { persistedViewport } = useCanvasStore.getState();
        if (!canvasViewport || viewportsCloseEnough(canvasViewport, persistedViewport)) {
            return;
        }

        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void useCanvasStore.getState().persistViewportToServer(workspaceId);
        }, VIEWPORT_SAVE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [canvasViewport, workspaceId, isLoading]);
}
