import React from 'react';
import { Button } from '../../shared/Button';
import { Input } from '../../shared/Input';
import { Plus, Trash2 } from 'lucide-react';
import { KindSectionHeader } from './KindSectionHeader';

interface Mount {
    id: string;
    hostPath: string;
    containerPath: string;
}

interface Props {
    localMounts: Mount[];
    updateMounts: (mounts: Mount[]) => void;
    readOnly?: boolean;
    isExpanded: boolean;
    onToggle: (section: string) => void;
}

export function KindClusterStorage({ localMounts, updateMounts, readOnly, isExpanded, onToggle }: Props) {
    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <KindSectionHeader title="Storage" sectionKey="Storage" isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded && (
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase">Extra Mounts</span>
                        <Button
                            size="sm"
                            onClick={() => updateMounts([...localMounts, { id: crypto.randomUUID(), hostPath: '', containerPath: '' }])}
                            disabled={readOnly}
                        >
                            <Plus size={14} className="mr-1" /> Add
                        </Button>
                    </div>

                    {localMounts.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded border border-dashed border-slate-200 dark:border-slate-700">
                            No extra mounts configured.
                        </div>
                    )}

                    {localMounts.map((mount, idx) => (
                        <div key={mount.id} className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-2 relative group">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => {
                                        const newMounts = localMounts.filter(m => m.id !== mount.id);
                                        updateMounts(newMounts);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                    disabled={readOnly}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <Input
                                label="Host Path"
                                placeholder="/home/user/project"
                                value={mount.hostPath}
                                onChange={(e) => {
                                    const newMounts = [...localMounts];
                                    newMounts[idx] = { ...newMounts[idx], hostPath: e.target.value };
                                    updateMounts(newMounts);
                                }}
                                disabled={readOnly}
                            />
                            <Input
                                label="Container Path"
                                placeholder="/app/data"
                                value={mount.containerPath}
                                onChange={(e) => {
                                    const newMounts = [...localMounts];
                                    newMounts[idx] = { ...newMounts[idx], containerPath: e.target.value };
                                    updateMounts(newMounts);
                                }}
                                disabled={readOnly}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
