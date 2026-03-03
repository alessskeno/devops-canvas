import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import yaml from 'js-yaml';
import { CanvasNode, Connection } from '../types';

interface UseCanvasImportProps {
    workspaceId?: string;
    loadCanvas: (nodes: CanvasNode[], connections: Connection[]) => void;
    saveCanvas: (id: string) => Promise<void>;
    setShowImportModal?: (show: boolean) => void;
}

export function useCanvasImport({ workspaceId, loadCanvas, saveCanvas, setShowImportModal }: UseCanvasImportProps) {
    // Local state if not provided (fallback)
    const [localShowImportModal, setLocalShowImportModal] = useState(false);

    // Use provided setter or local one
    const toggleModal = setShowImportModal || setLocalShowImportModal;
    const isModalOpen = setShowImportModal ? undefined : localShowImportModal; // If controlled, we don't track open state locally here usually, but we need to know if we should return it?
    // Actually, NodeEditor controls the modal visibility now. 
    // This hook just needs to know how to close it on success.

    const [dragActive, setDragActive] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const processImportData = async (data: any) => {
        if (!data || !data.nodes) {
            toast.error('Invalid configuration: Missing "nodes" array');
            return;
        }

        // 1. Create ID Mapping (Old ID -> New UUID)
        const idMap = new Map<string, string>();

        // 2. Process Nodes: Regenerate IDs and Sanitize
        const importedNodes = data.nodes.map((n: any) => {
            const newId = crypto.randomUUID();
            idMap.set(n.id, newId);

            return {
                ...n,
                id: newId,
                workspace_id: workspaceId || n.workspace_id,
                selected: false,
                position: n.position || { x: n.position_x || 0, y: n.position_y || 0 }
            };
        });

        // 3. Process Connections: Remap Source/Target and Sanitize
        const importedConnections = (data.connections || []).reduce((acc: any[], c: any) => {
            const newSource = idMap.get(c.source);
            const newTarget = idMap.get(c.target);

            // Only keep connection if both endpoints exist in the imported set
            if (newSource && newTarget) {
                acc.push({
                    ...c,
                    id: crypto.randomUUID(),
                    workspace_id: workspaceId || c.workspace_id,
                    source: newSource,
                    target: newTarget
                });
            }
            return acc;
        }, []);

        // 4. Load & Save
        loadCanvas(importedNodes, importedConnections);
        toggleModal(false);

        if (workspaceId) {
            try {
                await saveCanvas(workspaceId);
                toast.success('Configuration imported and saved as new copy');
            } catch (saveError) {
                console.error('Import save failed:', saveError);
                toast.error('Imported locally but failed to save to backend');
            }
        } else {
            toast.success('Configuration imported (unsaved)');
        }
    };

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                await importFromText(content);
            } catch (err) {
                toast.error('Failed to read file');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    const importFromText = async (content: string) => {
        try {
            let data: any;
            try {
                data = JSON.parse(content);
            } catch (jsonErr) {
                try {
                    data = yaml.load(content);
                } catch (yamlErr) {
                    throw new Error('Invalid format: Must be JSON or YAML');
                }
            }
            await processImportData(data);
        } catch (err) {
            toast.error('Failed to parse configuration');
            console.error(err);
            throw err;
        }
    };

    return {
        showImportModal: isModalOpen, // This might be undefined if controlled, which is fine
        setShowImportModal: toggleModal,
        dragActive,
        importInputRef,
        handleDrag,
        handleDrop,
        handleFile,
        importFromText
    };
}
