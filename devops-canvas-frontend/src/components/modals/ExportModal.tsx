import React, { useReducer } from 'react';
import yaml from 'js-yaml';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/Toggle';
import { CodeEditor } from '../shared/CodeEditor';
import { Copy, Download, Share2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useCanvasStore } from '../../store/canvasStore';
import { generateConfig } from '../../utils/exportConfig';
import api from '../../utils/api';
import { useParams } from 'react-router-dom';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ExportState {
    mode: 'canvas' | 'manifest';
    format: 'yaml' | 'json';
    excludeSecrets: boolean;
    isLoadingManifests: boolean;
    manifests: any | null;
    manifestTab: 'docker' | 'configs';
}

type ExportAction =
    | { type: 'SET_MODE'; payload: 'canvas' | 'manifest' }
    | { type: 'SET_FORMAT'; payload: 'yaml' | 'json' }
    | { type: 'TOGGLE_SECRETS'; payload: boolean }
    | { type: 'FETCH_MANIFESTS_START' }
    | { type: 'FETCH_MANIFESTS_SUCCESS'; payload: any }
    | { type: 'FETCH_MANIFESTS_ERROR' }
    | { type: 'SET_MANIFEST_TAB'; payload: 'docker' | 'configs' }
    | { type: 'RESET' };

const initialState: ExportState = {
    mode: 'canvas',
    format: 'yaml',
    excludeSecrets: false,
    isLoadingManifests: false,
    manifests: null,
    manifestTab: 'docker'
};

function exportReducer(state: ExportState, action: ExportAction): ExportState {
    switch (action.type) {
        case 'SET_MODE':
            return { ...state, mode: action.payload };
        case 'SET_FORMAT':
            return { ...state, format: action.payload };
        case 'TOGGLE_SECRETS':
            return { ...state, excludeSecrets: action.payload };
        case 'FETCH_MANIFESTS_START':
            return { ...state, isLoadingManifests: true };
        case 'FETCH_MANIFESTS_SUCCESS':
            return {
                ...state,
                isLoadingManifests: false,
                manifests: action.payload,
                mode: 'manifest',
                manifestTab: 'docker'
            };
        case 'FETCH_MANIFESTS_ERROR':
            return { ...state, isLoadingManifests: false };
        case 'SET_MANIFEST_TAB':
            return { ...state, manifestTab: action.payload };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const { id: workspaceId } = useParams<{ id: string }>();
    const [state, dispatch] = useReducer(exportReducer, initialState);

    const nodes = useCanvasStore((state) => state.nodes);
    const connections = useCanvasStore((state) => state.connections);

    const configContent = generateConfig(nodes, connections, state.format, state.excludeSecrets);



    const loadManifests = async () => {
        if (!workspaceId) return;
        dispatch({ type: 'FETCH_MANIFESTS_START' });
        try {
            const response = await api.post(`/deploy/${workspaceId}/manifests`);
            dispatch({ type: 'FETCH_MANIFESTS_SUCCESS', payload: response.data });
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || 'Failed to generate manifests';
            toast.error(msg);
            console.error(error);
            dispatch({ type: 'FETCH_MANIFESTS_ERROR' });
        }
    };

    const getManifestContent = () => {
        const { manifests, manifestTab } = state;
        if (!manifests) return '';
        if (manifestTab === 'docker') {
            return manifests.docker_compose ? yaml.dump(manifests.docker_compose) : '# No Docker Compose configuration generated';
        }
        if (manifestTab === 'configs') {
            return manifests.configs ? yaml.dump(manifests.configs) : '# No additional configs generated';
        }
        return '';
    };

    const handleCopy = () => {
        const content = state.mode === 'canvas' ? configContent : getManifestContent();
        navigator.clipboard.writeText(content);
        toast.success('Copied!');
    };

    const handleShareLink = () => {
        const content = state.mode === 'canvas' ? configContent : getManifestContent();
        navigator.clipboard.writeText(content);
        toast.success('Link copied to clipboard!');
    };

    const handleDownloadFile = () => {
        const content = state.mode === 'canvas' ? configContent : getManifestContent();
        let filename: string;
        if (state.mode === 'canvas') {
            filename = `workspace-config.${state.format}`;
        } else {
            filename = state.manifestTab === 'docker' ? 'docker-compose.yml' : 'configs.yml';
        }
        const blob = new Blob([content], { type: state.format === 'json' ? 'application/json' : 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${filename}`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Export Configuration" size="lg">
            <div className="space-y-4">
                {/* specialized header tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', payload: 'canvas' })}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${state.mode === 'canvas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Canvas State
                    </button>
                    <button
                        onClick={loadManifests}
                        disabled={state.isLoadingManifests}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${state.mode === 'manifest' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        {state.isLoadingManifests ? 'Generating...' : <> <Eye size={14} /> Preview Manifests </>}
                    </button>
                </div>

                {state.mode === 'canvas' ? (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                <button
                                    onClick={() => dispatch({ type: 'SET_FORMAT', payload: 'yaml' })}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${state.format === 'yaml' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                >YAML</button>
                                <button
                                    onClick={() => dispatch({ type: 'SET_FORMAT', payload: 'json' })}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${state.format === 'json' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                >JSON</button>
                            </div>

                            <Toggle
                                label="Exclude sensitive data"
                                checked={state.excludeSecrets}
                                onChange={(val) => dispatch({ type: 'TOGGLE_SECRETS', payload: val })}
                            />
                        </div>
                        <div className="relative">
                            <CodeEditor
                                value={configContent}
                                language={state.format}
                                readOnly
                                height={380}
                            />
                            <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded z-10">
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in">
                        {/* Manifest Sub-tabs */}
                        <div className="flex gap-2 text-xs">
                            <button onClick={() => dispatch({ type: 'SET_MANIFEST_TAB', payload: 'docker' })} className={`px-3 py-1.5 rounded-full border ${state.manifestTab === 'docker' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 border-gray-200'}`}>Docker Compose</button>
                            <button onClick={() => dispatch({ type: 'SET_MANIFEST_TAB', payload: 'configs' })} className={`px-3 py-1.5 rounded-full border ${state.manifestTab === 'configs' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 border-gray-200'}`}>Configs</button>
                        </div>

                        <div className="relative">
                            <CodeEditor
                                value={getManifestContent()}
                                language="yaml"
                                readOnly
                                height={380}
                            />
                            <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded z-10">
                                <Copy size={14} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                            * This is a preview of the generated configuration. To deploy, use the "Deploy" button in the header.
                        </p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="outline" leftIcon={<Share2 size={16} />} onClick={handleShareLink}>Share Link</Button>
                    <Button leftIcon={<Download size={16} />} onClick={handleDownloadFile}>Download File</Button>
                </div>
            </div>
        </Modal>
    );
}
