import React, { useMemo } from 'react';
import { ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react';
import { ComponentLibrary } from './ComponentLibrary';
import { CanvasArea } from './CanvasArea';
import { ConfigPanel } from './ConfigPanel';
import { ErrorBoundaryDebug } from './ErrorBoundaryDebug';
import { useBlocker, useParams } from 'react-router-dom';
import { useCanvasStore } from '../../store/canvasStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAuthStore } from '../../store/authStore';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ExportModal } from '../modals/ExportModal';
import { ImportModal } from '../modals/ImportModal';
import { UnsavedChangesModal } from '../modals/UnsavedChangesModal';
import { useRealtime } from '../../hooks/useRealtime';
import { StatusBar } from '../layout/StatusBar';
import { DeploymentProgress } from '../modals/DeploymentProgress';
import { TerminalModal } from '../modals/TerminalModal';
import { LogViewerModal } from '../modals/LogViewerModal';
import { getComponentByType } from '../../utils/componentRegistry';
import { EditorToolbar } from './EditorToolbar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useDeployment } from '../../hooks/useDeployment';
import { useCanvasImport } from '../../hooks/useCanvasImport';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDeploymentProgress } from '../../hooks/useDeploymentProgress';
import { useCanvasSync } from '../../hooks/useCanvasSync';
import { useViewportPersistence } from '../../hooks/useViewportPersistence';
import { RunningNodesProvider } from '../../contexts/RunningNodesContext';
import { nodeEditorReducer, initialState } from './nodeEditorReducer';

export function NodeEditor() {
    return (
        <ReactFlowProvider>
            <NodeEditorContent />
        </ReactFlowProvider>
    );
}

