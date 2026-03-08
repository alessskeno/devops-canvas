import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCanvasStore } from '../../store/canvasStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Select } from '../shared/Select';
import { Toggle } from '../shared/Toggle';
import { X, Trash2, Copy, ChevronDown, ChevronRight, Settings, Server, Key, Wrench } from 'lucide-react';
import { COMPONENT_REGISTRY } from '../../utils/componentRegistry';
import { COMPONENT_CONFIG_SCHEMAS, ConfigField } from '../../utils/componentConfigSchemas';

import { AlertmanagerConfigForm } from './AlertmanagerConfigForm';
import { ConfigFieldRenderer } from './ConfigFieldRenderer';
import api from '../../utils/api';

export function ConfigPanel() {
    const { id: workspaceId } = useParams<{ id: string }>();
    const {
        selectedNodeIds, nodes, connections, updateNodeData, removeNode, removeNodes, selectNode,
        activePanelTab, setActivePanelTab, toggleLockNode
    } = useCanvasStore();

    const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
    const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, { label: string; value: string }[]>>({});
    const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});

    const currentTab = activePanelTab || 'General';

    // Convert to ref or use effect dependency carefully to avoid infinite loops
    React.useEffect(() => {
        if (!selectedNode) return;
        const schema = COMPONENT_CONFIG_SCHEMAS[selectedNode.type];
        if (!schema) return;

        // Reset options when switching node types
        setDynamicOptions({});

        schema.forEach(async (field) => {
            if (field.dynamicOptions) {
                try {
                    setLoadingVersions(prev => ({ ...prev, [field.key]: true }));
                    const res = await api.get(`/components/${selectedNode.type}/versions`);
                    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                        setDynamicOptions(prev => ({
                            ...prev,
                            [field.key]: res.data
                        }));

                        // Auto-select the latest version if none is currently selected (or if it's currently hardcoded/stale)
                        // logic: if node data value for this field is empty, or equals the old default, update it.
                        // But simplest is: if empty, take the first.
                        const currentVal = selectedNode.data[field.key];
                        if (!currentVal && res.data.length > 0) {
                            // We need to update the node data. 
                            // NOTE: We cannot call updateNodeData directly inside this loop without causing state issues or race conditions 
                            // if multiple fields update. But here only 'version' is dynamic.
                            // Actually, we can use the handleChange exposed logic or call updateNodeData store action.
                            updateNodeData(selectedNodeId, { [field.key]: res.data[0].value });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to fetch versions for ${selectedNode.type}`, error);
                } finally {
                    setLoadingVersions(prev => ({ ...prev, [field.key]: false }));
                }
            }
        });
    }, [selectedNode?.type]);

    if (selectedNodeIds.length === 0) return null;

    if (selectedNode?.type === 'file') return null;

    if (selectedNodeIds.length > 1) {
        const allLocked = selectedNodes.every(n => n.locked);
        return (
            <div className="w-[400px] h-full flex flex-col bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 select-none">
                <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-lg text-slate-900 dark:text-gray-100">
                            {selectedNodeIds.length} components selected
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Select a single node to edit, or use actions below
                        </p>
                    </div>
                    <button
                        onClick={() => selectNode(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => removeNodes(selectedNodeIds)}
                            className="w-full px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
                        >
                            Delete all ({selectedNodeIds.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => selectedNodeIds.forEach(id => toggleLockNode(id))}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                            {allLocked ? 'Unlock all' : 'Lock all'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!selectedNode) return null;

    const isLocked = selectedNode.locked;

    const componentDef = COMPONENT_REGISTRY.find(c => c.type === selectedNode.type);

    const handleChange = (key: string, value: any) => {
        updateNodeData(selectedNode.id, { [key]: value });
    };

    // This function is now replaced by ConfigFieldRenderer component usage in the render method.
    // We will remove this definition and use the imported component.
    // However, since it depends on `handleChange`, `selectedNode`, `nodes`, `connections`, `isLocked`, `loadingVersions`, `dynamicOptions`, passing all these props is heavy. 
    // Maybe better to keep it here or memoize it? 
    // React doctor suggests breaking down large components. 
    // Let's first remove the inline definition and unused imports if any.
    // I'll leave it for now and focus on correctness.
    // actually, I'll just leave it if I can't easily extract without prop drilling.


    const handleAddPort = () => {
        const ports = selectedNode.data.portMappings || [];
        handleChange('portMappings', [...ports, '']);
    };
    const handleUpdatePort = (index: number, val: string) => {
        const ports = [...(selectedNode.data.portMappings || [])];
        ports[index] = val;
        handleChange('portMappings', ports);
    };
    const handleRemovePort = (index: number) => {
        const ports = [...(selectedNode.data.portMappings || [])];
        ports.splice(index, 1);
        handleChange('portMappings', ports);
    };

    const handleAddEnv = () => {
        const envs = { ...(selectedNode.data.envVars || {}) };
        envs[`NEW_VAR_${Object.keys(envs).length}`] = 'value';
        handleChange('envVars', envs);
    };
    const handleUpdateEnvKey = (oldKey: string, newKey: string) => {
        if (oldKey === newKey) return;
        const envs = { ...(selectedNode.data.envVars || {}) };
        const val = envs[oldKey];
        delete envs[oldKey];
        envs[newKey] = val;
        handleChange('envVars', envs);
    };
    const handleUpdateEnvValue = (key: string, val: string) => {
        const envs = { ...(selectedNode.data.envVars || {}) };
        envs[key] = val;
        handleChange('envVars', envs);
    };
    const handleRemoveEnv = (key: string) => {
        const envs = { ...(selectedNode.data.envVars || {}) };
        delete envs[key];
        handleChange('envVars', envs);
    };



    const TABS = [
        { id: 'General', icon: <Settings size={18} />, label: 'General' },
        { id: 'Ports', icon: <Server size={18} />, label: 'Port Mappings' },
        { id: 'EnvVars', icon: <Key size={18} />, label: 'Environment Variables' },
        { id: 'Config', icon: <Wrench size={18} />, label: 'Tool Options' },
    ];

    return (
        <div className="w-[400px] h-full flex flex-col bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 select-none">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800/80 dark:bg-slate-800 rounded-lg text-blue-400">
                        <Wrench size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-slate-900 dark:text-gray-100 leading-tight">{selectedNode.data.label}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tracking-wider mt-0.5">{componentDef?.name || selectedNode.type}</p>
                    </div>
                </div>
                <button onClick={() => selectNode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X size={18} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Vertical Sidebar Tabs - match left panel selection style (subtle bg + left border) */}
                <div className="w-[50px] flex flex-col items-center py-4 space-y-4 border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {TABS.map(tab => {
                        const isActive = currentTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActivePanelTab(tab.id)}
                                title={tab.label}
                                className={`p-2 rounded-lg transition-colors border-l-2 -ml-[2px]
                                    ${isActive
                                        ? 'bg-slate-100 dark:bg-slate-800/60 text-blue-500 dark:text-blue-400 border-blue-500 dark:border-blue-500'
                                        : 'border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                {tab.icon}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area - same surface as component list panel */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white dark:bg-slate-900">
                    {currentTab === 'General' && (
                        <div className="space-y-6">
                            <section>
                                <Input
                                    label="Service name"
                                    value={selectedNode.data.serviceName ?? selectedNode.data.label}
                                    placeholder="Used as the Docker Compose key"
                                    onChange={e => handleChange('serviceName', e.target.value)}
                                    disabled={isLocked}
                                />
                            </section>

                            <section className="flex gap-4">
                                <div className="flex-1">
                                    <Input
                                        label="Image"
                                        value={selectedNode.data.image ?? selectedNode.type}
                                        onChange={e => handleChange('image', e.target.value)}
                                        disabled={isLocked}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        label="Tag"
                                        value={selectedNode.data.tag ?? 'latest'}
                                        onChange={e => handleChange('tag', e.target.value)}
                                        disabled={isLocked}
                                    />
                                </div>
                            </section>

                            <section>
                                <Input
                                    label="Container name"
                                    value={selectedNode.data.containerName ?? ''}
                                    placeholder="Explicit container name (optional)"
                                    onChange={e => handleChange('containerName', e.target.value)}
                                    disabled={isLocked}
                                />
                            </section>

                            <section>
                                <Select
                                    label="Restart policy"
                                    value={selectedNode.data.restartPolicy ?? 'always'}
                                    onChange={e => handleChange('restartPolicy', e.target.value)}
                                    options={[
                                        { label: 'always', value: 'always' },
                                        { label: 'unless-stopped', value: 'unless-stopped' },
                                        { label: 'on-failure', value: 'on-failure' },
                                        { label: 'no', value: 'no' }
                                    ]}
                                    disabled={isLocked}
                                />
                            </section>

                            <section>
                                <Input
                                    label="Command"
                                    value={selectedNode.data.command ?? ''}
                                    placeholder="Override the default container command"
                                    onChange={e => handleChange('command', e.target.value)}
                                    disabled={isLocked}
                                />
                            </section>

                            <section className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-800">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enabled</span>
                                <Toggle
                                    checked={selectedNode.data.enabled !== false}
                                    onChange={v => handleChange('enabled', v)}
                                    disabled={isLocked}
                                />
                            </section>

                            <section>
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">RESOURCES</h3>

                                <div className="mb-4">
                                    <div className="flex justify-between mb-1.5">
                                        <label htmlFor="cpu-limit" className="text-xs font-medium text-slate-700 dark:text-slate-300">CPU Limit</label>
                                        <span className="text-xs text-slate-500 dark:text-gray-500">
                                            {(selectedNode.data.resources?.cpu === 0 || selectedNode.data.resources?.cpu === undefined) ? 'Unlimited' : `${selectedNode.data.resources?.cpu} Cores`}
                                        </span>
                                    </div>
                                    <input
                                        id="cpu-limit"
                                        type="range"
                                        min="0" max="4" step="0.1"
                                        className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700 accent-blue-500 dark:accent-blue-500'}`}
                                        value={selectedNode.data.resources?.cpu ?? 0}
                                        onChange={e => handleChange('resources', { ...(selectedNode.data.resources || {}), cpu: parseFloat(e.target.value) })}
                                        disabled={isLocked}
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <label htmlFor="memory-limit" className="text-xs font-medium text-slate-700 dark:text-slate-300">Memory</label>
                                        <span className="text-xs text-slate-500">
                                            {(parseInt(String(selectedNode.data.resources?.memory || '0').replace(/[^0-9]/g, '')) === 0) ? 'Unlimited' : (selectedNode.data.resources?.memory || 'Unlimited')}
                                        </span>
                                    </div>
                                    <input
                                        id="memory-limit"
                                        type="range"
                                        min="0" max="4096" step="128"
                                        className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700 accent-blue-500 dark:accent-blue-500'}`}
                                        value={parseInt(String(selectedNode.data.resources?.memory || '0').replace(/[^0-9]/g, '')) || 0}
                                        onChange={e => {
                                            const val = parseInt(e.target.value);
                                            handleChange('resources', { ...(selectedNode.data.resources || {}), memory: val === 0 ? '0' : `${val}Mi` });
                                        }}
                                        disabled={isLocked}
                                    />
                                </div>
                            </section>

                            <section>
                                <Input
                                    label="Node ID"
                                    value={selectedNode.id}
                                    disabled
                                    className="bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-gray-500"
                                />
                            </section>
                        </div>
                    )}

                    {currentTab === 'Ports' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-gray-100">Port Mappings</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">host:container</p>
                                </div>
                                <button onClick={handleAddPort} disabled={isLocked} className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 rounded-md border border-gray-200 dark:border-slate-700 flex items-center gap-1">
                                    + Add Port
                                </button>
                            </div>

                            <div className="space-y-3">
                                {(selectedNode.data.portMappings || []).map((portStr: string, idx: number) => {
                                    const [host, container] = portStr.split(':');
                                    return (
                                        <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-800">
                                            <input
                                                className="w-full bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 px-2 py-1 placeholder:text-slate-500 dark:placeholder:text-gray-500"
                                                placeholder="e.g. 8080"
                                                value={host || ''}
                                                onChange={e => handleUpdatePort(idx, `${e.target.value}:${container || ''}`)}
                                                disabled={isLocked}
                                            />
                                            <span className="text-slate-500">:</span>
                                            <input
                                                className="w-full bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 px-2 py-1 placeholder:text-slate-500 dark:placeholder:text-gray-500"
                                                placeholder="e.g. 80"
                                                value={container || ''}
                                                onChange={e => handleUpdatePort(idx, `${host || ''}:${e.target.value}`)}
                                                disabled={isLocked}
                                            />
                                            <button onClick={() => handleRemovePort(idx)} disabled={isLocked} className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-50">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {(!selectedNode.data.portMappings || selectedNode.data.portMappings.length === 0) && (
                                    <div className="p-4 border border-dashed border-gray-200 dark:border-slate-800 rounded-lg text-center text-slate-500 dark:text-gray-500 text-sm">
                                        No port mappings defined
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {currentTab === 'EnvVars' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-gray-100">Environment Variables</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">KEY=value pairs</p>
                                </div>
                                <button onClick={handleAddEnv} disabled={isLocked} className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 rounded-md border border-gray-200 dark:border-slate-700 flex items-center gap-1">
                                    + Add Var
                                </button>
                            </div>

                            <div className="space-y-3">
                                {Object.entries(selectedNode.data.envVars || {}).map(([key, val], idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-800">
                                        <input
                                            className="w-1/2 bg-transparent border-none outline-none text-sm text-orange-200 px-2 py-1 font-mono"
                                            value={key}
                                            onChange={e => handleUpdateEnvKey(key, e.target.value)}
                                            onBlur={e => handleUpdateEnvKey(key, e.target.value)}
                                            disabled={isLocked}
                                        />
                                        <div className="h-6 w-px bg-gray-200 dark:bg-slate-700"></div>
                                        <input
                                            className="w-1/2 bg-transparent border-none outline-none text-sm text-blue-200 px-2 py-1 font-mono"
                                            value={val}
                                            onChange={e => handleUpdateEnvValue(key, e.target.value)}
                                            disabled={isLocked}
                                        />
                                        <button onClick={() => handleRemoveEnv(key)} disabled={isLocked} className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {(!selectedNode.data.envVars || Object.keys(selectedNode.data.envVars).length === 0) && (
                                    <div className="p-4 border border-dashed border-gray-200 dark:border-slate-800 rounded-lg text-center text-slate-500 dark:text-gray-500 text-sm">
                                        No environment variables defined
                                    </div>
                                )}
                            </div>
                        </div>
                    )}



                    {currentTab === 'Config' && (
                        <div className="space-y-4 h-full flex flex-col">
                            {selectedNode.type === 'alertmanager' ? (
                                <AlertmanagerConfigForm
                                    config={selectedNode.data.alertmanagerConfig || { destination: 'discord' }}
                                    onChange={(newConfig) => handleChange('alertmanagerConfig', newConfig)}
                                    readOnly={isLocked}
                                />
                            ) : COMPONENT_CONFIG_SCHEMAS[selectedNode.type] ? (
                                <div className="space-y-4">
                                    {(() => {
                                        const schema = COMPONENT_CONFIG_SCHEMAS[selectedNode.type];
                                        const groups = schema.reduce((acc, field) => {
                                            const group = field.group || 'General';
                                            if (!acc[group]) acc[group] = [];
                                            acc[group].push(field);
                                            return acc;
                                        }, {} as Record<string, ConfigField[]>);

                                        const groupKeys = Object.keys(groups);
                                        const isGrouped = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== 'General');

                                        if (!isGrouped) return schema.map(field => (
                                            <ConfigFieldRenderer
                                                key={field.key}
                                                field={field}
                                                value={selectedNode.data[field.key]}
                                                onChange={handleChange}
                                                isLocked={isLocked || false}
                                                loadingVersions={loadingVersions}
                                                dynamicOptions={dynamicOptions}
                                                nodes={nodes}
                                                connections={connections}
                                                nodeId={selectedNode.id}
                                                workspaceId={workspaceId}
                                            />));

                                        return groupKeys.map(group => (
                                            <div key={group} className="border border-gray-200 dark:border-slate-800 rounded-md overflow-hidden mb-2">
                                                <button
                                                    onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
                                                >
                                                    <span>{group}</span>
                                                    {expandedGroups[group] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                                {expandedGroups[group] && (
                                                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
                                                        {groups[group].map(field => (
                                                            <ConfigFieldRenderer
                                                                key={field.key}
                                                                field={field}
                                                                value={selectedNode.data[field.key]}
                                                                onChange={handleChange}
                                                                isLocked={isLocked || false}
                                                                loadingVersions={loadingVersions}
                                                                dynamicOptions={dynamicOptions}
                                                                nodes={nodes}
                                                                connections={connections}
                                                                nodeId={selectedNode.id}
                                                                workspaceId={workspaceId}
                                                            />
                                                        ))}

                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                    <div className="p-3 bg-blue-50 dark:bg-slate-800/80 rounded-lg border border-blue-100 dark:border-slate-700 text-xs text-blue-600 dark:text-blue-400 mt-4">
                                        Configure parameters specific to {selectedNode.type}.
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 text-xs text-slate-500 dark:text-gray-500 text-center italic">
                                    No specific configuration available for {selectedNode.type}.
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

