import type { CanvasViewport } from '../types';

const POS_EPS = 1;
const ZOOM_EPS = 0.0005;

/** True when pan/zoom are effectively the same (avoids float noise and redundant saves). */
export function viewportsCloseEnough(a: CanvasViewport | null, b: CanvasViewport | null): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return (
        Math.abs(a.x - b.x) < POS_EPS &&
        Math.abs(a.y - b.y) < POS_EPS &&
        Math.abs(a.zoom - b.zoom) < ZOOM_EPS
    );
}
