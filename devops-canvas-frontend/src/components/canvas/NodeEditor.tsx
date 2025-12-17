import React, { useState, useEffect } from 'react';
import { ComponentLibrary } from './ComponentLibrary';
import { CanvasArea } from './CanvasArea';
import { ConfigPanel } from './ConfigPanel';
import { Toggle } from '../shared/Toggle';
import { Link, useBlocker } from 'react-router-dom';
import {
    ArrowLeft, PanelLeft, Sun, Moon, Undo2, Redo2,
    ZoomIn, ZoomOut, Cloud, Upload, Download, Play, CheckCircle2,
    Check, Loader2, X, Copy, Share2, AlertTriangle
} from 'lucide-react';
import { Button } from '../shared/Button';
import { useCanvasStore } from '../../store/canvasStore';
import toast from 'react-hot-toast';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ExportModal } from '../modals/ExportModal';



export function NodeEditor() {
    const { isDark, toggle } = useDarkMode();
    const { scale, setTransform, pan, undo, redo, past, future, resetView, nodes, connections, loadCanvas, selectedNodeId, duplicateNode, removeNode } = useCanvasStore();
    const [sidebarVisible, setSidebarVisible] = useState(() => localStorage.getItem('canvas_sidebar') !== 'false');
    useEffect(() => localStorage.setItem('canvas_sidebar', String(sidebarVisible)), [sidebarVisible]);

    // Modal State
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [deployStep, setDeployStep] = useState(0);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const importInputRef = React.useRef<HTMLInputElement>(null);

    // Persistence State
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
    const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const isFirstRender = React.useRef(true);
    const unsavedChangesRef = React.useRef(false);

    // Sync ref with state
    useEffect(() => {
        unsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);

    // Navigation Blocker
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }: any) =>
            hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (blocker.state === "blocked") {
            setShowUnsavedModal(true);
        }
    }, [blocker.state]);

    // Load from LocalStorage on Mount
    useEffect(() => {
        const savedData = localStorage.getItem('devops_canvas_workspace');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.nodes) {
                    loadCanvas(parsed.nodes, parsed.connections || []);
                    if (parsed.lastSaved) {
                        setLastSaved(new Date(parsed.lastSaved));
                    }
                    // Reset unsaved changes after load to prevent immediate tracking
                    setTimeout(() => setHasUnsavedChanges(false), 100);
                }
            } catch (e) {
                console.error("Failed to load workspace from local storage", e);
            }
        }
    }, [loadCanvas]);

    // Save Function
    const saveWorkspace = () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        setIsAutoSaving(true);

        // Simulate a small network/processing delay for visual feedback
        setTimeout(() => {
            const now = new Date();
            const data = {
                nodes,
                connections,
                lastSaved: now.toISOString()
            };
            localStorage.setItem('devops_canvas_workspace', JSON.stringify(data));

            setLastSaved(now);
            setHasUnsavedChanges(false);
            setIsAutoSaving(false);
            toast.success('Workspace saved');
        }, 600);
    };

    // Track Changes
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setHasUnsavedChanges(true);
    }, [nodes, connections]);

    // Auto-Save Scheduler
    useEffect(() => {
        if (!hasUnsavedChanges) return;

        if (autoSaveEnabled) {
            setIsAutoSaving(true); // Indicate pending save

            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            autoSaveTimerRef.current = setTimeout(() => {
                saveWorkspace();
            }, 5000);
        } else {
            setIsAutoSaving(false);
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [nodes, connections, autoSaveEnabled, hasUnsavedChanges]);

    // Browser Close Protection
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (unsavedChangesRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const handleZoomIn = () => setTransform(Math.min(scale + 0.1, 5), pan);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input focused
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if (e.metaKey || e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) redo(); else undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        redo();
                        break;
                    case 's':
                        e.preventDefault();
                        handleSave();
                        break;
                    case 'd':
                        e.preventDefault();
                        if (selectedNodeId) {
                            const node = nodes.find(n => n.id === selectedNodeId);
                            if (node && !node.locked) duplicateNode(selectedNodeId);
                        }
                        break;
                    case 'e':
                        e.preventDefault();
                        setShowExportModal(true);
                        break;
                }
            } else {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (selectedNodeId) {
                        const node = nodes.find(n => n.id === selectedNodeId);
                        if (node && !node.locked) removeNode(selectedNodeId);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, connections, past, future, selectedNodeId]);

    const handleZoomOut = () => setTransform(Math.max(scale - 0.1, 0.1), pan);

    const handleFitView = () => {
        if (nodes.length === 0) return setTransform(1, { x: 0, y: 0 });

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxX = Math.max(maxX, n.position.x + 256);
            maxY = Math.max(maxY, n.position.y + 150);
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const cx = minX + contentW / 2;
        const cy = minY + contentH / 2;

        const viewportW = window.innerWidth - (sidebarVisible ? 320 : 0);
        const viewportH = window.innerHeight - 64;

        const scaleW = viewportW / (contentW + 100);
        const scaleH = viewportH / (contentH + 100);
        const newScale = Math.min(Math.min(scaleW, scaleH), 1);

        const newPanX = (viewportW / 2) - (cx * newScale);
        const newPanY = (viewportH / 2) - (cy * newScale);

        setTransform(newScale, { x: newPanX, y: newPanY });
    };

    const handleSave = () => {
        saveWorkspace();
    };

    const handleDeploy = () => {
        setShowDeployModal(true);
        setDeployStep(0);
        let step = 0;
        const interval = setInterval(() => {
            step++;
            setDeployStep(step);
            if (step >= 4) clearInterval(interval);
        }, 1500);
    };

    const confirmExit = () => {
        setHasUnsavedChanges(false);
        unsavedChangesRef.current = false;
        setShowUnsavedModal(false);

        if (blocker.state === "blocked") {
            blocker.proceed();
        } else {
            window.location.href = '/dashboard';
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                if (data.nodes) {
                    loadCanvas(data.nodes, data.connections || []);
                    setShowImportModal(false);
                    toast.success('Configuration imported');
                } else {
                    toast.error('Invalid configuration');
                }
            } catch (err) {
                toast.error('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Top Bar - Single Row as requested */}
            <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20">

                {/* Left: Navigation & Workspace Info */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Link to="/dashboard" onClick={(e) => { if (hasUnsavedChanges) { e.preventDefault(); setShowUnsavedModal(true); } }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <button
                            onClick={() => setSidebarVisible(!sidebarVisible)}
                            className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 transition-colors ${!sidebarVisible ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                        >
                            <PanelLeft size={20} />
                        </button>
                    </div>

                    <div className="flex items-center h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>

                    <div className="flex items-center">
                        <h1 className="font-bold text-lg text-slate-950 dark:text-white mr-3">E-commerce Backend</h1>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">v1.2.4</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Dev</span>
                        </div>
                    </div>
                </div>

                {/* Right: Actions Toolbar */}
                <div className="flex items-center space-x-4">
                    {/* Theme Toggle */}
                    <button onClick={toggle} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>

                    {/* Undo/Redo */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1">
                        <button
                            onClick={undo}
                            disabled={past.length === 0}
                            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            onClick={redo}
                            disabled={future.length === 0}
                            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Redo2 size={16} />
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1">
                        <button onClick={handleZoomOut} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                            <ZoomOut size={16} />
                        </button>
                        <button
                            onClick={handleFitView}
                            className="text-xs font-mono w-10 text-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
                            title="Reset View"
                        >
                            {(scale * 100).toFixed(0)}%
                        </button>
                        <button onClick={handleZoomIn} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>

                    {/* Save Info & Controls */}
                    <div className="flex items-center space-x-3 mr-2">
                        <div className="flex items-center space-x-2" title="Toggle Auto-save">
                            <span className="text-xs text-slate-500 dark:text-slate-400 hidden lg:inline">Auto-save</span>
                            <Toggle checked={autoSaveEnabled} onChange={setAutoSaveEnabled} />
                        </div>

                        {isAutoSaving ? (
                            <span className="text-xs text-blue-500 flex items-center animate-pulse min-w-[60px]"><Loader2 size={12} className="mr-1 animate-spin" /> Saving...</span>
                        ) : lastSaved ? (
                            <span className="text-xs text-slate-400 hidden xl:inline min-w-[80px]">Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        ) : null}
                    </div>

                    {/* Action Buttons */}
                    <Button
                        variant={hasUnsavedChanges ? "primary" : "outline"}
                        size="sm"
                        onClick={handleSave}
                        leftIcon={isAutoSaving ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} color={hasUnsavedChanges ? "white" : "green"} />}
                        disabled={isAutoSaving}
                        className={hasUnsavedChanges ? "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm" : ""}
                    >
                        {hasUnsavedChanges ? 'Save *' : 'Saved'}
                    </Button>

                    <Button variant="outline" size="sm" leftIcon={<Upload size={16} />} onClick={() => setShowImportModal(true)}>
                        Import
                    </Button>

                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />} onClick={() => setShowExportModal(true)}>
                        Export
                    </Button>

                    <Button variant="primary" size="sm" className="bg-green-600 hover:bg-green-700 text-white border-transparent" onClick={handleDeploy} leftIcon={<Play size={16} />}>
                        Deploy
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex overflow-hidden relative">
                    <div className={`transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ${sidebarVisible ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0'}`}>
                        <ComponentLibrary />
                    </div>

                    <CanvasArea />

                    <div className={`transition-all duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden absolute right-0 top-0 bottom-0 z-10 shadow-xl ${useCanvasStore(s => s.selectedNodeId) ? 'w-80 translate-x-0' : 'w-0 translate-x-full'}`}>
                        <ConfigPanel />
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="h-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 text-xs text-slate-500 z-20">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center text-green-600"><div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>System Healthy</div>
                    <div>CPU: 2.5/8 cores</div>
                    <div>Mem: 3.2/16 GB</div>
                </div>
                <div className="flex items-center space-x-4">
                    <span>You • Live</span>
                    <span>{nodes.length} Components</span>
                    <span>{connections.length} Connections</span>
                </div>
            </div>

            {/* 6. Deploy Modal Overlay */}
            {showDeployModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    {/* ... modal content ... */}
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-slate-800">
                        <div className="bg-gray-50 dark:bg-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {deployStep === 4 ? <Check className="text-green-500" /> : <Loader2 className="animate-spin text-blue-500" />}
                                {deployStep === 4 ? "Deployment Successful" : "Deploying Infrastructure"}
                            </h3>
                            {deployStep === 4 && <button onClick={() => setShowDeployModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>}
                        </div>
                        <div className="p-0">
                            {/* Progress Bar */}
                            <div className="h-1 bg-gray-100 dark:bg-slate-800 w-full">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                                    style={{ width: `${deployStep * 25}%` }}
                                />
                            </div>

                            <div className="flex h-96">
                                {/* Steps List */}
                                <div className="w-1/2 p-6 border-r border-gray-200 dark:border-slate-700 space-y-4">
                                    {[
                                        "Validating Configuration",
                                        "Provisioning Kind Cluster",
                                        "Starting Database Services",
                                        "Configuring Network Mesh"
                                    ].map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${deployStep > idx
                                                ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                                : deployStep === idx
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 animate-pulse'
                                                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600'
                                                }`}>
                                                {deployStep > idx ? <Check size={14} /> : idx + 1}
                                            </div>
                                            <span className={`text-sm ${deployStep === idx ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{step}</span>
                                        </div>
                                    ))}

                                    {deployStep === 4 && (
                                        <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg p-4">
                                            <p className="text-sm text-green-800 dark:text-green-400 font-medium mb-1">Workspace is live!</p>
                                            <p className="text-xs text-green-600 dark:text-green-500 mb-3">All services are healthy and reachable.</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => setShowDeployModal(false)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">View Workspace</button>
                                                <button className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 text-xs rounded hover:bg-green-50 dark:hover:bg-slate-700">Open Dashboard</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Terminal Logs */}
                                <div className="w-1/2 bg-gray-900 dark:bg-black p-4 font-mono text-xs overflow-y-auto">
                                    <div className="text-gray-500 mb-2 border-b border-gray-800 pb-2 flex justify-between">
                                        <span>Output Logs</span>
                                        <span className="text-gray-600">tail -f</span>
                                    </div>
                                    <div className="space-y-1 text-gray-300">
                                        {deployStep >= 0 && <div className="text-blue-400">→ Initializing deployment pipeline...</div>}
                                        {deployStep >= 1 && (
                                            <>
                                                <div>[valid] schema_check_pass: true</div>
                                                <div>[valid] resource_quota_check: ok</div>
                                            </>
                                        )}
                                        {deployStep >= 2 && (
                                            <>
                                                <div>[kind] creating cluster "dev-cluster-1"...</div>
                                                <div>[kind] node/1 joined (10.244.0.1)</div>
                                                <div className="text-yellow-400">[warn] image pull delay for postgres:15.4</div>
                                            </>
                                        )}
                                        {deployStep >= 3 && (
                                            <>
                                                <div>[db] postgres:5432 listening</div>
                                                <div>[redis] redis:6379 listening</div>
                                                <div>[kafka] broker-0 online</div>
                                            </>
                                        )}
                                        {deployStep >= 4 && (
                                            <>
                                                <div className="text-green-400">✔ Deployment finalized in 4.2s</div>
                                                <div>----------------------------------------</div>
                                                <div>Access URL: https://dev-canvas.local/app</div>
                                            </>
                                        )}
                                        <div className="animate-pulse">_</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. Export Modal */}
            <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

            {/* 8. Unsaved Changes Modal */}
            {showUnsavedModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-slate-800">
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 shrink-0">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Unsaved Changes</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">You have unsaved changes in your workspace.</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                                Are you sure you want to leave? Your changes will be lost.
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button variant="secondary" onClick={() => {
                                    setShowUnsavedModal(false);
                                    if (blocker.state === "blocked") {
                                        blocker.reset();
                                    }
                                }}>Stay</Button>
                                <Button variant="danger" onClick={confirmExit}>Leave & Discard</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 9. Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[600px] rounded-xl shadow-xl border border-gray-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Import Configuration</h3>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                        </div>

                        <div className="p-6 flex-1 overflow-hidden flex flex-col space-y-4">
                            {/* Drag Drop Area */}
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-slate-600'}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => importInputRef.current?.click()}
                            >
                                <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-full mb-3 text-gray-500 dark:text-gray-400">
                                    <Upload size={24} />
                                </div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">YAML or JSON files supported</p>
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    accept=".json,.yaml,.yml"
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                                />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-slate-800"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white dark:bg-slate-900 px-2 text-gray-500 dark:text-gray-400">Or paste configuration</span>
                                </div>
                            </div>

                            <textarea
                                id="import-textarea"
                                className="flex-1 w-full p-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg font-mono text-sm text-gray-600 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder='Paste your workspace JSON or YAML here...'
                            />
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setShowImportModal(false)}>Cancel</Button>
                            <Button onClick={() => {
                                const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
                                if (textarea.value) {
                                    try {
                                        const data = JSON.parse(textarea.value);
                                        if (data.nodes) {
                                            // recordHistory(); // Mocked
                                            loadCanvas(data.nodes, data.connections || []);
                                            setShowImportModal(false);
                                        } else {
                                            toast.error("Invalid configuration: Missing 'nodes' array.");
                                        }
                                    } catch (e) {
                                        toast.error("Invalid JSON format.");
                                    }
                                }
                            }}>
                                Import Configuration
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
