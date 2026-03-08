import React from 'react';
import Editor from '@monaco-editor/react';

export type CodeEditorLanguage = 'yaml' | 'json' | 'shell' | 'plaintext' | 'ini';

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language?: CodeEditorLanguage;
    readOnly?: boolean;
    height?: string | number;
    className?: string;
}

const DEFAULT_HEIGHT = '280px';

export function CodeEditor({
    value,
    onChange,
    language = 'plaintext',
    readOnly = false,
    height = DEFAULT_HEIGHT,
    className = '',
}: CodeEditorProps) {
    const editorHeight = typeof height === 'number' ? `${height}px` : height;

    const handleMount = (
        editor: import('monaco-editor').editor.IStandaloneCodeEditor,
        monaco: typeof import('monaco-editor')
    ) => {
        const model = editor.getModel();
        if (model && language && language !== 'plaintext') {
            monaco.editor.setModelLanguage(model, language);
        }
        requestAnimationFrame(() => editor.layout());
        setTimeout(() => editor.layout(), 150);
    };

    return (
        <div className={`rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 ${className}`}>
            <Editor
                height={editorHeight}
                defaultLanguage={language}
                language={language}
                value={value}
                onChange={onChange !== undefined ? (v) => onChange(v ?? '') : undefined}
                theme="vs-dark"
                loading={null}
                onMount={handleMount}
                options={{
                    readOnly: readOnly ?? false,
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        useShadows: false,
                    },
                    automaticLayout: true,
                }}
            />
        </div>
    );
}
