import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../../store/canvasStore';

/**
 * After canvas data loads (or import), applies saved pan/zoom or fitView so nodes are visible.
 * Must render under ReactFlowProvider.
 */
export function ViewportController() {
    const { id: workspaceId } = useParams<{ id: string }>();
    const { setViewport, fitView, getViewport } = useReactFlow();
    const isLoading = useCanvasStore((s) => s.isLoading);
    const canvasHydrationId = useCanvasStore((s) => s.canvasHydrationId);
    const nodes = useCanvasStore((s) => s.nodes);

    const lastHydration = useRef(-1);
    const pendingFitForEmpty = useRef(false);

    useEffect(() => {
        if (!workspaceId || isLoading) return;
        if (canvasHydrationId === lastHydration.current) return;
        lastHydration.current = canvasHydrationId;

        pendingFitForEmpty.current = false;
        requestAnimationFrame(() => {
            const { canvasViewport, nodes: n } = useCanvasStore.getState();
            if (n.length === 0) {
                pendingFitForEmpty.current = true;
                return;
            }
            if (canvasViewport) {
                setViewport(canvasViewport, { duration: 0 });
            } else {
                fitView({ padding: 0.2, duration: 0 });
            }
            requestAnimationFrame(() => {
                useCanvasStore.getState().setCanvasViewport(getViewport());
            });
        });
    }, [workspaceId, isLoading, canvasHydrationId, setViewport, fitView, getViewport]);

    useEffect(() => {
        if (!workspaceId || isLoading || nodes.length === 0) return;
        if (!pendingFitForEmpty.current) return;
        pendingFitForEmpty.current = false;
        requestAnimationFrame(() => {
            const { canvasViewport } = useCanvasStore.getState();
            if (canvasViewport) {
                setViewport(canvasViewport, { duration: 0 });
            } else {
                fitView({ padding: 0.2, duration: 0 });
            }
            requestAnimationFrame(() => {
                useCanvasStore.getState().setCanvasViewport(getViewport());
            });
        });
    }, [workspaceId, isLoading, nodes.length, setViewport, fitView, getViewport]);

    useEffect(() => {
        lastHydration.current = -1;
        pendingFitForEmpty.current = false;
    }, [workspaceId]);

    return null;
}
