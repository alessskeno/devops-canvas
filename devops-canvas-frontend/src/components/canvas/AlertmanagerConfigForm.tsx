import React, { useState } from 'react';
import { AlertmanagerConfig } from '../../types';
import { Input } from '../shared/Input';
import { Select } from '../shared/Select';
import { Button } from '../shared/Button';
import { MessageSquare, Send, Copy, Eye } from 'lucide-react';
import { generateAlertmanagerConfig } from '../../utils/alertmanagerConfig';

interface Props {
    config: AlertmanagerConfig;
    onChange: (config: AlertmanagerConfig) => void;
    readOnly?: boolean;
}

export function AlertmanagerConfigForm({ config, onChange, readOnly }: Props) {
    const [destination, setDestination] = useState<'discord' | 'telegram'>(config.destination || 'discord');

    // Ensure config object structure exists
    const safeConfig: AlertmanagerConfig = {
        destination: destination,
        discord: config.discord || { webhook_url: '' },
        telegram: config.telegram || { bot_token: '', chat_id: '' }
    };

    const handleDestinationChange = (value: string) => {
        const dest = value as 'discord' | 'telegram';
        setDestination(dest);
        onChange({ ...safeConfig, destination: dest });
    };

    const updateDiscord = (updates: Partial<{ webhook_url: string }>) => {
        onChange({
            ...safeConfig,
            discord: { ...safeConfig.discord!, ...updates }
        });
    };

    const updateTelegram = (updates: Partial<{ bot_token: string; chat_id: string }>) => {
        onChange({
            ...safeConfig,
            telegram: { ...safeConfig.telegram!, ...updates }
        });
    };

    const generatedYaml = generateAlertmanagerConfig(safeConfig);

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="space-y-4 p-1">
                <Select
                    label="Destination"
                    value={destination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    options={[
                        { label: 'Discord', value: 'discord' },
                        { label: 'Telegram', value: 'telegram' }
                    ]}
                    disabled={readOnly}
                />

                {destination === 'discord' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-indigo-500 mb-2">
                            <MessageSquare size={18} />
                            <span className="text-sm font-semibold">Discord Configuration</span>
                        </div>
                        <Input
                            label="Webhook URL"
                            value={safeConfig.discord?.webhook_url || ''}
                            onChange={(e) => updateDiscord({ webhook_url: e.target.value })}
                            placeholder="https://discord.com/api/webhooks/..."
                            disabled={readOnly}
                        />
                    </div>
                )}

                {destination === 'telegram' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-sky-500 mb-2">
                            <Send size={18} />
                            <span className="text-sm font-semibold">Telegram Configuration</span>
                        </div>
                        <Input
                            label="Bot Token"
                            value={safeConfig.telegram?.bot_token || ''}
                            onChange={(e) => updateTelegram({ bot_token: e.target.value })}
                            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                            disabled={readOnly}
                        />
                        <Input
                            label="Chat ID"
                            value={safeConfig.telegram?.chat_id || ''}
                            onChange={(e) => updateTelegram({ chat_id: e.target.value })}
                            placeholder="-1001234567890"
                            disabled={readOnly}
                        />
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Eye size={12} /> Preview (alertmanager.yaml)
                    </span>
                    <Button
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(generatedYaml)}
                    >
                        <Copy size={12} className="mr-1" /> Copy
                    </Button>
                </div>
                <div className="flex-1 relative">
                    <pre className="absolute inset-0 p-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-50 font-mono text-[10px] overflow-auto whitespace-pre">
                        {generatedYaml}
                    </pre>
                </div>
            </div>
        </div>
    );
}
