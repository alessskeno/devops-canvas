import React from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Loader2, CheckCircle, Circle, XCircle } from 'lucide-react';

interface DeploymentStep {
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    details?: string;
}

interface DeploymentProgressProps {
    isOpen: boolean;
    onClose: () => void;
    onCancel: () => void;
    logs: string[];
    steps: DeploymentStep[];
}

export function DeploymentProgress({ isOpen, onClose, onCancel, logs, steps }: DeploymentProgressProps) {

    const getIcon = (status: string) => {
        if (status === 'completed') return <CheckCircle size={18} className="text-green-500" />;
        if (status === 'in-progress') return <Loader2 size={18} className="text-blue-500 animate-spin" />;
        if (status === 'error') return <XCircle size={18} className="text-red-500" />;
        return <Circle size={18} className="text-gray-300" />;
    };

    // Calculate progress
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const isComplete = steps.length > 0 && steps.every(s => s.status === 'completed');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Deploying Workspace..." size="lg">
            <div className="space-y-6">
                {/* Progress Bar */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Overall Progress</span>
                        <span className="text-gray-500">{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Steps */}
                    <div className="flex-1 space-y-4">
                        {steps.map((step, idx) => (
                            <div key={idx} className={`p-2 rounded-lg ${step.status === 'error' ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                                <div className="flex items-center space-x-3">
                                    {
                                        step.status === 'completed' ? <CheckCircle size={22} className="text-green-500" /> :
                                            step.status === 'in-progress' ? <Loader2 size={22} className="text-blue-500 animate-spin" /> :
                                                step.status === 'error' ? <XCircle size={22} className="text-red-500" /> :
                                                    <Circle size={22} className="text-gray-300" />
                                    }
                                    <span className={`text-sm font-medium ${step.status === 'in-progress' ? 'text-blue-600' :
                                        step.status === 'error' ? 'text-red-700 dark:text-red-400' :
                                            'text-gray-700 dark:text-gray-300'
                                        }`}>
                                        {step.label}
                                    </span>
                                </div>
                                {step.status === 'error' && step.details && (
                                    <div className="ml-9 mt-1 text-xs text-red-600 dark:text-red-400 font-mono break-words bg-red-100 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800/50">
                                        Error: {step.details}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isComplete && (
                            <div className="pt-4 animate-in fade-in slide-in-from-bottom-2">
                                {steps[steps.length - 1]?.label === 'Workspace Stopped' ? (
                                    <>
                                        <span className="text-xs text-gray-600 font-medium bg-gray-100 dark:bg-gray-800 dark:text-gray-300 px-2 py-1 rounded">Workspace Stopped</span>
                                        <p className="text-[10px] text-gray-400 mt-1">All resources have been terminated.</p>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">Workspace is live!</span>
                                        <p className="text-[10px] text-gray-400 mt-1">All services are healthy and reachable.</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Logs */}
                    <div className="flex-1">
                        <div className="bg-gray-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-gray-300 flex flex-col-reverse">
                            <div className="flex flex-col">
                                {logs.map((log, i) => <div key={i} className="border-l-2 border-transparent pl-1 hover:border-gray-700 break-all">{log}</div>)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3">
                    {!isComplete ? (
                        <Button variant="outline" onClick={onCancel} className="text-red-500 hover:bg-red-50 border-red-200">Cancel Deployment</Button>
                    ) : (
                        <Button onClick={onClose}>Done</Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
