import React from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Loader2, CheckCircle, Circle, AlertTriangle, XCircle } from 'lucide-react';

interface DeploymentProgressProps {
    isOpen: boolean;
    onClose: () => void;
    logs: string[];
}

export function DeploymentProgress({ isOpen, onClose, logs }: DeploymentProgressProps) {
    // Mock steps
    const steps = [
        { label: 'Validating Configuration', status: 'completed' },
        { label: 'Provisioning Kind Cluster', status: 'completed' },
        { label: 'Starting Database Services', status: 'in-progress' },
        { label: 'Configuring Network Mesh', status: 'pending' },
    ];

    const getIcon = (status: string) => {
        if (status === 'completed') return <CheckCircle size={18} className="text-green-500" />;
        if (status === 'in-progress') return <Loader2 size={18} className="text-blue-500 animate-spin" />;
        if (status === 'error') return <XCircle size={18} className="text-red-500" />;
        return <Circle size={18} className="text-gray-300" />;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Deploying Workspace..." size="lg">
            <div className="space-y-6">
                {/* Progress Bar */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Overall Progress</span>
                        <span className="text-gray-500">60%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-[60%] transition-all duration-300"></div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Steps */}
                    <div className="flex-1 space-y-3">
                        {steps.map((step, idx) => (
                            <div key={idx} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
                                {getIcon(step.status)}
                                <span className={`text-sm ${step.status === 'in-progress' ? 'font-semibold text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}>
                                    {step.label}
                                </span>
                            </div>
                        ))}
                        <div className="pt-4">
                            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">Workspace is live!</span>
                            <p className="text-[10px] text-gray-400 mt-1">All services are healthy and reachable.</p>
                        </div>
                    </div>

                    {/* Logs */}
                    <div className="flex-1">
                        <div className="bg-gray-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-gray-300">
                            <div className="text-blue-400">→ Initializing deployment pipeline...</div>
                            {logs.map((log, i) => <div key={i} className="border-l-2 border-transparent pl-1 hover:border-gray-700">{log}</div>)}
                            <div>[valid] schema_check_pass: true</div>
                            <div>[valid] resource_quota_check: ok</div>
                            <div>[kind] creating cluster "dev-cluster-1"...</div>
                            <div>[kind] node/1 joined (10.244.0.1)</div>
                            <div className="text-yellow-400">[warn] image pull delay for postgres:15.4</div>
                            <div>[db] postgres:5432 listening</div>
                            <div className="text-green-400">✓ Deployment finalized in 4.2s</div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3">
                    <Button variant="outline" onClick={onClose} className="text-red-500 hover:bg-red-50 border-red-200">Cancel Deployment</Button>
                    <Button onClick={() => window.open('https://dev-canvas.local/app', '_blank')}>Open Dashboard</Button>
                </div>
            </div>
        </Modal>
    );
}
