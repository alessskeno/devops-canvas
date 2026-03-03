import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PanelLeft, Sun, Moon, Undo2, Redo2, ZoomIn, ZoomOut, Cloud, Loader2, Play, Download, Upload, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/Toggle';
import { Workspace } from '../../types';

interface EditorToolbarProps {
    currentWorkspace: Workspace | null;
    sidebarVisible: boolean;
    setSidebarVisible: (visible: boolean) => void;
    hasUnsavedChanges: boolean;
    onExit: (e: React.MouseEvent) => void;

    // Theme
    isDark: boolean;
    toggleTheme: () => void;

    // History
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Zoom
    scale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;

    // Save
    isAutoSaving: boolean;
    lastSaved: Date | null;
    autoSaveEnabled: boolean;
    setAutoSaveEnabled: (enabled: boolean) => void;
    onSave: () => void;

    // Actions
    onDeploy: () => void;
    onExport: () => void;
    onImport: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    currentWorkspace,
    sidebarVisible,
    setSidebarVisible,
    hasUnsavedChanges,
    onExit,
    isDark,
    toggleTheme,
    undo,
    redo,
    canUndo,
    canRedo,
    scale,
    onZoomIn,
    onZoomOut,
    onFitView,
    isAutoSaving,
    lastSaved,
    autoSaveEnabled,
    setAutoSaveEnabled,
    onSave,
    onDeploy,
    onExport,
    onImport
}) => {
    return (
        <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20">
            {/* Left: Navigation & Workspace Info */}
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <Link to="/dashboard" onClick={onExit} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 transition-colors">
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
                <button onClick={toggleTheme} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>

                {/* Undo/Redo */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1">
                    <button onClick={onZoomOut} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                        <ZoomOut size={16} />
                    </button>
                    <button
                        onClick={onFitView}
                        className="text-xs font-mono w-10 text-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
                        title="Reset View"
                    >
                        {(scale * 100).toFixed(0)}%
                    </button>
                    <button onClick={onZoomIn} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
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
                    onClick={onSave}
                    leftIcon={isAutoSaving ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} color={hasUnsavedChanges ? "white" : "green"} />}
                    disabled={isAutoSaving}
                    className={hasUnsavedChanges ? "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm" : ""}
                >
                    {isAutoSaving ? 'Saving...' : 'Save'}
                </Button>

                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2"></div>

                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" leftIcon={<Upload size={16} />} onClick={onImport}>
                        Import
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />} onClick={onExport}>
                        Export
                    </Button>
                    <Button variant="primary" size="sm" leftIcon={<Play size={16} fill="currentColor" />} onClick={onDeploy} className="shadow-lg shadow-blue-500/20">
                        Deploy
                    </Button>
                </div>
            </div>
        </div>
    );
};
