import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

interface LogViewerProps {
    workspaceId?: string;
    componentId: string;
}

export function LogViewer({ workspaceId, componentId }: LogViewerProps) {
    const [logs, setLogs] = useState<{ id: string, text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Extract workspace ID from URL if not provided
    const pathname = window.location.pathname;
    const match = pathname.match(/\/workspace\/([^\/]+)/);
    const actualWorkspaceId = workspaceId || (match ? match[1] : '');

    const fetchLogs = useCallback(async () => {
        if (!actualWorkspaceId) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/deploy/${actualWorkspaceId}/logs?component_id=${componentId}`);
            if (res.data && res.data.logs && Array.isArray(res.data.logs)) {
                setLogs(res.data.logs.map((line: string) => ({ id: crypto.randomUUID(), text: line })));
            } else {
                setLogs([{ id: 'no-logs', text: 'No logs returned.' }]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch logs');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [actualWorkspaceId, componentId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Console Output</span>
                <button
                    onClick={fetchLogs}
                    className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh Logs'}
                </button>
            </div>

            <div className="flex-1 bg-slate-950 text-slate-300 p-3 rounded-md font-mono text-[10px] leading-relaxed overflow-y-auto whitespace-pre-wrap">
                {error && <div className="text-red-400 mb-2">[Error] {error}</div>}

                {!loading && logs.length === 0 && !error && (
                    <div className="text-slate-500 italic">No logs available (container might be starting or stopped).</div>
                )}

                {logs.map((log) => (
                    <div key={log.id} className="border-b border-white/5 pb-0.5 mb-0.5 last:border-0 last:mb-0">
                        {log.text}
                    </div>
                ))}

                {loading && <div className="text-blue-400 mt-2 animate-pulse">Updating...</div>}
            </div>
        </div>
    );
}
