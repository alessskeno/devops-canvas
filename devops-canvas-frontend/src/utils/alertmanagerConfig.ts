import yaml from 'js-yaml';
import { AlertmanagerConfig } from '../types';

export const generateAlertmanagerConfig = (config: AlertmanagerConfig): string => {
    const receiverName = config.destination === 'discord' ? 'discord-webhook' : 'telegram-bot';

    // Base configuration structure
    const alertmanagerConfig: any = {
        global: {
            resolve_timeout: '5m'
        },
        route: {
            group_by: ['alertname'],
            group_wait: '30s',
            group_interval: '5m',
            repeat_interval: '1h',
            receiver: receiverName
        },
        receivers: [
            {
                name: receiverName
            }
        ]
    };

    // Add specific receiver config based on destination
    if (config.destination === 'discord' && config.discord?.webhook_url) {
        alertmanagerConfig.receivers[0].discord_configs = [
            {
                webhook_url: config.discord.webhook_url,
                send_resolved: true
            }
        ];
    } else if (config.destination === 'telegram' && config.telegram?.bot_token && config.telegram?.chat_id) {
        alertmanagerConfig.receivers[0].telegram_configs = [
            {
                bot_token: config.telegram.bot_token,
                chat_id: parseInt(config.telegram.chat_id, 10),
                send_resolved: true,
                parse_mode: 'MarkdownV2'
            }
        ];
    }

    try {
        return yaml.dump(alertmanagerConfig, { indent: 2, lineWidth: -1 });
    } catch (e) {
        console.error('Error generating Alertmanager YAML:', e);
        return '# Error generating configuration';
    }
};
