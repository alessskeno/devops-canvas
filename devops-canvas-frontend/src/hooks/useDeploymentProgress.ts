import { useEffect } from 'react';

interface UseDeploymentProgressProps {
    lastMessage: any;
    showDeployModal: boolean;
    setDeploymentSteps: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useDeploymentProgress({
    lastMessage,
    showDeployModal,
    setDeploymentSteps
}: UseDeploymentProgressProps) {
    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'deployment.step' || !showDeployModal) return;

        const payload = lastMessage.payload;

        setDeploymentSteps(prev => {
            const newSteps = [...prev];
            // Mapping logic:
            // initializing -> 0
            // generating -> 1
            // provisioning -> 2
            // verified -> 3

            let idx = -1;
            switch (payload.step) {
                case 'initializing': idx = 0; break;
                case 'generating': idx = 1; break;
                case 'provisioning': idx = 2; break;
                case 'verified': idx = 3; break;
            }

            if (idx !== -1) {
                newSteps[idx] = {
                    label: payload.label || newSteps[idx].label,
                    status: payload.status as any,
                    details: payload.details || ''
                };

                // Auto-complete previous steps
                if (payload.status === 'in-progress' || payload.status === 'completed') {
                    for (let i = 0; i < idx; i++) {
                        if (newSteps[i].status !== 'completed') newSteps[i].status = 'completed';
                    }
                }
            }
            return newSteps;
        });
    }, [lastMessage, showDeployModal, setDeploymentSteps]);
}
