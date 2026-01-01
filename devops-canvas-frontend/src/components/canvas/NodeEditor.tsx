import React, { useState, useEffect, useRef, useMemo } from 'react';
import yaml from 'js-yaml';
import { ComponentLibrary } from './ComponentLibrary';
import { CanvasArea } from './CanvasArea';
import { ConfigPanel } from './ConfigPanel';
import { Toggle } from '../shared/Toggle';
import { Link, useBlocker, useParams } from 'react-router-dom';
import {
    ArrowLeft, PanelLeft, Sun, Moon, Undo2, Redo2,
    ZoomIn, ZoomOut, Cloud, Upload, Download, Play, CheckCircle2,
    Check, Loader2, X, Copy, Share2, AlertTriangle
} from 'lucide-react';
import { Button } from '../shared/Button';
import { useCanvasStore } from '../../store/canvasStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import toast from 'react-hot-toast';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ExportModal } from '../modals/ExportModal';
import { useRealtime } from '../../hooks/useRealtime';
import { StatusBar } from '../layout/StatusBar';
import { DeploymentProgress } from '../modals/DeploymentProgress';

interface DeploymentStep {
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    details?: string;
}



export function NodeEditor() {
    const { id: workspaceId } = useParams<{ id: string }>();
    const { isDark, toggle } = useDarkMode();
    const {
        scale, setTransform, pan,
        undo, redo, past, future, resetView,
        nodes, connections,
        loadCanvas, fetchCanvas, saveCanvas, isSaving,
        selectedNodeId, duplicateNode, removeNode
    } = useCanvasStore();

    const { isConnected, systemStats, workspaceStats, lastMessage } = useRealtime(workspaceId);

    const { fetchWorkspace, currentWorkspace } = useWorkspaceStore();

    const [sidebarVisible, setSidebarVisible] = useState(() => localStorage.getItem('canvas_sidebar') !== 'false');
    useEffect(() => localStorage.setItem('canvas_sidebar', String(sidebarVisible)), [sidebarVisible]);

    // Modal State
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [deployStep, setDeployStep] = useState(0); // Deprecated by deploymentSteps
    const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([
        { label: 'Initializing Deployment', status: 'pending', details: '' },
        { label: 'Generating Manifests', status: 'pending', details: '' },
        { label: 'Provisioning Containers', status: 'pending', details: '' },
        { label: 'Verifying Health', status: 'pending', details: '' }
    ]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);

    // Deployment Progress Handler
    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'deployment.step' || !showDeployModal) return;

        const payload = lastMessage.payload;
        // payload: { step: string, status: string, label: string }
        // We map backend steps to our UI steps

        setDeploymentSteps(prev => {
            const newSteps = [...prev];
            // Mapping logic:
            // initializing -> 0
            // generating -> 1
            // provisioning -> 2
            // verified -> 3

            let idx = -1;
            switch (payload.step) {
                case 'initializing': idx = 0; break;
                case 'generating': idx = 1; break;
                case 'provisioning': idx = 2; break;
                case 'verified': idx = 3; break;
            }

            if (idx !== -1) {
                newSteps[idx] = {
                    label: payload.label || newSteps[idx].label,
                    status: payload.status as any,
                    details: payload.details || ''
                };

                // Auto-complete previous steps
                // If we receive an update for step N (being in-progress or completed), 
                // it implies all steps 0..N-1 are completed.
                if (payload.status === 'in-progress' || payload.status === 'completed') {
                    for (let i = 0; i < idx; i++) {
                        if (newSteps[i].status !== 'completed') newSteps[i].status = 'completed';
                    }
                }
            }
            return newSteps;
        });
    }, [lastMessage, showDeployModal]);
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

    // Load from Backend on Mount
    useEffect(() => {
        if (workspaceId) {
            fetchWorkspace(workspaceId);
            fetchCanvas(workspaceId).then(() => {
                // Reset unsaved changes after load
                setTimeout(() => {
                    setHasUnsavedChanges(false);
                    isFirstRender.current = true; // Reset first render tracker so initial population doesn't trigger dirty state
                }, 100);
            });
        }
    }, [workspaceId, fetchCanvas, fetchWorkspace]);

    // ... existing code ...

    // Header JSX replacement
    /* 
       Locating the header div around line 321-327.
       We will replace lines 321-327 with dynamic content.
    */


    // Calculate Running Nodes based on Realtime Stats
    const runningNodeIds = useMemo(() => {
        const running = new Set<string>();
        if (!workspaceStats?.containers || workspaceStats.containers.length === 0) return running;

        const hasRunningContainers = workspaceStats.containers.length > 0;

        nodes.forEach(node => {
            // Infrastructure Nodes are "Running" if the workspace is active (has containers)
            if (node.type === 'docker-compose' || node.type === 'kind-cluster') {
                if (hasRunningContainers) {
                    running.add(node.id);
                }
                return;
            }

            // Standard Components: Check for matching container
            const shortID = node.id.slice(0, 4);
            const expectedServiceFragment = `${node.type}-${shortID}`;

            // Check if any container matches this fragment
            // We look for strict inclusion of "type-shortID" in the container name
            const isRunning = workspaceStats.containers.some(c => {
                // c.Name is typically "/project_service_1" or "project-service-1"
                return c.Name.includes(expectedServiceFragment);
            });

            if (isRunning) {
                running.add(node.id);
            }
        });

        return running;
    }, [workspaceStats, nodes]);

    // Save Function
    const saveWorkspace = async () => {
        if (!workspaceId) return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        setIsAutoSaving(true);

        try {
            await saveCanvas(workspaceId);
            const now = new Date();
            setLastSaved(now);
            setHasUnsavedChanges(false);
            setIsAutoSaving(false);
            toast.success('Workspace saved');
        } catch (error: any) {
            console.error(error);
            setIsAutoSaving(false);
            const msg = error.response?.data?.error || error.message || 'Failed to save workspace';
            toast.error(msg);
        }
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

    // Deploy Logic
    const [deployLogs, setDeployLogs] = useState<string[]>([]);
    const abortControllerRef = React.useRef<AbortController | null>(null);

    const handleDeploy = async () => {
        if (!workspaceId) return;

        setShowDeployModal(true);
        setDeployStep(0);
        setDeploymentSteps([
            { label: 'Initializing Deployment', status: 'in-progress', details: '' },
            { label: 'Generating Manifests', status: 'pending', details: '' },
            { label: 'Provisioning Containers', status: 'pending', details: '' },
            { label: 'Verifying Health', status: 'pending', details: '' }
        ]);
        setDeployLogs(['Starting deployment...']);

        // Create new controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        let interval: any = null;

        try {
            const { default: api } = await import('../../utils/api');

            // Start polling for logs
            interval = setInterval(async () => {
                if (controller.signal.aborted) {
                    if (interval) clearInterval(interval);
                    return;
                }
                try {
                    // Only fetch if modal is open? Yes.
                    const logRes = await api.get(`/deploy/${workspaceId}/logs`);
                    if (logRes.data.logs) {
                        setDeployLogs(logRes.data.logs);
                    }
                } catch (e) {
                    // ignore poll errors (e.g. 404 before pods created)
                }
            }, 1000);

            // Pass signal to axios/fetch - verify deployment
            await api.post(`/deploy/${workspaceId}`, {}, {
                signal: controller.signal
            });

            // Deployment Success
            if (interval) clearInterval(interval);

            // Note: We don't auto-close the modal, allowing user to see "Verified" state.
            // But we stop polling logs to reduce network noise.

        } catch (error: any) {
            if (interval) clearInterval(interval);

            if (error.name === 'CanceledError' || error.code === "ERR_CANCELED") {
                toast.error("Deployment Cancelled");
                setDeployLogs(prev => [...prev, "Deployment cancelled by user."]);
            } else {
                console.error(error);
                // The deployment step error state is handled by WebSocket events, 
                // but we might want to log it here too.
                toast.error("Deployment Failed");
            }
        }
    };

    const handleCancelDeploy = async () => {
        // 1. Abort ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // 2. Trigger explicit teardown
        toast.loading("Cancelling deployment...", { id: "cancel-deploy" });

        try {
            const { default: api } = await import('../../utils/api');
            await api.post(`/deploy/${workspaceId}/teardown`);
            toast.success("Deployment Cancelled & Cleaned up", { id: "cancel-deploy" });

            // Visual Rollback Animation
            setDeploymentSteps(prev => {
                const newSteps = [...prev];
                // Mark current error step as pending immediately to clear red state
                const errorIdx = newSteps.findIndex(s => s.status === 'error');
                if (errorIdx !== -1) {
                    newSteps[errorIdx] = { ...newSteps[errorIdx], status: 'pending', details: '' };
                }
                return newSteps;
            });

            // Animate backwards
            for (let i = deploymentSteps.length - 1; i >= 0; i--) {
                if (deploymentSteps[i].status === 'completed' || deploymentSteps[i].status === 'in-progress' || deploymentSteps[i].status === 'error') {
                    await new Promise(resolve => setTimeout(resolve, 300)); // Delay
                    setDeploymentSteps(prev => {
                        const newSteps = [...prev];
                        newSteps[i] = { ...newSteps[i], status: 'pending', details: '' };
                        return newSteps;
                    });
                }
            }

            // Close after animation
            setTimeout(() => setShowDeployModal(false), 500);

        } catch (e) {
            console.error("Teardown failed", e);
            toast.error("Cleanup failed", { id: "cancel-deploy" });
        }
    };

    // ...

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

    const processImportData = async (data: any) => {
        if (!data || !data.nodes) {
            toast.error('Invalid configuration: Missing "nodes" array');
            return;
        }

        // 1. Create ID Mapping (Old ID -> New UUID)
        const idMap = new Map<string, string>();

        // 2. Process Nodes: Regenerate IDs and Sanitize
        const importedNodes = data.nodes.map((n: any) => {
            const newId = crypto.randomUUID();
            idMap.set(n.id, newId);

            return {
                ...n,
                id: newId,
                workspace_id: workspaceId || n.workspace_id,
                selected: false,
                position: n.position || { x: n.position_x || 0, y: n.position_y || 0 }
            };
        });

        // 3. Process Connections: Remap Source/Target and Sanitize
        const importedConnections = (data.connections || []).reduce((acc: any[], c: any) => {
            const newSource = idMap.get(c.source);
            const newTarget = idMap.get(c.target);

            // Only keep connection if both endpoints exist in the imported set
            if (newSource && newTarget) {
                acc.push({
                    ...c,
                    id: crypto.randomUUID(),
                    workspace_id: workspaceId || c.workspace_id,
                    source: newSource,
                    target: newTarget
                });
            }
            return acc;
        }, []);

        // 4. Load & Save
        loadCanvas(importedNodes, importedConnections);
        setShowImportModal(false);

        if (workspaceId) {
            try {
                await saveCanvas(workspaceId);
                toast.success('Configuration imported and saved as new copy');
            } catch (saveError) {
                console.error('Import save failed:', saveError);
                toast.error('Imported locally but failed to save to backend');
            }
        } else {
            toast.success('Configuration imported (unsaved)');
        }
    };

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                let data: any;
                try {
                    data = JSON.parse(content);
                } catch (jsonErr) {
                    try {
                        data = yaml.load(content);
                    } catch (yamlErr) {
                        throw new Error('Invalid format: Must be JSON or YAML');
                    }
                }
                await processImportData(data);
            } catch (err) {
                toast.error('Failed to parse file');
                console.error(err);
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
                        <h1 className="font-bold text-lg text-slate-950 dark:text-white mr-3">{currentWorkspace?.name || 'Loading...'}</h1>
                        {currentWorkspace && (
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentWorkspace.version || 'v0.1.0'}</span>
                                {(() => {
                                    const env = currentWorkspace.environment || 'development';
                                    let label = 'DEV';
                                    let color = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';

                                    if (env === 'production') {
                                        label = 'PROD';
                                        color = 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
                                    } else if (env === 'staging') {
                                        label = 'STAGING';
                                        color = 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
                                    }

                                    return (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${color}`}>
                                            {label}
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
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

                    <CanvasArea runningNodeIds={runningNodeIds} />

                    <div className={`transition-all duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden absolute right-0 top-0 bottom-0 z-10 shadow-xl ${useCanvasStore(s => s.selectedNodeId) ? 'w-80 translate-x-0' : 'w-0 translate-x-full'}`}>
                        <ConfigPanel />
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <StatusBar isConnected={isConnected} workspaceStats={workspaceStats} />

            {/* 6. Deploy Modal Overlay */}
            <DeploymentProgress
                isOpen={showDeployModal}
                onClose={() => setShowDeployModal(false)}
                onCancel={handleCancelDeploy}
                logs={deployLogs}
                steps={deploymentSteps}
            />

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
                            <Button onClick={async () => {
                                const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
                                if (textarea.value) {
                                    try {
                                        let data: any;
                                        const content = textarea.value;
                                        try {
                                            data = JSON.parse(content);
                                        } catch (jsonErr) {
                                            try {
                                                data = yaml.load(content);
                                            } catch (yamlErr) {
                                                throw new Error('Invalid format');
                                            }
                                        }
                                        await processImportData(data);
                                    } catch (e) {
                                        toast.error("Invalid JSON or YAML format.");
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