function NodeEditorContent() {
    const { id: workspaceId } = useParams<{ id: string }>();
    const { isDark, toggle } = useDarkMode();
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const viewport = useViewport();

    const {
        undo, redo, past, future,
        nodes, connections,
        loadCanvas, fetchCanvas, saveCanvas, isSaving,
        selectedNodeIds, duplicateNode, removeNodes, selectNode
    } = useCanvasStore();

    const selectedNode = selectedNodeIds.length === 1 ? nodes.find((n) => n.id === selectedNodeIds[0]) ?? null : null;
    const isFileNodeSelected = selectedNode?.type === 'file';

    const {
        isConnected,
        systemStats,
        workspaceStats,
        lastMessage,
        canvasUpdate,
        sendCanvasUpdate,
        activeCursors,
        sendCursorMove
    } = useRealtime(workspaceId);
    const { user } = useAuthStore();
    const { fetchWorkspace, currentWorkspace } = useWorkspaceStore();

    const [state, dispatch] = React.useReducer(nodeEditorReducer, initialState, (initial) => ({
        ...initial,
        sidebarVisible: localStorage.getItem('canvas_sidebar') !== 'false'
    }));

    const canvasContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        localStorage.setItem('canvas_sidebar', String(state.sidebarVisible));
    }, [state.sidebarVisible]);

    const {
        showDeployModal,
        setShowDeployModal,
        deploymentSteps,
        setDeploymentSteps,
        deployLogs,
        handleDeploy,
        handleCancelDeploy
    } = useDeployment(workspaceId);

    const handleNodeExec = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const def = getComponentByType(node.type);
        const image = (node.data as any)?.image;
        const tag = (node.data as any)?.tag;
        const imageTag = image && tag ? `${image}:${tag}` : image || undefined;
        setTerminalConfig({
            isOpen: true,
            componentId: nodeId,
            componentName: node.data.label || 'Component',
            componentType: def?.name || node.type,
            imageTag
        });
    };

    const handleViewLogs = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const def = getComponentByType(node.type);
        setLogViewerConfig({
            isOpen: true,
            componentId: nodeId,
            componentName: node.data.label || 'Component',
            componentType: def?.name || node.type
        });
    };

    useDeploymentProgress({
        lastMessage,
        showDeployModal,
        setDeploymentSteps
    });

    const setTerminalConfig = (config: any) => dispatch({ type: 'SET_TERMINAL_CONFIG', payload: config });
    const setLogViewerConfig = (config: any) => dispatch({ type: 'SET_LOG_VIEWER_CONFIG', payload: config });
    const setShowExportModal = (show: boolean) => dispatch({ type: 'SET_SHOW_EXPORT_MODAL', payload: show });
    const setShowUnsavedModal = (show: boolean) => dispatch({ type: 'SET_SHOW_UNSAVED_MODAL', payload: show });
    const setSidebarVisible = (visible: boolean) => dispatch({ type: 'SET_SIDEBAR_VISIBLE', payload: visible });
    const setShowImportModal = (show: boolean) => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: show });

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
        setShowImportModal
    });

    const savedStateRef = React.useRef<string | null>(null);

    const { saveWorkspace, serializeState, autoSaveTimerRef } = useAutoSave({
        workspaceId,
        saveCanvas,
        dispatch,
        state,
        savedStateRef
    });

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }: any) =>
            state.hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    );

    if (blocker.state === "blocked" && !state.showUnsavedModal) {
        setShowUnsavedModal(true);
    }

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

    useViewportPersistence(workspaceId);

    const runningNodeIds = useMemo(() => {
        const running = new Set<string>();
        if (!workspaceStats?.containers || workspaceStats.containers.length === 0) return running;

        nodes.forEach(node => {
            const serviceName = (node.data as any)?.serviceName?.trim();
            const expectedServiceFragment = serviceName || `${node.type}-${node.id.slice(0, 4)}`;
            const isRunning = workspaceStats.containers.some((c: any) =>
                c.Name && c.Name.includes(expectedServiceFragment)
            );
            if (isRunning) running.add(node.id);
        });

        return running;
    }, [workspaceStats, nodes]);

    const handleSave = () => saveWorkspace();
    const setAutoSaveEnabled = (enabled: boolean) => dispatch({ type: 'SET_AUTO_SAVE_ENABLED', payload: enabled });

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

    const handleZoomIn = () => zoomIn();
    const handleZoomOut = () => zoomOut();
    const handleFitView = () => fitView({ padding: 0.2 });

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

    const confirmExit = () => {
        dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false });
        setShowUnsavedModal(false);
        if (blocker.state === "blocked") {
            blocker.proceed();
        } else {
            window.location.href = '/dashboard';
        }
    };

    return (
        <RunningNodesProvider runningNodeIds={runningNodeIds}>
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
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
                scale={viewport.zoom}
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
                <div className="flex-1 flex overflow-hidden relative">
                    <div className={`transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ${state.sidebarVisible ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0'}`}>
                        <ComponentLibrary />
                    </div>

                    <CanvasArea
                        ref={canvasContainerRef}
                        runningNodeIds={runningNodeIds}
                        onNodeExec={handleNodeExec}
                        onViewLogs={handleViewLogs}
                        activeCursors={activeCursors}
                        sendCursorMove={sendCursorMove}
                        fileEditorNode={isFileNodeSelected && selectedNode ? selectedNode : null}
                        onCloseFileEditor={isFileNodeSelected ? () => selectNode(null) : undefined}
                    />

                    <div className={`transition-all duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden absolute right-0 top-0 bottom-0 z-10 shadow-xl ${selectedNodeIds.length > 0 && !isFileNodeSelected ? 'w-[400px] translate-x-0' : 'w-0 translate-x-full'}`}>
                        <ErrorBoundaryDebug>
                            <ConfigPanel />
                        </ErrorBoundaryDebug>
                    </div>
                </div>
            </div>

            <StatusBar isConnected={isConnected} workspaceStats={workspaceStats} />

            <DeploymentProgress
                isOpen={showDeployModal}
                onClose={() => setShowDeployModal(false)}
                onCancel={handleCancelDeploy}
                logs={deployLogs}
                steps={deploymentSteps}
            />

            {state.showExportModal && (
                <ExportModal isOpen={state.showExportModal} onClose={() => setShowExportModal(false)} />
            )}

            {state.terminalConfig && (
                <TerminalModal
                    isOpen={state.terminalConfig.isOpen}
                    onClose={() => setTerminalConfig(null)}
                    workspaceId={workspaceId || ''}
                    componentId={state.terminalConfig.componentId}
                    componentName={state.terminalConfig.componentName}
                    componentType={state.terminalConfig.componentType}
                    imageTag={state.terminalConfig.imageTag}
                />
            )}

            {state.logViewerConfig && (
                <LogViewerModal
                    isOpen={state.logViewerConfig.isOpen}
                    onClose={() => setLogViewerConfig(null)}
                    workspaceId={workspaceId || ''}
                    componentId={state.logViewerConfig.componentId}
                    componentName={state.logViewerConfig.componentName}
                    componentType={state.logViewerConfig.componentType}
                />
            )}

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
        </RunningNodesProvider>
    );
}
