import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../shared/Button';

interface UnsavedChangesModalProps {
    isOpen: boolean;
    onStay: () => void;
    onLeave: () => void;
}

export function UnsavedChangesModal({ isOpen, onStay, onLeave }: UnsavedChangesModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-slate-800">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 shrink-0">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Unsaved Changes</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">You have unsaved changes in your workspace.</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                        Are you sure you want to leave? Your changes will be lost.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={onStay}>Stay</Button>
                        <Button variant="danger" onClick={onLeave}>Leave & Discard</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
