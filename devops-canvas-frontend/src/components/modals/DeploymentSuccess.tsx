import React from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { CheckCircle, ExternalLink, Activity } from 'lucide-react';

interface DeploymentSuccessProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DeploymentSuccess({ isOpen, onClose }: DeploymentSuccessProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Workspace Ready! 🎉">
            <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-green-500 h-8 w-8" />
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Your environment <strong>E-commerce Backend</strong> has been successfully deployed.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">PostgreSQL</span>
                        <a href="#" className="text-blue-600 hover:underline flex items-center">localhost:5432 <ExternalLink size={12} className="ml-1" /></a>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Redis</span>
                        <a href="#" className="text-blue-600 hover:underline flex items-center">localhost:6379 <ExternalLink size={12} className="ml-1" /></a>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Kafka Control Plane</span>
                        <a href="#" className="text-blue-600 hover:underline flex items-center">localhost:9092 <ExternalLink size={12} className="ml-1" /></a>
                    </div>
                </div>

                <div className="flex justify-center space-x-3">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button leftIcon={<Activity size={16} />}>View Live Monitoring</Button>
                </div>
            </div>
        </Modal>
    );
}
