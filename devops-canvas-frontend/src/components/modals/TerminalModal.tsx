import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { createPortal } from 'react-dom';
import { Terminal as TerminalIcon, Maximize2, Minimize2, X, GripHorizontal } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface TerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    componentId: string;
    componentName: string;
    componentType: string;
    /** Image tag shown in subname (e.g. "mariadb:latest"). Falls back to componentType if not set. */
    imageTag?: string;
}

const MIN_W = 520;
const MIN_H = 320;
const HEADER_H = 40;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function getTerminalWsUrl(workspaceId: string, componentId: string): string {
    const wsBase = API_BASE.replace(/^http/, 'ws');
    return `${wsBase}/deploy/${workspaceId}/terminal?component_id=${componentId}`;
}

function centerRect() {
    return {
        x: Math.max(0, (window.innerWidth - 840) / 2),
        y: Math.max(0, (window.innerHeight - 520) / 2),
        w: Math.min(840, window.innerWidth * 0.92),
        h: Math.min(520, window.innerHeight * 0.85),
    };
}

const TERM_OPTIONS = {
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        cursorAccent: '#0f172a',
        selectionBackground: '#334155',
        black: '#1e293b',
        brightBlack: '#475569',
        red: '#f87171',
        brightRed: '#fca5a5',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#facc15',
        brightYellow: '#fde68a',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#e2e8f0',
        brightWhite: '#f8fafc',
    },
};

export function TerminalModal({ isOpen, onClose, workspaceId, componentId, componentName, componentType, imageTag }: TerminalModalProps) {
    const terminalElRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const [rect, setRect] = useState(centerRect);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const savedRect = useRef(rect);
    const [dragging, setDragging] = useState<null | { type: 'move' | 'resize-r' | 'resize-b' | 'resize-br'; startX: number; startY: number; startRect: typeof rect }>(null);

    const doFit = useCallback(() => {
        try { fitAddonRef.current?.fit(); } catch { /* not ready */ }
    }, []);

    // Create terminal, connect WebSocket -- runs once per modal open
    useEffect(() => {
        if (!isOpen || !terminalElRef.current) return;

        const term = new Terminal(TERM_OPTIONS);
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalElRef.current);
        fitAddon.fit();
        term.focus();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        term.writeln(`\x1b[34m>\x1b[0m Connecting to \x1b[1m${componentName}\x1b[0m (${imageTag ?? componentType})...`);

        const wsUrl = getTerminalWsUrl(workspaceId, componentId);
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln('\x1b[32m>\x1b[0m Connected.\r\n');
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                term.write(event.data);
            } else {
                term.write(new Uint8Array(event.data));
            }
        };

        ws.onclose = () => {
            term.writeln('\r\n\x1b[33m>\x1b[0m Connection closed.');
        };

        ws.onerror = () => {
            term.writeln('\r\n\x1b[31m>\x1b[0m Connection error.');
        };

        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'input', data }));
            }
        });

        term.onResize((dims) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
            }
        });

        let resizeTimeout: ReturnType<typeof setTimeout>;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => fitAddon.fit(), 60);
        });
        resizeObserver.observe(terminalElRef.current);

        return () => {
            clearTimeout(resizeTimeout);
            resizeObserver.disconnect();
            ws.close();
            term.dispose();
            wsRef.current = null;
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, [isOpen, workspaceId, componentId, componentName, componentType, imageTag]);

    // Re-fit on fullscreen toggle
    useEffect(() => {
        if (isOpen) {
            const t = setTimeout(() => {
                doFit();
                xtermRef.current?.focus();
            }, 80);
            return () => clearTimeout(t);
        }
    }, [isFullscreen, isOpen, doFit]);

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

    // Pointer-based drag: move and resize
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
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            {/* Terminal panel */}
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
                        <TerminalIcon size={15} className="text-sky-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-300 truncate">
                            {componentName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                            {imageTag ?? componentType}
                        </span>
                    </div>
                    <div className="flex items-center gap-0.5">
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

                {/* Terminal body */}
                <div className="flex-1 min-h-0 bg-[#0f172a] relative">
                    <div ref={terminalElRef} className="absolute inset-0 p-1" />
                </div>

                {/* Resize handles (only when not fullscreen) */}
                {!isFullscreen && (
                    <>
                        <div
                            className="absolute top-10 right-0 w-2 bottom-2 cursor-ew-resize hover:bg-sky-500/20 transition-colors"
                            onPointerDown={(e) => startDrag('resize-r', e)}
                        />
                        <div
                            className="absolute left-2 bottom-0 right-2 h-2 cursor-ns-resize hover:bg-sky-500/20 transition-colors"
                            onPointerDown={(e) => startDrag('resize-b', e)}
                        />
                        <div
                            className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize hover:bg-sky-500/30 transition-colors rounded-tl-md"
                            onPointerDown={(e) => startDrag('resize-br', e)}
                        />
                    </>
                )}
            </div>
        </>,
        document.body
    );
}
