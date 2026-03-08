import React, { useMemo } from 'react';
import { ComponentLibrary } from './ComponentLibrary';
import { CanvasArea } from './CanvasArea';
import { ConfigPanel } from './ConfigPanel';
import { ErrorBoundaryDebug } from './ErrorBoundaryDebug';
import { Toggle } from '../shared/Toggle';
import { Link, useBlocker, useParams } from 'react-router-dom';
import {
    ArrowLeft, Check, Copy, Share2, AlertTriangle, X, Upload
} from 'lucide-react';
import { Button } from '../shared/Button';
import { useCanvasStore } from '../../store/canvasStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ExportModal } from '../modals/ExportModal';
import { ImportModal } from '../modals/ImportModal';
import { UnsavedChangesModal } from '../modals/UnsavedChangesModal';
import { useRealtime } from '../../hooks/useRealtime';
import { StatusBar } from '../layout/StatusBar';
import { DeploymentProgress } from '../modals/DeploymentProgress';
import { TerminalModal } from '../modals/TerminalModal';
import { getComponentByType } from '../../utils/componentRegistry';
import { CursorOverlay } from './CursorOverlay';
import { EditorToolbar } from './EditorToolbar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

import { useDeployment } from '../../hooks/useDeployment';
import { useCanvasImport } from '../../hooks/useCanvasImport';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDeploymentProgress } from '../../hooks/useDeploymentProgress';
import { useCanvasSync } from '../../hooks/useCanvasSync';



import { nodeEditorReducer, initialState, type NodeEditorState, type NodeEditorAction } from './nodeEditorReducer';

