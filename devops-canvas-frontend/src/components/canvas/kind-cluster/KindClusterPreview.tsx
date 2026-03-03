import React from 'react';
import { KindClusterConfig } from '../../../types';
import { Button } from '../../shared/Button';
import { Copy } from 'lucide-react';
import { generateKindConfig } from '../../../utils/kindConfig';
import { KindSectionHeader } from './KindSectionHeader';

interface Props {
    config: KindClusterConfig;
    isExpanded: boolean;
    onToggle: (section: string) => void;
    getAttachedFileContent: () => string | undefined;
}

export function KindClusterPreview({ config, isExpanded, onToggle, getAttachedFileContent }: Props) {
    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <KindSectionHeader title="Preview (YAML)" sectionKey="Preview" isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded && (
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 flex flex-col h-64">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            Generated configuration (kind-config.yaml)
                        </span>
                        <Button
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(generateKindConfig(config, getAttachedFileContent()))}
                        >
                            <Copy size={14} className="mr-1" /> Copy
                        </Button>
                    </div>
                    <pre className="flex-1 p-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-950 text-slate-50 font-mono text-[10px] overflow-auto whitespace-pre h-full">
                        {generateKindConfig(config, getAttachedFileContent())}
                    </pre>
                </div>
            )}
        </div>
    );
}
