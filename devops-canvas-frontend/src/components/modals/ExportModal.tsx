import React, { useState } from 'react';
import yaml from 'js-yaml';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/Toggle';
import { Copy, Download, Share2, Eye, FileCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCanvasStore } from '../../store/canvasStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { generateConfig } from '../../utils/exportConfig';
import api from '../../utils/api';
import { useParams } from 'react-router-dom';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const { id: workspaceId } = useParams<{ id: string }>();
    const [mode, setMode] = useState<'canvas' | 'manifest'>('canvas');
    const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
    const [excludeSecrets, setExcludeSecrets] = useState(false);

    // Manifest Preview State
    const [isLoadingManifests, setIsLoadingManifests] = useState(false);
    const [manifests, setManifests] = useState<any>(null);
    const [manifestTab, setManifestTab] = useState<'docker' | 'helm' | 'chart' | 'configs'>('docker');

    const nodes = useCanvasStore((state) => state.nodes);
    const connections = useCanvasStore((state) => state.connections);

    const configContent = generateConfig(nodes, connections, format, excludeSecrets);

    // Reset state and load manifests when modal opens
    React.useEffect(() => {
        if (isOpen && workspaceId && mode === 'manifest') {
            loadManifests(); // Reload if already in manifest mode
        } else if (isOpen && workspaceId) {
            // Optional: Auto-load manifests? Or just reset to canvas?
            // User complained: "click export button to see if the new component also added ... it didn't"
            // If they are in "manifest" mode, we should reload.
            // If they are in "canvas" mode (default), they have to click "Preview".
            // If the user clicks "Export", it opens in 'canvas' mode by default (state initialization).
            // Wait, state `const [mode, setMode] = useState('canvas')` initializes on mount.
            // Since ExportModal creates new state on mount, if it unmounts and remounts, it resets.
            // BUT proper implementation of a Modal often keeps it mounted and just hides it.
            // If it stays mounted, we need to reset `mode` when `isOpen` becomes true?
            // Or just ensure we fetch fresh data.
            // Let's reset mode to 'canvas' on open, OR if we want to stay where we were, we must reload data.
            // Safer to reset to canvas or force reload if in manifest.
        }
    }, [isOpen, workspaceId]);

    // Actually, simpler fix: When clicking "Preview Manifests" button, it ALREADY calls `loadManifests`.
    // The issue is likely that `ExportModal` is NOT unmounting, so `manifests` state is stale.
    // If I add a useEffect to clear manifests or reload when isOpen becomes true.

    React.useEffect(() => {
        if (isOpen) {
            // If we want to support instant preview update, we should invalid old manifests
            setManifests(null);
            // If the user was in 'manifest' mode, we should fetch.
            // But simpler: just reset to 'canvas' mode?
            setMode('canvas');
        }
    }, [isOpen]);

    const loadManifests = async () => {
        if (!workspaceId) return;
        setIsLoadingManifests(true);
        try {
            const response = await api.post(`/deploy/${workspaceId}/manifests`);
            setManifests(response.data);
            setMode('manifest');
        } catch (error) {
            toast.error('Failed to generate manifests');
            console.error(error);
        } finally {
            setIsLoadingManifests(false);
        }
    };

    const getManifestContent = () => {
        if (!manifests) return '';
        if (manifestTab === 'docker') {
            return yaml.dump(manifests.docker_compose);
        }
        if (manifestTab === 'helm') {
            return yaml.dump(manifests.helm_values, { lineWidth: -1 });
        }
        if (manifestTab === 'chart') {
            return yaml.dump(manifests.chart_yaml);
        }
        if (manifestTab === 'configs') {
            return yaml.dump(manifests.configs);
        }
        return '';
    };

    const handleCopy = () => {
        const content = mode === 'canvas' ? configContent : getManifestContent();
        navigator.clipboard.writeText(content);
        toast.success('Copied!');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Export Configuration" size="lg">
            <div className="space-y-4">
                {/* specialized header tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setMode('canvas')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'canvas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Canvas State
                    </button>
                    <button
                        onClick={loadManifests}
                        disabled={isLoadingManifests}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'manifest' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        {isLoadingManifests ? 'Generating...' : <> <Eye size={14} /> Preview Manifests </>}
                    </button>
                </div>

                {mode === 'canvas' ? (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                <button
                                    onClick={() => setFormat('yaml')}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${format === 'yaml' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                >YAML</button>
                                <button
                                    onClick={() => setFormat('json')}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${format === 'json' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                >JSON</button>
                            </div>

                            <Toggle
                                label="Exclude sensitive data"
                                checked={excludeSecrets}
                                onChange={setExcludeSecrets}
                            />
                        </div>
                        <div className="relative">
                            <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96">
                                {configContent}
                            </pre>
                            <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded">
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in">
                        {/* Manifest Sub-tabs */}
                        <div className="flex gap-2 text-xs">
                            <button onClick={() => setManifestTab('docker')} className={`px-3 py-1.5 rounded-full border ${manifestTab === 'docker' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 border-gray-200'}`}>Docker Compose</button>
                            <button onClick={() => setManifestTab('chart')} className={`px-3 py-1.5 rounded-full border ${manifestTab === 'chart' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 border-gray-200'}`}>Chart.yaml</button>
                            <button onClick={() => setManifestTab('helm')} className={`px-3 py-1.5 rounded-full border ${manifestTab === 'helm' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 border-gray-200'}`}>Helm Values</button>
                            <button onClick={() => setManifestTab('configs')} className={`px-3 py-1.5 rounded-full border ${manifestTab === 'configs' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 border-gray-200'}`}>Configs</button>
                        </div>

                        <div className="relative">
                            <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                                {getManifestContent()}
                            </pre>
                            <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded">
                                <Copy size={14} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                            * This is a preview of the generated configuration. To deploy, use the "Deploy" button in the header.
                        </p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="outline" leftIcon={<Share2 size={16} />}>Share Link</Button>
                    <Button leftIcon={<Download size={16} />}>Download File</Button>
                </div>
            </div>
        </Modal>
    );
}
