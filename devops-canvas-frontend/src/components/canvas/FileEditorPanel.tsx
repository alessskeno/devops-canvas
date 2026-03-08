import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { CodeEditor, type CodeEditorLanguage } from '../shared/CodeEditor';
import { Input } from '../shared/Input';
import type { CanvasNode } from '../../types';

function languageFromFilename(filename: string): CodeEditorLanguage {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.sh')) return 'shell';
    if (lower.endsWith('.conf') || lower.endsWith('.ini')) return 'ini';
    return 'plaintext';
}

interface FileEditorPanelProps {
    node: CanvasNode;
    onClose: () => void;
}

const PANEL_ANIMATION_MS = 250;

export function FileEditorPanel({ node, onClose }: FileEditorPanelProps) {
    const updateNodeData = useCanvasStore((s) => s.updateNodeData);
    const [editorReady, setEditorReady] = useState(false);

    const language = useMemo(
        () => languageFromFilename(node.data?.label ?? ''),
        [node.data?.label]
    );

    const handleLabelChange = (value: string) => {
        updateNodeData(node.id, { ...node.data, label: value });
    };

    const handleContentChange = (value: string) => {
        updateNodeData(node.id, { ...node.data, content: value });
    };

    const label = (node.data?.label as string) ?? 'config.yaml';
    const content = (node.data?.content as string) ?? '';

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '45vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: PANEL_ANIMATION_MS / 1000, ease: 'easeInOut' }}
            onAnimationComplete={() => setEditorReady(true)}
            className="file-editor-panel absolute bottom-0 left-0 right-0 z-20 flex flex-col border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shrink-0">
                    <div className="flex-1 min-w-0">
                        <Input
                            label=""
                            value={label}
                            onChange={(e) => handleLabelChange(e.target.value)}
                            placeholder="config.yaml"
                            className="text-sm font-mono"
                        />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 capitalize">
                        {language}
                    </span>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                        aria-label="Close editor"
                    >
                        <X size={18} />
                    </button>
                </div>
                {/* Editor - mount after panel animation so Monaco gets correct size and tokenizes YAML from the start */}
                <div className="flex-1 min-h-0 p-2">
                    {editorReady && (
                        <CodeEditor
                            value={content}
                            onChange={handleContentChange}
                            language={language}
                            readOnly={false}
                            height="100%"
                            className="h-full"
                        />
                    )}
                </div>
        </motion.div>
    );
}
