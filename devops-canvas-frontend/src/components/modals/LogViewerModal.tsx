import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LazyLog, ScrollFollow } from '@melloware/react-logviewer';
import { createPortal } from 'react-dom';
import { ScrollText, Maximize2, Minimize2, X, GripHorizontal, RefreshCw } from 'lucide-react';
import api from '../../utils/api';

interface LogViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    componentId: string;
    componentName: string;
    componentType: string;
}

const MIN_W = 580;
const MIN_H = 380;
const HEADER_H = 40;
const AUTO_REFRESH_MS = 5000;

function centerRect() {
    return {
        x: Math.max(0, (window.innerWidth - 900) / 2),
        y: Math.max(0, (window.innerHeight - 560) / 2),
        w: Math.min(900, window.innerWidth * 0.92),
        h: Math.min(560, window.innerHeight * 0.85),
    };
}

function resolveWorkspaceId(provided?: string): string {
    if (provided) return provided;
    const match = window.location.pathname.match(/\/workspace\/([^/]+)/);
    return match ? match[1] : '';
}

export function LogViewerModal({ isOpen, onClose, workspaceId, componentId, componentName, componentType }: LogViewerModalProps) {
    const actualWorkspaceId = resolveWorkspaceId(workspaceId);

    const [logText, setLogText] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [rect, setRect] = useState(centerRect);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const savedRect = useRef(rect);
    const [dragging, setDragging] = useState<null | { type: 'move' | 'resize-r' | 'resize-b' | 'resize-br'; startX: number; startY: number; startRect: typeof rect }>(null);

    const fetchLogs = useCallback(async () => {
        if (!actualWorkspaceId) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/deploy/${actualWorkspaceId}/logs?component_id=${componentId}`);
            if (res.data?.logs && Array.isArray(res.data.logs)) {
                setLogText(res.data.logs.join('\n'));
            } else {
                setLogText('No logs returned.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    }, [actualWorkspaceId, componentId]);

    // Fetch on open + auto-refresh
    useEffect(() => {
        if (!isOpen) return;
        fetchLogs();
        refreshTimerRef.current = setInterval(fetchLogs, AUTO_REFRESH_MS);
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [isOpen, fetchLogs]);

    // Reset state when closing
    useEffect(() => {
        if (!isOpen) {
            setLogText('');
            setError('');
            setIsFullscreen(false);
            setRect(centerRect());
        }
    }, [isOpen]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(prev => {
            if (!prev) {
                savedRect.current = rect;
                setRect({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
            } else {
                setRect(savedRect.current);
            }
            return !prev;
        });
    }, [rect]);

    // Pointer drag: move and resize
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: PointerEvent) => {
            const dx = e.clientX - dragging.startX;
            const dy = e.clientY - dragging.startY;
            const s = dragging.startRect;
            if (dragging.type === 'move') {
                setRect(r => ({
                    ...r,
                    x: Math.max(0, Math.min(window.innerWidth - 100, s.x + dx)),
                    y: Math.max(0, Math.min(window.innerHeight - HEADER_H, s.y + dy)),
                }));
            } else {
                let newW = s.w;
                let newH = s.h;
                if (dragging.type === 'resize-r' || dragging.type === 'resize-br') {
                    newW = Math.max(MIN_W, Math.min(window.innerWidth - s.x, s.w + dx));
                }
                if (dragging.type === 'resize-b' || dragging.type === 'resize-br') {
                    newH = Math.max(MIN_H, Math.min(window.innerHeight - s.y, s.h + dy));
                }
                setRect(r => ({ ...r, w: newW, h: newH }));
            }
        };
        const onUp = () => setDragging(null);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [dragging]);

    const startDrag = useCallback((type: 'move' | 'resize-r' | 'resize-b' | 'resize-br', e: React.PointerEvent) => {
        e.preventDefault();
        setDragging({ type, startX: e.clientX, startY: e.clientY, startRect: { ...rect } });
    }, [rect]);

    if (!isOpen) return null;

    const panelStyle: React.CSSProperties = isFullscreen
        ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 60 }
        : { position: 'fixed', left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 60 };

    return createPortal(
        <>
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            <div
                style={panelStyle}
                className="flex flex-col rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-slate-700/60"
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between h-10 px-3 bg-slate-800 border-b border-slate-700/60 select-none shrink-0"
                    onPointerDown={isFullscreen ? undefined : (e) => startDrag('move', e)}
                    style={{ cursor: isFullscreen ? 'default' : 'grab' }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {!isFullscreen && <GripHorizontal size={14} className="text-slate-500 shrink-0" />}
                        <ScrollText size={15} className="text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-300 truncate">
                            Logs: {componentName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                            {componentType}
                        </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => fetchLogs()}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                            title="Refresh logs"
                            disabled={loading}
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                            title={isFullscreen ? 'Restore' : 'Maximize'}
                        >
                            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700/60 transition-colors"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Log body */}
                <div className="flex-1 min-h-0 bg-[#0f172a] relative">
                    {error && (
                        <div className="absolute top-2 left-3 right-3 z-10 text-xs text-red-400 bg-red-950/80 border border-red-800/60 px-3 py-1.5 rounded-md">
                            {error}
                        </div>
                    )}
                    <ScrollFollow
                        startFollowing
                        render={({ follow, onScroll }) => (
                            <LazyLog
                                text={logText || ' '}
                                follow={follow}
                                onScroll={onScroll}
                                enableSearch
                                extraLines={1}
                                caseInsensitive
                                selectableLines
                                style={{
                                    background: '#0f172a',
                                    color: '#e2e8f0',
                                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                    fontSize: 13,
                                }}
                                containerStyle={{
                                    background: '#0f172a',
                                    overflow: 'auto',
                                }}
                            />
                        )}
                    />
                </div>

                {/* Resize handles */}
                {!isFullscreen && (
                    <>
                        <div
                            className="absolute top-10 right-0 w-2 bottom-2 cursor-ew-resize hover:bg-emerald-500/20 transition-colors"
                            onPointerDown={(e) => startDrag('resize-r', e)}
                        />
                        <div
                            className="absolute left-2 bottom-0 right-2 h-2 cursor-ns-resize hover:bg-emerald-500/20 transition-colors"
                            onPointerDown={(e) => startDrag('resize-b', e)}
                        />
                        <div
                            className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize hover:bg-emerald-500/30 transition-colors rounded-tl-md"
                            onPointerDown={(e) => startDrag('resize-br', e)}
                        />
                    </>
                )}
            </div>
        </>,
        document.body
    );
}
