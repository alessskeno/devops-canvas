import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { userFacingDeployError } from '../utils/deployError';

interface DeploymentStep {
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    details?: string;
}

export function useDeployment(workspaceId: string | undefined) {
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([
        { label: 'Initializing Deployment', status: 'pending', details: '' },
        { label: 'Generating Manifests', status: 'pending', details: '' },
        { label: 'Provisioning Containers', status: 'pending', details: '' },
        { label: 'Verifying Health', status: 'pending', details: '' }
    ]);
    const [deployLogs, setDeployLogs] = useState<string[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleDeploy = async () => {
        if (!workspaceId) return;

        setShowDeployModal(true);
        setDeploymentSteps([
            { label: 'Initializing Deployment', status: 'in-progress', details: '' },
            { label: 'Generating Manifests', status: 'pending', details: '' },
            { label: 'Provisioning Containers', status: 'pending', details: '' },
            { label: 'Verifying Health', status: 'pending', details: '' }
        ]);
        setDeployLogs(['Starting deployment...']);

        // Create new controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        let interval: any = null;

        try {
            const { default: api } = await import('../utils/api');

            // Start polling for logs
            interval = setInterval(async () => {
                if (controller.signal.aborted) {
                    if (interval) clearInterval(interval);
                    return;
                }
                try {
                    const logRes = await api.get(`/deploy/${workspaceId}/logs`);
                    if (logRes.data.logs) {
                        setDeployLogs(logRes.data.logs);
                    }
                } catch (e) {
                    // ignore poll errors
                }
            }, 1000);

            // Pass signal to axios/fetch - verify deployment
            await api.post(`/deploy/${workspaceId}`, {}, {
                signal: controller.signal
            });

            // Deployment Success
            if (interval) clearInterval(interval);

        } catch (error: any) {
            if (interval) clearInterval(interval);

            if (error.name === 'CanceledError' || error.code === "ERR_CANCELED") {
                toast.error("Deployment Cancelled");
                setDeployLogs(prev => [...prev, "Deployment cancelled by user."]);
            } else {
                const raw =
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    error.message ||
                    'Deployment failed';
                const msg = userFacingDeployError(typeof raw === 'string' ? raw : String(raw));
                const technical =
                    (error as { details?: string }).details ??
                    error.response?.data?.details;
                const techStr =
                    technical != null && String(technical).trim() !== '' ? String(technical).trim() : '';

                // One concise toast; full output only in the modal Deploy log (avoids triplicating the same daemon dump).
                if (techStr) {
                    toast.error('Deployment failed', {
                        description: 'See Deploy log in this window for the full error.',
                        duration: 6000
                    });
                    setDeployLogs((prev) => [...prev, techStr]);
                } else {
                    const brief = msg.length > 120 ? `${msg.slice(0, 117)}…` : msg;
                    toast.error('Deployment failed', { description: brief, duration: 8000 });
                    setDeployLogs((prev) => [...prev, msg]);
                }
            }
        }
    };

    const handleCancelDeploy = async () => {
        // 1. Abort ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // 2. Trigger explicit teardown
        toast.loading("Cancelling deployment...", { id: "cancel-deploy" });

        try {
            const { default: api } = await import('../utils/api');
            await api.post(`/deploy/${workspaceId}/teardown`);
            toast.success("Deployment Cancelled & Cleaned up", { id: "cancel-deploy" });

            // Visual Rollback Animation
            setDeploymentSteps(prev => {
                const newSteps = [...prev];
                // Mark current error step as pending immediately to clear red state
                const errorIdx = newSteps.findIndex(s => s.status === 'error');
                if (errorIdx !== -1) {
                    newSteps[errorIdx] = { ...newSteps[errorIdx], status: 'pending', details: '' };
                }
                return newSteps;
            });

            // Animate backwards
            for (let i = deploymentSteps.length - 1; i >= 0; i--) {
                if (deploymentSteps[i].status === 'completed' || deploymentSteps[i].status === 'in-progress' || deploymentSteps[i].status === 'error') {
                    await new Promise(resolve => setTimeout(resolve, 300)); // Delay
                    setDeploymentSteps(prev => {
                        const newSteps = [...prev];
                        newSteps[i] = { ...newSteps[i], status: 'pending', details: '' };
                        return newSteps;
                    });
                }
            }

            // Close after animation
            setTimeout(() => setShowDeployModal(false), 500);

        } catch (e) {
            console.error("Teardown failed", e);
            toast.error("Cleanup failed", { id: "cancel-deploy" });
        }
    };

    return {
        showDeployModal,
        setShowDeployModal,
        deploymentSteps,
        setDeploymentSteps,
        deployLogs,
        handleDeploy,
        handleCancelDeploy
    };
}
