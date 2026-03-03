import React, { useState } from 'react';
import { Search, Database, Box, Layers, Archive, MessageSquare, BarChart2, Star, Activity, FileText, Bell, Boxes, Container, Code } from 'lucide-react';
import { HighlightedText } from '../shared/HighlightedText';
import { COMPONENT_REGISTRY } from '../../utils/componentRegistry';
import { ComponentDefinition } from '../../types';

export function ComponentLibrary() {
    const [filter, setFilter] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const categories = [
        { id: 'all', label: 'All' },
        { id: 'infrastructure', label: 'Infra' },
        { id: 'database', label: 'DB' },
        { id: 'caching', label: 'Cache' },

        { id: 'messaging', label: 'Queue' },
        { id: 'monitoring', label: 'Monitoring' },
        { id: 'custom', label: 'Custom' },
        { id: 'configuration', label: 'Config' },
    ];

    const filteredComponents = COMPONENT_REGISTRY.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(filter.toLowerCase());
        const matchesCategory = activeTab === 'all' || c.category === activeTab;
        return matchesSearch && matchesCategory;
    });

    const handleDragStart = (e: React.DragEvent, component: ComponentDefinition) => {
        e.dataTransfer.setData('application/react-dnd-component', component.type);
        e.dataTransfer.setData('application/react-dnd-config', JSON.stringify(component.defaultConfig));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search components..."
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto px-2 py-2 gap-1 scrollbar-hide border-b border-gray-100 dark:border-gray-700">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`
              px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
              ${activeTab === cat.id
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-300'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}
            `}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {filteredComponents.map((component) => (
                    <div
                        key={component.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, component)}
                        className="group relative flex items-center p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 cursor-grab active:cursor-grabbing transition-all transform hover:-translate-y-0.5"
                    >
                        {/* Icon Box */}
                        <div className={`w-10 h-10 flex items-center justify-center rounded-lg shrink-0 mr-3 ${component.color || 'bg-blue-50 text-blue-600 dark:bg-gray-700 dark:text-blue-400'}`}>
                            {component.icon === 'Database' && <Database size={20} />}
                            {component.icon === 'Container' && <Container size={20} />}
                            {component.icon === 'Box' && <Box size={20} />}
                            {component.icon === 'Boxes' && <Boxes size={20} />}
                            {component.icon === 'Layers' && <Layers size={20} />}
                            {component.icon === 'Activity' && <Activity size={20} />}
                            {component.icon === 'BarChart' && <BarChart2 size={20} />}
                            {component.icon === 'FileText' && <FileText size={20} />}
                            {component.icon === 'Bell' && <Bell size={20} />}
                            {component.icon === 'Code' && <Code size={20} />}
                        </div>

                        {/* Text Content */}
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                                <HighlightedText text={component.name} highlight={filter} />
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {component.description}
                            </span>
                        </div>

                        {/* Star Action */}
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Star size={14} className="text-gray-300 hover:text-yellow-400 cursor-pointer" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
