import React from 'react';
import { cn } from '../../utils/cn';

interface RoleBadgeProps {
    role: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
    const getRoleColor = (r: string) => {
        switch (r) {
            case 'Owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'Admin': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Editor': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Viewer': return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400';
        }
    };

    return (
        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", getRoleColor(role))}>
            {role}
        </span>
    );
};
