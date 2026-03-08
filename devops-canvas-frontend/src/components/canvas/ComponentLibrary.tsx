import React, { useState, useMemo } from 'react';
import {
    Search, Database, Layers, Archive, Activity, ChevronDown,
    Shield, Globe, FileText, Code, Gauge, Star,
    Search as SearchIcon
} from 'lucide-react';
import { COMPONENT_REGISTRY } from '../../utils/componentRegistry';
import { getComponentIcon } from '../../utils/componentIcons';
import { ComponentDefinition, ComponentConfig } from '../../types';

// ─── Category definitions with display order ──────────────────────────
const CATEGORY_SECTIONS: {
    id: ComponentConfig['componentType'];
    label: string;
    icon: React.ElementType;
}[] = [
        { id: 'databases', label: 'DATABASES', icon: Database },
        { id: 'cache', label: 'CACHE', icon: Layers },
        { id: 'storage', label: 'STORAGE', icon: Archive },
        { id: 'proxy-gateway', label: 'PROXY & GATEWAY', icon: Globe },
        { id: 'auth-security', label: 'AUTH & SECURITY', icon: Shield },
        { id: 'messaging', label: 'MESSAGING', icon: Activity },
        { id: 'search', label: 'SEARCH', icon: SearchIcon },
        { id: 'monitoring', label: 'MONITORING', icon: Gauge },
        { id: 'custom', label: 'CUSTOM', icon: Code },
        { id: 'config', label: 'CONFIG', icon: FileText },
    ];

export function ComponentLibrary() {
    const [filter, setFilter] = useState('');
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const toggleSection = (id: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Group components by category, applying search filter
    const groupedComponents = useMemo(() => {
        const groups: Record<string, ComponentDefinition[]> = {};
        for (const cat of CATEGORY_SECTIONS) {
            groups[cat.id] = [];
        }
        for (const c of COMPONENT_REGISTRY) {
            if (filter && !c.name.toLowerCase().includes(filter.toLowerCase())) continue;
            if (groups[c.category]) {
                groups[c.category].push(c);
            }
        }
        return groups;
    }, [filter]);

    const handleDragStart = (e: React.DragEvent, component: ComponentDefinition) => {
        e.dataTransfer.setData('application/react-dnd-component', component.type);
        e.dataTransfer.setData('application/react-dnd-config', JSON.stringify(component.defaultConfig));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col h-full select-none">
            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search components..."
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white select-text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Collapsible Category Sections */}
            <div className="flex-1 overflow-y-auto">
                {CATEGORY_SECTIONS.map((cat) => {
                    const components = groupedComponents[cat.id] || [];
                    // Hide empty categories when searching
                    if (filter && components.length === 0) return null;

                    const isCollapsed = collapsedSections.has(cat.id);
                    const CatIcon = cat.icon;

                    return (
                        <div key={cat.id}>
                            {/* Category Header */}
                            <button
                                onClick={() => toggleSection(cat.id)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <CatIcon size={14} className="shrink-0 opacity-70" />
                                <span className="flex-1 text-left">{cat.label}</span>
                                <ChevronDown
                                    size={14}
                                    className={`shrink-0 opacity-50 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                                />
                            </button>

                            {/* Component List */}
                            <div
                                className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
                                    }`}
                            >
                                <div className="px-3 pb-2 space-y-1.5">
                                    {components.map((component) => {
                                        const CompIcon = getComponentIcon(component.type);
                                        return (
                                            <div
                                                key={component.type}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, component)}
                                                className="group relative flex items-center p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 cursor-grab active:cursor-grabbing transition-all transform hover:-translate-y-0.5"
                                            >
                                                {/* Icon Box */}
                                                <div className={`w-10 h-10 flex items-center justify-center rounded-lg shrink-0 mr-3 [&_svg]:w-5 [&_svg]:h-5 ${component.color || 'bg-blue-50 text-blue-600 dark:bg-gray-700 dark:text-blue-400'}`}>
                                                    <CompIcon size={20} />
                                                </div>

                                                {/* Text Content */}
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                                                        {component.name}
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
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
