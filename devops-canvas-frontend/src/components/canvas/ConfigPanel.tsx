import React, { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Select } from '../shared/Select';
import { Toggle } from '../shared/Toggle';
import { X, Trash2, Copy } from 'lucide-react';
import { COMPONENT_REGISTRY } from '../../utils/componentRegistry';
import { COMPONENT_CONFIG_SCHEMAS, ConfigField } from '../../utils/componentConfigSchemas';
import { KindClusterConfigForm } from './KindClusterConfigForm';

export function ConfigPanel() {
    const {
        selectedNodeId, nodes, connections, updateNodeData, removeNode, selectNode,
        activePanelTab, setActivePanelTab
    } = useCanvasStore();

    // Default to 'General' if undefined
    const currentTab = activePanelTab || 'General';

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    if (!selectedNode) return null;

    const isLocked = selectedNode.locked;

    const componentDef = COMPONENT_REGISTRY.find(c => c.type === selectedNode.type);

    const handleChange = (key: string, value: any) => {
        updateNodeData(selectedNode.id, { [key]: value });
    };

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
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">CPU Limit</label>
                                    <span className="text-xs text-slate-500">{selectedNode.data.resources?.cpu || 0.5} Cores</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1" max="4" step="0.1"
                                    className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700 accent-blue-500'}`}
                                    value={selectedNode.data.resources?.cpu || 0.5}
                                    onChange={e => handleChange('resources', { ...selectedNode.data.resources, cpu: parseFloat(e.target.value) })}
                                    disabled={isLocked}
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Memory</label>
                                    <span className="text-xs text-slate-500">{selectedNode.data.resources?.memory || '512Mi'}</span>
                                </div>
                                <input
                                    type="range"
                                    min="128" max="4096" step="128"
                                    className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700 accent-blue-500'}`}
                                    // Simplification for the range input; keeping logic simple for prototype
                                    value={parseInt(String(selectedNode.data.resources?.memory || '512').replace(/[^0-9]/g, '')) || 512}
                                    onChange={e => handleChange('resources', { ...selectedNode.data.resources, memory: `${e.target.value}Mi` })}
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
                        ) : COMPONENT_CONFIG_SCHEMAS[selectedNode.type] ? (
                            <div className="space-y-4">
                                {COMPONENT_CONFIG_SCHEMAS[selectedNode.type].map((field: ConfigField) => (
                                    <div key={field.key}>
                                        {field.type === 'select' ? (
                                            <Select
                                                label={field.label}
                                                value={selectedNode.data[field.key] || field.defaultValue || ''}
                                                onChange={(e) => handleChange(field.key, e.target.value)}
                                                options={field.options || []}
                                                disabled={isLocked}
                                            />
                                        ) : field.type === 'textarea' ? (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-1.5">
                                                    {field.label}
                                                </label>
                                                <textarea
                                                    className="flex w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                                                    rows={4}
                                                    placeholder={field.placeholder}
                                                    value={selectedNode.data[field.key] || ''}
                                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                                    disabled={isLocked}
                                                />
                                            </div>
                                        ) : field.type === 'boolean' ? (
                                            <div className="flex items-center justify-between py-1">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</span>
                                                <Toggle
                                                    checked={selectedNode.data[field.key] !== undefined ? selectedNode.data[field.key] : field.defaultValue}
                                                    onChange={(v) => handleChange(field.key, v)}
                                                    disabled={isLocked}
                                                />
                                            </div>
                                        ) : field.type === 'node-select' ? (
                                            <Select
                                                label={field.label}
                                                value={selectedNode.data[field.key] || ''}
                                                onChange={(e) => handleChange(field.key, e.target.value)}
                                                options={[
                                                    { label: 'Select a connected node...', value: '' },
                                                    ...nodes
                                                        .filter(n => {
                                                            const isCorrectType = n.type === field.nodeType;
                                                            const isConnected = connections.some(conn =>
                                                                (conn.source === selectedNode.id && conn.target === n.id) ||
                                                                (conn.target === selectedNode.id && conn.source === n.id)
                                                            );
                                                            return isCorrectType && isConnected;
                                                        })
                                                        .map(n => ({ label: `${n.data.label} (${n.id.slice(0, 4)})`, value: n.id }))
                                                ]}
                                                disabled={isLocked}
                                            />
                                        ) : (
                                            <Input
                                                label={field.label}
                                                type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                                                placeholder={field.placeholder}
                                                value={selectedNode.data[field.key] !== undefined ? selectedNode.data[field.key] : field.defaultValue || ''}
                                                onChange={(e) => handleChange(field.key, field.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                                disabled={isLocked}
                                            />
                                        )}
                                    </div>
                                ))}
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
                    <div className="bg-slate-950 text-slate-300 p-3 rounded-md font-mono text-[10px] leading-relaxed h-full overflow-y-auto">
                        <div className="text-green-400">{'>'} Container starting...</div>
                        <div className="text-slate-500">{'>'} [System] Allocated {selectedNode.data.resources?.cpu || 0.5} vCPU</div>
                        <div>{'>'} Mounting volume /data...</div>
                        <div>{'>'} Service listening on port {selectedNode.data.port || 8080}</div>
                        <div className="animate-pulse">{'_'}</div>
                    </div>
                )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => selectNode(null)} disabled={isLocked}>
                    {isLocked ? 'Locked (Read Only)' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}
