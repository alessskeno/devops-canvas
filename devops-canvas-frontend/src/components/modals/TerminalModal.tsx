import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Modal } from '../shared/Modal';
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface TerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    componentId: string;
    componentName: string;
    componentType: string;
}

export function TerminalModal({ isOpen, onClose, workspaceId, componentId, componentName, componentType }: TerminalModalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!isOpen || !terminalRef.current) return;

        // Initialize Terminal
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#1e293b',
                foreground: '#cbd5e1',
            },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect WebSocket
        // Using relative path for proxy support locally, or explicit full URL if needed
        // Assuming /api proxy is set up or we construct full URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Adjust host usage based on environment
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/deploy/${workspaceId}/terminal?component_id=${componentId}`;

        // Add a small welcome message
        term.writeln(`\x1b[34m➜\x1b[0m Connecting to shell for ${componentName} (${componentType})...`);

        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer'; // Backend sends binary/text mix but we prepared for binary

        ws.onopen = () => {
            term.writeln(`\x1b[32m✔\x1b[0m Connected.`);
            wsRef.current = ws;
            // No resize handler sent to backend yet in MVP
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                term.write(event.data);
            } else {
                term.write(new Uint8Array(event.data));
            }
        };

        ws.onclose = () => {
            term.writeln('\r\n\x1b[33m⚠\x1b[0m Connection closed.');
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            term.writeln('\r\n\x1b[31m✖\x1b[0m Connection error.');
        };

        // Input Handling
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
        });
        resizeObserver.observe(terminalRef.current);

        // Autofocus
        term.focus();

        return () => {
            // Cleanup
            ws.close();
            term.dispose();
            resizeObserver.disconnect();
        };
    }, [isOpen, workspaceId, componentId]);

    // Re-fit on fullscreen toggle
    useEffect(() => {
        if (isOpen && fitAddonRef.current) {
            setTimeout(() => {
                fitAddonRef.current?.fit();
                xtermRef.current?.focus();
            }, 100);
        }
    }, [isFullscreen, isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <TerminalIcon size={20} className="text-blue-400" />
                    <span>Terminal: <span className="text-blue-400 font-mono">{componentName}</span></span>
                </div>
            }
            size={isFullscreen ? 'full' : '2xl'}
        >
            <div className="flex flex-col h-full bg-[#1e293b] rounded-b-lg overflow-hidden relative">
                {/* Custom Toolbar Actions if needed */}
                <div className="absolute top-[-44px] right-12 flex gap-2">
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-slate-700 transition"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>

                <div
                    ref={terminalRef}
                    className={`w-full ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[500px]'} p-2`}
                />
            </div>
        </Modal>
    );
}
