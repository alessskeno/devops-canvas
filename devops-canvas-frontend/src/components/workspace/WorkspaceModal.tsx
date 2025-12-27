import React, { useEffect, useState } from 'react';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Modal } from '../shared/Modal';
import { Select } from '../shared/Select';
import { Workspace } from '../../types';

interface WorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Partial<Workspace>;
    mode: 'create' | 'edit';
}

export function WorkspaceModal({ isOpen, onClose, onSubmit, initialData, mode }: WorkspaceModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [environment, setEnvironment] = useState('development');
    const [visibility, setVisibility] = useState('private');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || '');
            setDescription(initialData.description || '');
            setEnvironment(initialData.environment || 'development');
            setVisibility(initialData.visibility || 'private');
        } else if (isOpen) {
            // Reset for create mode
            setName('');
            setDescription('');
            setEnvironment('development');
            setVisibility('private');
        }
    }, [isOpen, initialData]);

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            await onSubmit({
                name,
                description,
                environment,
                visibility
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? "Create New Workspace" : "Edit Workspace"}
        >
            <div className="space-y-4">
                <Input
                    label="Workspace Name"
                    placeholder="e.g. Production Cluster"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />

                <div>
                    <label className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-1.5">
                        Description
                    </label>
                    <textarea
                        className="flex w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                        rows={3}
                        placeholder="What is this infrastructure for?"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Environment"
                        options={[
                            { value: 'development', label: 'Development' },
                            { value: 'staging', label: 'Staging' },
                            { value: 'production', label: 'Production' },
                        ]}
                        value={environment}
                        onChange={e => setEnvironment(e.target.value)}
                    />
                    <Select
                        label="Visibility"
                        options={[
                            { value: 'private', label: 'Private' },
                            { value: 'team', label: 'Team Shared' },
                            { value: 'public', label: 'Public' },
                        ]}
                        value={visibility}
                        onChange={e => setVisibility(e.target.value)}
                    />
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!name} isLoading={isLoading}>
                        {mode === 'create' ? "Create Workspace" : "Save Changes"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
