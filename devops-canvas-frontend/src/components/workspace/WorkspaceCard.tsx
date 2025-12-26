import React from 'react';
import { Workspace } from '../../types';
import { MoreVertical, Layers, Server, Activity, ArrowRight, ExternalLink, Share2, Copy, Trash2, Download } from 'lucide-react';
import { HighlightedText } from '../shared/HighlightedText';

interface WorkspaceCardProps {
    workspace: Workspace;
    onClick: () => void;
    onDelete: () => void;
    highlight?: string;
}

export function WorkspaceCard({ workspace, onClick, onDelete, highlight = '' }: WorkspaceCardProps) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    const handleAction = (e: React.MouseEvent, action: string) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        switch (action) {
            case 'open':
                onClick();
                break;
            case 'delete':
                if (window.confirm('Are you sure you want to delete this workspace?')) {
                    onDelete();
                }
                break;
            case 'share':
            case 'duplicate':
            case 'export':
                alert(`${action.charAt(0).toUpperCase() + action.slice(1)} feature coming soon!`);
                break;
        }
    };

    return (
        <div
            onClick={onClick}
            className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 p-5 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all duration-300 cursor-pointer overflow-visible"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2 mb-2">
                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${workspace.environment === 'development' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}
                    `}>
                        {workspace.environment === 'development' ? 'Running' : 'Stopped'}
                    </span>

                    {/* Environment Badge */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${workspace.environment === 'development' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : ''}
            ${workspace.environment === 'staging' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : ''}
            ${workspace.environment === 'production' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : ''}
          `}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${workspace.environment === 'development' ? 'bg-blue-500' :
                            workspace.environment === 'staging' ? 'bg-purple-500' : 'bg-green-500'
                            }`}></span>
                        {workspace.environment === 'development' ? 'Dev' :
                            workspace.environment === 'staging' ? 'Staging' : 'Prod'}
                    </span>
                </div>

                <div className="relative" ref={menuRef}>
                    <button
                        onClick={handleMenuClick}
                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-400 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <MoreVertical size={16} />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <button onClick={(e) => handleAction(e, 'open')} className="flex items-center w-full px-4 py-2 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                                <ExternalLink size={14} className="mr-3 text-slate-500" />
                                Open
                            </button>
                            <button onClick={(e) => handleAction(e, 'share')} className="flex items-center w-full px-4 py-2 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                                <Share2 size={14} className="mr-3 text-slate-500" />
                                Share
                            </button>
                            <button onClick={(e) => handleAction(e, 'duplicate')} className="flex items-center w-full px-4 py-2 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                                <Copy size={14} className="mr-3 text-slate-500" />
                                Duplicate
                            </button>
                            <button onClick={(e) => handleAction(e, 'export')} className="flex items-center w-full px-4 py-2 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                                <Download size={14} className="mr-3 text-slate-500" />
                                Export
                            </button>
                            <div className="my-1 border-t border-slate-200 dark:border-slate-800"></div>
                            <button onClick={(e) => handleAction(e, 'delete')} className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10">
                                <Trash2 size={14} className="mr-3" />
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <HighlightedText text={workspace.name} highlight={highlight} />
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-500 mb-6 h-10 overflow-hidden text-ellipsis line-clamp-2">
                {workspace.description || 'No description provided.'}
            </p>

            <div className="flex items-center mb-4 pl-2">
                {/* Mock icons representing stack - Overlapping (Static) */}
                <div className="flex items-center -space-x-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-500 relative z-0">
                        <Layers size={16} className="text-blue-500" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-500 relative z-10">
                        <Server size={16} className="text-purple-500" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-500 relative z-20">
                        <Activity size={16} className="text-orange-500" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-500 relative z-30">
                        +{workspace.componentCount}
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate max-w-[150px]">
                    {workspace.last_updated_by_name ? `Updated by ${workspace.last_updated_by_name}` : 'Just created'}
                </span>
                <span className="flex items-center">
                    {new Date(workspace.lastModified || new Date()).toLocaleDateString()}
                </span>
            </div>
        </div>
    );
}
