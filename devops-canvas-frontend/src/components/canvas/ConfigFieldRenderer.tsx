import React, { useState, useRef } from 'react';
import { Select } from '../shared/Select';
import { Toggle } from '../shared/Toggle';
import { Input } from '../shared/Input';
import { ConfigField } from '../../utils/componentConfigSchemas';
import { Upload, CheckCircle, AlertCircle, Loader2, FolderOpen } from 'lucide-react';
import api from '../../utils/api';

interface ConfigFieldRendererProps {
    field: ConfigField;
    value: any;
    onChange: (key: string, value: any) => void;
    isLocked: boolean;
    loadingVersions: Record<string, boolean>;
    dynamicOptions: Record<string, { label: string; value: string }[]>;
    nodes: any[];
    connections: any[];
    nodeId: string;
    workspaceId?: string;
}

export const ConfigFieldRenderer: React.FC<ConfigFieldRendererProps> = ({
    field,
    value,
    onChange,
    isLocked,
    loadingVersions,
    dynamicOptions,
    nodes,
    connections,
    nodeId,
    workspaceId
}) => {
    return (
        <div className="mb-3">
            {field.type === 'select' ? (
                <Select
                    label={field.label + (field.required ? ' *' : '')}
                    value={value || field.defaultValue || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    options={
                        field.dynamicOptions
                            ? (loadingVersions[field.key]
                                ? [{ label: 'Loading versions...', value: '' }]
                                : (dynamicOptions[field.key] || []))
                            : (field.options || [])
                    }
                    disabled={isLocked || (!!field.dynamicOptions && loadingVersions[field.key])}
                />
            ) : field.type === 'textarea' ? (
                <div>
                    <label className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-1.5">
                        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <textarea
                        className="flex w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:text-white select-text"
                        rows={4}
                        placeholder={field.placeholder}
                        value={value || ''}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        disabled={isLocked}
                    />
                    {field.helpText && (
                        <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
                    )}
                </div>
            ) : field.type === 'boolean' ? (
                <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</span>
                    <Toggle
                        checked={value !== undefined ? value : field.defaultValue}
                        onChange={(v) => onChange(field.key, v)}
                        disabled={isLocked}
                    />
                </div>
            ) : field.type === 'node-select' ? (
                <div>
                    <Select
                        label={field.label + (field.required ? ' *' : '')}
                        value={value || ''}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        options={[
                            {
                                label:
                                    field.nodeSelectScope === 'workspace'
                                        ? 'Select a node...'
                                        : 'Select a connected node...',
                                value: ''
                            },
                            ...nodes
                                .filter(n => {
                                    const isCorrectType = n.type === field.nodeType;
                                    if (field.nodeSelectScope === 'workspace') {
                                        return isCorrectType;
                                    }
                                    const isConnected = connections.some(conn =>
                                        (conn.source === nodeId && conn.target === n.id) ||
                                        (conn.target === nodeId && conn.source === n.id)
                                    );
                                    return isCorrectType && isConnected;
                                })
                                .map(n => ({ label: `${n.data.label} (${n.id.slice(0, 4)})`, value: n.id }))
                        ]}
                        disabled={isLocked}
                    />
                    {field.helpText && (
                        <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
                    )}
                </div>
            ) : (field.type as string) === 'folder-upload' ? (
                <FolderUploadField
                    field={field}
                    value={value}
                    onChange={onChange}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    workspaceId={workspaceId}
                />
            ) : (
                <div>
                    <Input
                        label={field.label + (field.required ? ' *' : '')}
                        type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.placeholder}
                        value={value !== undefined ? value : field.defaultValue || ''}
                        onChange={(e) => onChange(field.key, field.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                        disabled={isLocked}
                    />
                    {field.helpText && (
                        <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Folder Upload Sub-Component ---
interface FolderUploadFieldProps {
    field: ConfigField;
    value: any;
    onChange: (key: string, value: any) => void;
    isLocked: boolean;
    nodeId: string;
    workspaceId?: string;
}

function FolderUploadField({ field, value, onChange, isLocked, nodeId, workspaceId }: FolderUploadFieldProps) {
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadInfo, setUploadInfo] = useState<{ fileCount: number; hasDockerfile: boolean } | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const existingContextId = value;

    const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (!workspaceId) {
            setUploadState('error');
            setErrorMessage('Workspace ID not available. Please save the canvas first.');
            return;
        }

        setUploadState('uploading');
        setProgress(0);
        setErrorMessage('');

        try {
            const formData = new FormData();
            const paths: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Go's multipart parser strips directory components from filenames,
                // so we send relative paths as a separate JSON field
                formData.append('files', file);
                paths.push((file as any).webkitRelativePath || file.name);
            }
            formData.append('paths', JSON.stringify(paths));

            const response = await api.post(
                `/deploy/${workspaceId}/upload-context?component_id=${nodeId}`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent: any) => {
                        if (progressEvent.total) {
                            setProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                        }
                    }
                }
            );

            const result = response.data;
            setUploadInfo({ fileCount: result.fileCount, hasDockerfile: result.hasDockerfile });

            if (!result.hasDockerfile) {
                setUploadState('error');
                setErrorMessage('No Dockerfile found in the selected directory root.');
            } else {
                setUploadState('success');
                onChange(field.key, result.buildContextId);
            }
        } catch (err: any) {
            setUploadState('error');
            setErrorMessage(err?.response?.data?.message || err?.message || 'Upload failed');
        }
    };

    return (
        <div>
            <label className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-2">
                {field.label}
            </label>

            <input
                ref={fileInputRef}
                type="file"
                // @ts-ignore — webkitdirectory is non-standard but widely supported
                webkitdirectory=""
                // @ts-ignore
                directory=""
                multiple
                className="hidden"
                onChange={handleFolderSelect}
                disabled={isLocked}
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLocked || uploadState === 'uploading'}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all
                    ${uploadState === 'success'
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : uploadState === 'error'
                            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 dark:text-slate-400'
                    }
                    ${(isLocked || uploadState === 'uploading') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {uploadState === 'uploading' ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm font-medium">Uploading... {progress}%</span>
                    </>
                ) : uploadState === 'success' ? (
                    <>
                        <CheckCircle size={18} />
                        <span className="text-sm font-medium">{uploadInfo?.fileCount} files uploaded</span>
                    </>
                ) : uploadState === 'error' ? (
                    <>
                        <AlertCircle size={18} />
                        <span className="text-sm font-medium">Upload failed — click to retry</span>
                    </>
                ) : existingContextId ? (
                    <>
                        <FolderOpen size={18} />
                        <span className="text-sm font-medium">Context uploaded — click to re-upload</span>
                    </>
                ) : (
                    <>
                        <Upload size={18} />
                        <span className="text-sm font-medium">Select Source Directory</span>
                    </>
                )}
            </button>

            {uploadState === 'uploading' && (
                <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                    <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {uploadState === 'success' && uploadInfo && (
                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle size={12} />
                        <span>Dockerfile detected · {uploadInfo.fileCount} files ready</span>
                    </div>
                </div>
            )}

            {uploadState === 'error' && errorMessage && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
                </div>
            )}

            {field.helpText && (
                <p className="text-xs text-slate-400 mt-1.5">{field.helpText}</p>
            )}
        </div>
    );
}
