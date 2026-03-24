import React, { useEffect, useRef, useMemo } from 'react';
import { Settings, Copy, FileText, Lock, Unlock, Trash2, Terminal as TerminalIcon } from 'lucide-react';

const CONTEXT_MENU_WIDTH = 192; // w-48
const CONTEXT_MENU_EST_HEIGHT = 248; // ~6 items + padding; keep in sync with content
const VIEWPORT_PADDING = 8;

interface ContextMenuProps {
    x: number;
    y: number;
    nodeLocked?: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onLogs: () => void;
    onExec: () => void;
    onLock: () => void;
    onDelete: () => void;
    isRunning?: boolean;
}

export function ContextMenu({
    x, y, nodeLocked, isRunning,
    onClose, onEdit, onDuplicate, onLogs, onExec, onLock, onDelete
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    const { top, left } = useMemo(() => {
        const fitsBelow = y + CONTEXT_MENU_EST_HEIGHT + VIEWPORT_PADDING <= window.innerHeight;
        const top = fitsBelow ? y : Math.max(VIEWPORT_PADDING, y - CONTEXT_MENU_EST_HEIGHT);
        const left = Math.max(VIEWPORT_PADDING, Math.min(x, window.innerWidth - CONTEXT_MENU_WIDTH - VIEWPORT_PADDING));
        return { top, left };
    }, [x, y]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Close on escape
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const items = [
        { label: 'Edit Configuration', icon: Settings, action: onEdit, disabled: nodeLocked },
        { label: 'Duplicate', icon: Copy, action: onDuplicate, disabled: nodeLocked },
        { label: 'View Logs', icon: FileText, action: onLogs },
        { label: 'Connect to Shell', icon: TerminalIcon, action: onExec, disabled: !isRunning, className: isRunning ? 'text-blue-500' : 'text-gray-400' },
        { label: nodeLocked ? 'Unlock Node' : 'Lock Node', icon: nodeLocked ? Unlock : Lock, action: onLock },
        { label: 'Delete', icon: Trash2, action: onDelete, className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20', disabled: nodeLocked },
    ];

    return (
        <div
            ref={menuRef}
            style={{ top, left }}
            className="fixed z-50 w-48 max-h-[280px] overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in zoom-in-95 duration-100"
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => (
                <button
                    key={item.label}
                    disabled={item.disabled}
                    onClick={() => {
                        if (item.disabled) return;
                        item.action();
                        onClose();
                    }}
                    className={`
                        w-full flex items-center px-4 py-2 text-sm text-left transition-colors
                        ${item.disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }
                        ${item.className || 'text-slate-700 dark:text-slate-200'}
                    `}
                >
                    <item.icon size={14} className="mr-2.5 opacity-70" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}
