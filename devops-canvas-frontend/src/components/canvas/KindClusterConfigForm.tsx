import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { KindClusterConfig, CanvasNode, Connection } from '../../types';
import { Input } from '../shared/Input';
import { Select } from '../shared/Select';
import { Toggle } from '../shared/Toggle';
import { Button } from '../shared/Button';
import { Plus, Trash2, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { generateKindConfig } from '../../utils/kindConfig';

interface Props {
    config: KindClusterConfig;
    onChange: (config: KindClusterConfig) => void;
    readOnly?: boolean;
    nodes: CanvasNode[];
    connections: Connection[];
    nodeId: string;
}

export function KindClusterConfigForm({ config, onChange, readOnly, nodes, connections, nodeId }: Props) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'General': true,
        'Topology': false,
        'Networking': false,
        'Storage': false,
        'Advanced': false,
        'Preview': false
    });
    const [fetchedVersions, setFetchedVersions] = useState<{ label: string; value: string }[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    useEffect(() => {
        const fetchVersions = async () => {
            setLoadingVersions(true);
            try {
                const res = await api.get('/components/kind-cluster/versions');
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    setFetchedVersions(res.data);

                    // Auto-select latest version if none selected or if it was the old default
                    if (!config.version || config.version === 'v1.27.3' || config.version === '') {
                        onChange({ ...config, version: res.data[0].value });
                    }
                }
            } catch (error) {
                console.error("Failed to fetch k8s versions", error);
            } finally {
                setLoadingVersions(false);
            }
        };
        fetchVersions();
    }, []);

    // Ensure config has all fields (migrations for existing nodes)
    const safeConfig: KindClusterConfig = {
        name: config?.name || 'kind',
        version: config?.version || 'kindest/node:v1.31.0',
        topology: {
            controlPlanes: config?.topology?.controlPlanes || 1,
            workers: config?.topology?.workers || 0,
        },
        networking: {
            enableIngress: config?.networking?.enableIngress || false,
            apiServerPort: config?.networking?.apiServerPort,
        },
        mounts: config?.mounts || [],
        advancedConfigNodeId: config?.advancedConfigNodeId || '',
    };

    const updateConfig = (updates: Partial<KindClusterConfig>) => {
        onChange({ ...safeConfig, ...updates });
    };

    const getAttachedFileContent = () => {
        if (!safeConfig.advancedConfigNodeId) return undefined;
        const fileNode = nodes.find(n => n.id === safeConfig.advancedConfigNodeId);
        // Assuming file content is stored in 'content' field of data
        return fileNode?.data?.content as string;
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const renderSectionHeader = (title: string, sectionKey: string) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
            <span>{title}</span>
            {expandedSections[sectionKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-md">
            {/* Content Groups */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">

                {/* General Group */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    {renderSectionHeader('General', 'General')}
                    {expandedSections['General'] && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4">
                            <Input
                                label="Cluster Name"
                                value={safeConfig.name}
                                onChange={(e) => updateConfig({ name: e.target.value })}
                                disabled={readOnly}
                                placeholder="e.g. my-cluster"
                            />
                            <Select
                                label="Kubernetes Version"
                                value={safeConfig.version}
                                onChange={(e) => updateConfig({ version: e.target.value })}
                                options={loadingVersions ? [{ label: "Loading versions...", value: "" }] : fetchedVersions}
                                disabled={readOnly || loadingVersions}
                            />
                        </div>
                    )}
                </div>

                {/* Topology Group */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    {renderSectionHeader('Topology', 'Topology')}
                    {expandedSections['Topology'] && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    type="number"
                                    label="Control Planes"
                                    value={safeConfig.topology.controlPlanes}
                                    onChange={(e) => updateConfig({
                                        topology: { ...safeConfig.topology, controlPlanes: parseInt(e.target.value) || 1 }
                                    })}
                                    min={1}
                                    disabled={readOnly}
                                />
                                <Input
                                    type="number"
                                    label="Workers"
                                    value={safeConfig.topology.workers}
                                    onChange={(e) => updateConfig({
                                        topology: { ...safeConfig.topology, workers: parseInt(e.target.value) || 0 }
                                    })}
                                    min={0}
                                    disabled={readOnly}
                                />
                            </div>
                            <div className="flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900/50">
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                    Total Nodes: {safeConfig.topology.controlPlanes + safeConfig.topology.workers}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Networking Group */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    {renderSectionHeader('Networking', 'Networking')}
                    {expandedSections['Networking'] && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-6">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ingress Ready</span>
                                    <Toggle
                                        checked={safeConfig.networking.enableIngress}
                                        onChange={(v) => updateConfig({
                                            networking: { ...safeConfig.networking, enableIngress: v }
                                        })}
                                        disabled={readOnly}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Automatically maps host ports 80 and 443 to the control plane, allowing you to use Ingress Controllers.
                                </p>
                            </div>

                            <Input
                                type="number"
                                label="API Server Port (Optional)"
                                placeholder="Default: random"
                                value={safeConfig.networking.apiServerPort || ''}
                                onChange={(e) => updateConfig({
                                    networking: { ...safeConfig.networking, apiServerPort: e.target.value ? parseInt(e.target.value) : undefined }
                                })}
                                disabled={readOnly}
                            />
                        </div>
                    )}
                </div>

                {/* Storage Group */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    {renderSectionHeader('Storage', 'Storage')}
                    {expandedSections['Storage'] && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase">Extra Mounts</span>
                                <Button
                                    size="sm"
                                    onClick={() => updateConfig({
                                        mounts: [...safeConfig.mounts, { hostPath: '', containerPath: '' }]
                                    })}
                                    disabled={readOnly}
                                >
                                    <Plus size={14} className="mr-1" /> Add
                                </Button>
                            </div>

                            {safeConfig.mounts.length === 0 && (
                                <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded border border-dashed border-slate-200 dark:border-slate-700">
                                    No extra mounts configured.
                                </div>
                            )}

                            {safeConfig.mounts.map((mount, idx) => (
                                <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-2 relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                const newMounts = [...safeConfig.mounts];
                                                newMounts.splice(idx, 1);
                                                updateConfig({ mounts: newMounts });
                                            }}
                                            className="text-red-500 hover:text-red-700"
                                            disabled={readOnly}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <Input
                                        label="Host Path"
                                        placeholder="/home/user/project"
                                        value={mount.hostPath}
                                        onChange={(e) => {
                                            const newMounts = [...safeConfig.mounts];
                                            newMounts[idx].hostPath = e.target.value;
                                            updateConfig({ mounts: newMounts });
                                        }}
                                        disabled={readOnly}
                                    />
                                    <Input
                                        label="Container Path"
                                        placeholder="/app/data"
                                        value={mount.containerPath}
                                        onChange={(e) => {
                                            const newMounts = [...safeConfig.mounts];
                                            newMounts[idx].containerPath = e.target.value;
                                            updateConfig({ mounts: newMounts });
                                        }}
                                        disabled={readOnly}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Advanced Group */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    {renderSectionHeader('Advanced', 'Advanced')}
                    {expandedSections['Advanced'] && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4">
                            <Select
                                label="Attach Config File"
                                value={safeConfig.advancedConfigNodeId || ''}
                                onChange={(e) => updateConfig({ advancedConfigNodeId: e.target.value })}
                                options={[
                                    { label: 'Select a connected node...', value: '' },
                                    ...nodes
                                        .filter(n => {
                                            const isCorrectType = n.type === 'file';
                                            const isConnected = connections.some(conn =>
                                                (conn.source === nodeId && conn.target === n.id) ||
                                                (conn.target === nodeId && conn.source === n.id)
                                            );
                                            return isCorrectType && isConnected;
                                        })
                                        .map(n => ({ label: `${n.data.label} (${n.id.slice(0, 4)})`, value: n.id }))
                                ]}
                                disabled={readOnly}
                            />
                            <p className="text-[10px] text-slate-500">
                                Create a "Config File" node, write your YAML patch there, and connect it to this cluster node.
                            </p>
                        </div>
                    )}
                </div>

                {/* Preview Group */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    {renderSectionHeader('Preview (YAML)', 'Preview')}
                    {expandedSections['Preview'] && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 flex flex-col h-64">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    Generated configuration (kind-config.yaml)
                                </label>
                                <Button
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(generateKindConfig(safeConfig, getAttachedFileContent()))}
                                >
                                    <Copy size={14} className="mr-1" /> Copy
                                </Button>
                            </div>
                            <pre className="flex-1 p-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-950 text-slate-50 font-mono text-[10px] overflow-auto whitespace-pre h-full">
                                {generateKindConfig(safeConfig, getAttachedFileContent())}
                            </pre>
                        </div>
                    )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-600 dark:text-blue-400">
                    Configure parameters specific to kind-cluster.
                </div>
            </div>
        </div>
    );
}
