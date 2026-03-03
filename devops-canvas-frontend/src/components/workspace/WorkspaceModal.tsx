import React, { useEffect, useReducer } from 'react';
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

interface WorkspaceState {
    name: string;
    description: string;
    environment: string;
    visibility: string;
    isLoading: boolean;
}

type WorkspaceAction =
    | { type: 'SET_FIELD'; field: keyof WorkspaceState; value: any }
    | { type: 'RESET'; data?: Partial<Workspace> }
    | { type: 'SET_LOADING'; value: boolean };

const initialState: WorkspaceState = {
    name: '',
    description: '',
    environment: 'development',
    visibility: 'private',
    isLoading: false
};

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'RESET':
            return {
                ...initialState,
                name: action.data?.name || '',
                description: action.data?.description || '',
                environment: action.data?.environment || 'development',
                visibility: action.data?.visibility || 'private'
            };
        case 'SET_LOADING':
            return { ...state, isLoading: action.value };
        default:
            return state;
    }
}

function getInitialState(initialData?: Partial<Workspace>): WorkspaceState {
    return {
        name: initialData?.name || '',
        description: initialData?.description || '',
        environment: initialData?.environment || 'development',
        visibility: initialData?.visibility || 'private',
        isLoading: false
    };
}

export function WorkspaceModal({ isOpen, onClose, onSubmit, initialData, mode }: WorkspaceModalProps) {
    const [state, dispatch] = useReducer(workspaceReducer, initialData, getInitialState);

    const handleSubmit = async () => {
        dispatch({ type: 'SET_LOADING', value: true });
        try {
            await onSubmit({
                name: state.name,
                description: state.description,
                environment: state.environment,
                visibility: state.visibility
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            dispatch({ type: 'SET_LOADING', value: false });
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
                    value={state.name}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value })}
                />

                <div>
                    <label htmlFor="workspace-description" className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-1.5">
                        Description
                    </label>
                    <textarea
                        id="workspace-description"
                        className="flex w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                        rows={3}
                        placeholder="What is this infrastructure for?"
                        value={state.description}
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })}
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
                        value={state.environment}
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'environment', value: e.target.value })}
                    />
                    <Select
                        label="Visibility"
                        options={[
                            { value: 'private', label: 'Private' },
                            { value: 'team', label: 'Team Shared' },
                            { value: 'public', label: 'Public' },
                        ]}
                        value={state.visibility}
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'visibility', value: e.target.value })}
                    />
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!state.name} isLoading={state.isLoading}>
                        {mode === 'create' ? "Create Workspace" : "Save Changes"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