export function NodeEditor() {
    const { id: workspaceId } = useParams<{ id: string }>();
    const { isDark, toggle } = useDarkMode();
    const {
        scale, setTransform, pan,
        undo, redo, past, future, resetView,
        nodes, connections,
        loadCanvas, fetchCanvas, saveCanvas, isSaving,
        selectedNodeIds, duplicateNode, removeNodes
    } = useCanvasStore();

    const {
        isConnected,
        systemStats,
        workspaceStats,
        lastMessage,
        canvasUpdate,
        sendCanvasUpdate,
        activeCursors,
        sendCursorMove
    } = useRealtime(workspaceId); const { user } = useAuthStore(); // Need user to filter echo
    const { fetchWorkspace, currentWorkspace } = useWorkspaceStore();

    const [state, dispatch] = React.useReducer(nodeEditorReducer, initialState, (initial) => ({
        ...initial,
        sidebarVisible: localStorage.getItem('canvas_sidebar') !== 'false'
    }));

    const canvasContainerRef = React.useRef<HTMLDivElement>(null);

    // Sync sidebar state to localStorage
    React.useEffect(() => {
        localStorage.setItem('canvas_sidebar', String(state.sidebarVisible));
    }, [state.sidebarVisible]);

    // Deployment Hook
    const {
        showDeployModal,
        setShowDeployModal,
        deploymentSteps,
        setDeploymentSteps,
        deployLogs,
        handleDeploy,
        handleCancelDeploy
    } = useDeployment(workspaceId);

    // Terminal State


    const handleNodeExec = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Find component definition to get proper name if needed, or use label
        // Actually we used getComponentByType in import? Yes I added it.
        const def = getComponentByType(node.type);

        setTerminalConfig({
            isOpen: true,
            componentId: nodeId,
            componentName: node.data.label || 'Component',
            componentType: def?.name || node.type
        });
    };

    // Deployment Progress Handler
    useDeploymentProgress({
        lastMessage,
        showDeployModal,
        setDeploymentSteps
    });
    // Import Hook
    const setTerminalConfig = (config: any) => dispatch({ type: 'SET_TERMINAL_CONFIG', payload: config });
    const setShowExportModal = (show: boolean) => dispatch({ type: 'SET_SHOW_EXPORT_MODAL', payload: show });
    const setShowUnsavedModal = (show: boolean) => dispatch({ type: 'SET_SHOW_UNSAVED_MODAL', payload: show });
    const setSidebarVisible = (visible: boolean) => dispatch({ type: 'SET_SIDEBAR_VISIBLE', payload: visible });
    const setShowImportModal = (show: boolean) => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: show });


    // Import Hook
    const {
        dragActive,
        importInputRef,
        handleDrag,
        handleDrop,
        handleFile,
        importFromText
    } = useCanvasImport({
        workspaceId,
        loadCanvas,
        saveCanvas,
        setShowImportModal // Pass setter
    });

    // Persistence State — snapshot for dirty checking
    const savedStateRef = React.useRef<string | null>(null);

    // AutoSave Hook
    const { saveWorkspace, serializeState, autoSaveTimerRef } = useAutoSave({
        workspaceId,
        saveCanvas,
        dispatch,
        state,
        savedStateRef
    });

    // Navigation Blocker
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }: any) =>
            state.hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    );

    // Show unsaved modal when blocker triggers (inline instead of useEffect)
    if (blocker.state === "blocked" && !state.showUnsavedModal) {
        setShowUnsavedModal(true);
    }



    // Canvas Sync Hook (loading, receiving, sending updates)
    useCanvasSync({
        workspaceId,
        fetchCanvas,
        fetchWorkspace,
        loadCanvas,
        canvasUpdate,
        sendCanvasUpdate,
        user,
        dispatch,
        savedStateRef,
        serializeState,
        nodes,
        connections
    });
    // Calculate Running Nodes based on Realtime Stats
    const runningNodeIds = useMemo(() => {
        const running = new Set<string>();
        if (!workspaceStats?.containers || workspaceStats.containers.length === 0) return running;

        const hasRunningContainers = workspaceStats.containers.length > 0;

        nodes.forEach(node => {
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

    // Save Function (Wrapped by hook)
    const handleSave = () => saveWorkspace();

    const setAutoSaveEnabled = (enabled: boolean) => dispatch({ type: 'SET_AUTO_SAVE_ENABLED', payload: enabled });

    // Auto-Save Scheduler (Moved to Hook)

    // Browser Close Protection
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (state.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [state.hasUnsavedChanges]);

    const handleZoomIn = () => setTransform(Math.min(scale + 0.1, 2), pan);



    const handleZoomOut = () => setTransform(Math.max(scale - 0.1, 0.55), pan);

    const handleFitView = () => {
        if (nodes.length === 0) return setTransform(1, { x: 0, y: 0 });

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Measure actual rendered node sizes from the DOM instead of hardcoding
        const container = canvasContainerRef.current;
        const domNodes = container?.querySelectorAll('.canvas-node');
        const domSizeMap = new Map<string, { w: number; h: number }>();
        domNodes?.forEach(el => {
            const htmlEl = el as HTMLElement;
            const style = htmlEl.style;
            const match = style.transform?.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            if (match) {
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]);
                const node = nodes.find(n => Math.abs(n.position.x - x) < 1 && Math.abs(n.position.y - y) < 1);
                if (node) {
                    domSizeMap.set(node.id, { w: htmlEl.offsetWidth, h: htmlEl.offsetHeight });
                }
            }
        });

        nodes.forEach(n => {
            const size = domSizeMap.get(n.id) || { w: 320, h: 200 };
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxX = Math.max(maxX, n.position.x + size.w);
            maxY = Math.max(maxY, n.position.y + size.h);
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const cx = minX + contentW / 2;
        const cy = minY + contentH / 2;

        const rect = container?.getBoundingClientRect();
        const viewportW = rect ? rect.width : window.innerWidth - (state.sidebarVisible ? 320 : 0);
        const viewportH = rect ? rect.height : window.innerHeight - 64 - 32;

        const padding = 60;
        const scaleW = viewportW / (contentW + padding * 2);
        const scaleH = viewportH / (contentH + padding * 2);
        const newScale = Math.min(Math.min(scaleW, scaleH), 1);

        const newPanX = (viewportW / 2) - (cx * newScale);
        const newPanY = (viewportH / 2) - (cy * newScale);

        setTransform(newScale, { x: newPanX, y: newPanY });
    };



    // --- Keyboard Shortcuts ---
    useKeyboardShortcuts({
        nodes,
        connections,
        selectedNodeIds,
        undo,
        redo,
        past,
        future,
        duplicateNode,
        removeNodes,
        handleSave,
        setShowExportModal
    });



    // ...

    const confirmExit = () => {
        dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });
        setShowUnsavedModal(false);

        if (blocker.state === "blocked") {
            blocker.proceed();
        } else {
            window.location.href = '/dashboard';
        }
    };

    // Import logic moved to useCanvasImport


    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Top Bar - Extracted to EditorToolbar */}
            <EditorToolbar
                currentWorkspace={currentWorkspace}
                sidebarVisible={state.sidebarVisible}
                setSidebarVisible={setSidebarVisible}
                hasUnsavedChanges={state.hasUnsavedChanges}
                onExit={(e) => { if (state.hasUnsavedChanges) { e.preventDefault(); setShowUnsavedModal(true); } }}
                isDark={isDark}
                toggleTheme={toggle}
                undo={undo}
                redo={redo}
                canUndo={past.length > 0}
                canRedo={future.length > 0}
                scale={scale}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onFitView={handleFitView}
                isAutoSaving={state.isAutoSaving}
                lastSaved={state.lastSaved}
                autoSaveEnabled={state.autoSaveEnabled}
                setAutoSaveEnabled={setAutoSaveEnabled}
                onSave={handleSave}
                onDeploy={handleDeploy}
                onExport={() => setShowExportModal(true)}
                onImport={() => setShowImportModal(true)}
            />
            <div className="flex-1 flex overflow-hidden">
                <div
                    className="flex-1 flex overflow-hidden relative"
                >
                    <div className={`transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ${state.sidebarVisible ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0'}`}>
                        <ComponentLibrary />
                    </div>

                    <CanvasArea
                        ref={canvasContainerRef}
                        runningNodeIds={runningNodeIds}
                        onNodeExec={handleNodeExec}
                        activeCursors={activeCursors}
                        sendCursorMove={sendCursorMove}
                    />

                    <div className={`transition-all duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden absolute right-0 top-0 bottom-0 z-10 shadow-xl ${useCanvasStore(s => s.selectedNodeIds.length > 0) ? 'w-[400px] translate-x-0' : 'w-0 translate-x-full'}`}>
                        <ErrorBoundaryDebug>
                            <ConfigPanel />
                        </ErrorBoundaryDebug>
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
            {state.showExportModal && (
                <ExportModal isOpen={state.showExportModal} onClose={() => setShowExportModal(false)} />
            )}

            {/* Terminal Modal */}
            {state.terminalConfig && (
                <TerminalModal
                    isOpen={state.terminalConfig.isOpen}
                    onClose={() => setTerminalConfig(null)}
                    workspaceId={workspaceId || ''}
                    componentId={state.terminalConfig.componentId}
                    componentName={state.terminalConfig.componentName}
                    componentType={state.terminalConfig.componentType}
                />
            )}

            {/* 8. Unsaved Changes Modal */}
            <UnsavedChangesModal
                isOpen={state.showUnsavedModal}
                onStay={() => {
                    setShowUnsavedModal(false);
                    if (blocker.state === "blocked") {
                        blocker.reset();
                    }
                }}
                onLeave={confirmExit}
            />

            {/* 9. Import Modal */}
            <ImportModal
                isOpen={state.showImportModal}
                onClose={() => setShowImportModal(false)}
                dragActive={dragActive}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onBrowseClick={() => importInputRef.current?.click()}
                fileInputRef={importInputRef}
                onFileChange={(file) => handleFile(file)}
                onImportText={importFromText}
            />


        </div>
    );
}
