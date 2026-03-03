import { useEffect } from 'react';
import { CanvasNode, Connection } from '../types';

interface KeyboardShortcutsProps {
    nodes: CanvasNode[];
    connections: Connection[];
    selectedNodeId: string | null;
    undo: () => void;
    redo: () => void;
    past: any[]; // History states
    future: any[];
    duplicateNode: (id: string) => void;
    removeNode: (id: string) => void;
    handleSave: () => void;
    setShowExportModal: (show: boolean) => void;
}

export function useKeyboardShortcuts({
    nodes,
    connections,
    selectedNodeId,
    undo,
    redo,
    past,
    future,
    duplicateNode,
    removeNode,
    handleSave,
    setShowExportModal
}: KeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input focused
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if (e.metaKey || e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) redo(); else undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        redo();
                        break;
                    case 's':
                        e.preventDefault();
                        handleSave();
                        break;
                    case 'd':
                        e.preventDefault();
                        if (selectedNodeId) {
                            const node = nodes.find(n => n.id === selectedNodeId);
                            if (node && !node.locked) duplicateNode(selectedNodeId);
                        }
                        break;
                    case 'e':
                        e.preventDefault();
                        setShowExportModal(true);
                        break;
                }
            } else {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (selectedNodeId) {
                        const node = nodes.find(n => n.id === selectedNodeId);
                        if (node && !node.locked) removeNode(selectedNodeId);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, connections, past, future, selectedNodeId, undo, redo, duplicateNode, removeNode, handleSave, setShowExportModal]);
}
