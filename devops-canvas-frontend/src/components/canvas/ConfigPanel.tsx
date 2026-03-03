import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCanvasStore } from '../../store/canvasStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Select } from '../shared/Select';
import { Toggle } from '../shared/Toggle';
import { X, Trash2, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { COMPONENT_REGISTRY } from '../../utils/componentRegistry';
import { COMPONENT_CONFIG_SCHEMAS, ConfigField } from '../../utils/componentConfigSchemas';
import { KindClusterConfigForm } from './KindClusterConfigForm';
import { AlertmanagerConfigForm } from './AlertmanagerConfigForm';
import { LogViewer } from './LogViewer';
import { ConfigFieldRenderer } from './ConfigFieldRenderer';
import api from '../../utils/api';

export function ConfigPanel() {
    const { id: workspaceId } = useParams<{ id: string }>();
    const {
        selectedNodeId, nodes, connections, updateNodeData, removeNode, selectNode,
        activePanelTab, setActivePanelTab
    } = useCanvasStore();

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, { label: string; value: string }[]>>({});
    const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});

    // Default to 'General' if undefined
    const currentTab = activePanelTab || 'General';

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

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


    return (
        <div className="w-80 h-full flex flex-col bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div>
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{selectedNode.data.label}</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{selectedNode.type} NODE</p>
                </div>
                <button onClick={() => selectNode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X size={18} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {['General', 'Config', 'Logs'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActivePanelTab(tab)}
                        className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors
                            ${currentTab === tab
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {currentTab === 'General' && (
                    <div className="space-y-6">
                        <section>
                            <Input
                                label="Display Name"
                                value={selectedNode.data.label}
                                onChange={e => handleChange('label', e.target.value)}
                                disabled={isLocked}
                            />
                        </section>

                        <section className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enabled</span>
                            <Toggle
                                checked={selectedNode.data.enabled !== false}
                                onChange={v => handleChange('enabled', v)}
                                disabled={isLocked}
                            />
                        </section>

                        <section>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">RESOURCES</h3>

                            <div className="mb-4">
                                <div className="flex justify-between mb-1.5">
                                    <label htmlFor="cpu-limit" className="text-xs font-medium text-slate-700 dark:text-slate-300">CPU Limit</label>
                                    <span className="text-xs text-slate-500">
                                        {(selectedNode.data.resources?.cpu === 0 || selectedNode.data.resources?.cpu === undefined) ? 'Unlimited' : `${selectedNode.data.resources?.cpu} Cores`}
                                    </span>
                                </div>
                                <input
                                    id="cpu-limit"
                                    type="range"
                                    min="0" max="4" step="0.1"
                                    className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700 accent-blue-500'}`}
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
                                    className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700 accent-blue-500'}`}
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
                                className="bg-slate-100 dark:bg-slate-800 text-slate-500"
                            />
                        </section>
                    </div>
                )}

                {currentTab === 'Config' && (
                    <div className="space-y-4 h-full flex flex-col">
                        {selectedNode.type === 'kind-cluster' ? (
                            <KindClusterConfigForm
                                config={selectedNode.data.kindConfig || {
                                    name: 'kind',
                                    version: 'kindest/node:v1.27.3',
                                    topology: { controlPlanes: 1, workers: 0 },
                                    networking: { enableIngress: false },
                                    mounts: []
                                }}
                                onChange={(newConfig) => handleChange('kindConfig', newConfig)}
                                readOnly={isLocked}
                                nodes={nodes}
                                connections={connections}
                                nodeId={selectedNode.id}
                            />
                        ) : selectedNode.type === 'alertmanager' ? (
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
                                        <div key={group} className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden mb-2">
                                            <button
                                                onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <span>{group}</span>
                                                {expandedGroups[group] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                            {expandedGroups[group] && (
                                                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
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
                                                    {group === 'Alertmanager' && selectedNode.type === 'monitoring_stack' && (
                                                        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                                            <div className="text-xs font-semibold text-slate-500 uppercase mb-3 px-1">Detailed Config</div>
                                                            <AlertmanagerConfigForm
                                                                config={selectedNode.data.alertmanagerConfig || { destination: 'discord' }}
                                                                onChange={(newConfig) => handleChange('alertmanagerConfig', newConfig)}
                                                                readOnly={isLocked}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ));
                                })()}
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-600 dark:text-blue-400 mt-4">
                                    Configure parameters specific to {selectedNode.type}.
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 text-center italic">
                                No specific configuration available for {selectedNode.type}.
                            </div>
                        )}
                    </div>
                )}

                {currentTab === 'Logs' && (
                    <LogViewer workspaceId={workspaceId || selectedNode.id} componentId={selectedNode.id} />
                )}
            </div>
        </div>
    );
}


