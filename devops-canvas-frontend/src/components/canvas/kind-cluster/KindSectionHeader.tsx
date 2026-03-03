import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
    title: string;
    sectionKey: string;
    isExpanded: boolean;
    onToggle: (section: string) => void;
}

export function KindSectionHeader({ title, sectionKey, isExpanded, onToggle }: Props) {
    return (
        <button
            onClick={() => onToggle(sectionKey)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {title}
            </span>
            {isExpanded ? (
                <ChevronDown size={14} className="text-slate-400" />
            ) : (
                <ChevronRight size={14} className="text-slate-400" />
            )}
        </button>
    );
}
