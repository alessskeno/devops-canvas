import React, { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Toggle } from '../shared/Toggle';
import { Copy, Download, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
    const [includeSecrets, setIncludeSecrets] = useState(false);

    const mockConfig = format === 'yaml'
        ? `version: '1.2'
services:
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: app_prod
      POSTGRES_USER: postgres
  redis:
    image: redis:7
    ports: ["6379:6379"]`
        : `{\n  "version": "1.2",\n  "services": {\n    "postgres": {\n      "image": "postgres:15",\n      "ports": ["5432:5432"]\n    }\n  }\n}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Export Configuration" size="lg">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                            onClick={() => setFormat('yaml')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${format === 'yaml' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                        >YAML</button>
                        <button
                            onClick={() => setFormat('json')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${format === 'json' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                        >JSON</button>
                    </div>

                    <Toggle
                        label="Include Secrets"
                        checked={includeSecrets}
                        onChange={setIncludeSecrets}
                    />
                </div>

                <div className="relative">
                    <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-xs overflow-auto max-h-64">
                        {mockConfig}
                    </pre>
                    <button
                        onClick={() => { navigator.clipboard.writeText(mockConfig); toast.success('Copied!'); }}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded"
                    >
                        <Copy size={14} />
                    </button>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <Button variant="outline" leftIcon={<Share2 size={16} />}>Share Link</Button>
                    <Button leftIcon={<Download size={16} />}>Download File</Button>
                </div>
            </div>
        </Modal>
    );
}
