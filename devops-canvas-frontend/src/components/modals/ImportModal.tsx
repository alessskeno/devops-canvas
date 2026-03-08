import React, { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../shared/Button';
import { CodeEditor } from '../shared/CodeEditor';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    dragActive: boolean;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onBrowseClick: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onFileChange: (file: File) => void;
    onImportText: (text: string) => Promise<void>;
}

export function ImportModal({
    isOpen,
    onClose,
    dragActive,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    onBrowseClick,
    fileInputRef,
    onFileChange,
    onImportText
}: ImportModalProps) {
    const [pasteText, setPasteText] = useState('');

    useEffect(() => {
        if (isOpen) setPasteText('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[600px] rounded-xl shadow-xl border border-gray-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white">Import Configuration</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-hidden flex flex-col space-y-4">
                    {/* Drag Drop Area */}
                    <div
                        className={`flex-1 min-h-[180px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors p-8 ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-700'}`}
                        onDragEnter={onDragEnter}
                        onDragLeave={onDragLeave}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                    >
                        <Upload size={48} className={`mb-4 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                            Drag & Drop your config here
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
                            Supports JSON and YAML formats
                        </p>
                        <Button onClick={onBrowseClick}>
                            Browse Files
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,.yaml,.yml"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) onFileChange(e.target.files[0]);
                            }}
                        />
                    </div>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-slate-900 px-2 text-gray-500 dark:text-gray-400">Or paste configuration</span>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[220px] flex flex-col overflow-hidden">
                        <CodeEditor
                            value={pasteText}
                            onChange={setPasteText}
                            language="yaml"
                            readOnly={false}
                            height={220}
                            className="flex-1 border border-gray-200 dark:border-slate-700"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={async () => {
                        if (pasteText.trim()) {
                            try {
                                await onImportText(pasteText.trim());
                                onClose();
                            } catch (e) {
                                toast.error("Invalid JSON or YAML format.");
                            }
                        }
                    }}>
                        Import Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}
