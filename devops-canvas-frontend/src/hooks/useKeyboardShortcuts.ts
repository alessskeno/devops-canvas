import { useEffect } from 'react';
import { CanvasNode, Connection } from '../types';

interface KeyboardShortcutsProps {
    nodes: CanvasNode[];
    connections: Connection[];
    selectedNodeIds: string[];
    undo: () => void;
    redo: () => void;
    past: any[];
    future: any[];
    duplicateNode: (id?: string) => void;
    removeNodes: (ids: string[]) => void;
    handleSave: () => void;
    setShowExportModal: (show: boolean) => void;
}

export function useKeyboardShortcuts({
    nodes,
    connections,
    selectedNodeIds,
    undo,
    redo,
    past,
    future,
    duplicateNode,
    removeNodes,
    handleSave,
    setShowExportModal
}: KeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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
                        if (selectedNodeIds.length > 0) {
                            const toDuplicate = selectedNodeIds.filter(id => {
                                const node = nodes.find(n => n.id === id);
                                return node && !node.locked;
                            });
                            toDuplicate.forEach(id => duplicateNode(id));
                        }
                        break;
                    case 'e':
                        e.preventDefault();
                        setShowExportModal(true);
                        break;
                }
            } else {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (selectedNodeIds.length > 0) {
                        const toRemove = selectedNodeIds.filter(id => {
                            const node = nodes.find(n => n.id === id);
                            return node && !node.locked;
                        });
                        if (toRemove.length > 0) removeNodes(toRemove);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, connections, past, future, selectedNodeIds, undo, redo, duplicateNode, removeNodes, handleSave, setShowExportModal]);
}
