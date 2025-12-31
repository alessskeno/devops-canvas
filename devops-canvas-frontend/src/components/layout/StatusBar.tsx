import React, { useMemo } from 'react';
import { Activity, Cpu, HardDrive, Users, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { SystemStats, WorkspaceStats } from '../../hooks/useRealtime';
import { useCanvasStore } from '../../store/canvasStore';

interface StatusBarProps {
    isConnected: boolean;
    systemStats?: SystemStats | null;
    workspaceStats?: WorkspaceStats | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ isConnected, workspaceStats }) => {
    const { nodes, connections } = useCanvasStore();

    // Default resource limits per component type (in the absence of explicit config)
    // CPU in Cores, Memory in MB
    // Default resource limits - User requested to treat unspecified as Unlimited (0)
    // We keep the structure but return 0s so only explicit user configs count.
    const getResourceDefaults = (type: string) => {
        return { cpu: 0, memory: 0 };
    };

    // Helper to parse memory string (e.g. "1GiB", "512MiB") to MB
    const parseResourceMemory = (val: string): number => {
        if (!val) return 0;
        const num = parseFloat(val);
        if (isNaN(num)) return 0;
        if (val.includes('GiB')) return num * 1024;
        if (val.includes('MiB')) return num;
        if (val.includes('KiB')) return num / 1024;
        if (val.includes('B') && !val.includes('MB') && !val.includes('GB')) return num / (1024 * 1024);
        return num; // Default assume MB if just number
    };

    const { totalCpuLimit, totalMemLimit } = useMemo(() => {
        return nodes.reduce((acc, node) => {
            const defaults = getResourceDefaults(node.type);

            // Use custom resources if defined, otherwise fallback to defaults (which are now 0/Unlimited)
            const cpuLimit = (node.data.resources?.cpu !== undefined)
                ? node.data.resources.cpu
                : defaults.cpu;

            // Note: node.data.resources.memory is a string (e.g. "128Mi").
            // If it exists and is not empty string, we parse it.
            // If it is "0" (Unlimited), we parse it as 0. 
            const memLimit = (node.data.resources?.memory !== undefined && node.data.resources?.memory !== "")
                ? parseResourceMemory(node.data.resources.memory)
                : defaults.memory;

            return {
                totalCpuLimit: acc.totalCpuLimit + cpuLimit,
                totalMemLimit: acc.totalMemLimit + memLimit
            };
        }, { totalCpuLimit: 0, totalMemLimit: 0 });
    }, [nodes]);

    // Calculate Real Usage from Docker Stats
    const { usedCpu, usedMem } = useMemo(() => {
        if (!workspaceStats) return { usedCpu: 0, usedMem: 0 };

        // Prefer backend pre-calculated stats if available
        if (workspaceStats.total_cpu !== undefined && workspaceStats.total_memory !== undefined) {
            // Backend sends CPU sum of percentages (e.g. 10.5 for 10.5%) -> /100 for cores
            // Backend sends Memory in Bytes
            return {
                usedCpu: workspaceStats.total_cpu / 100,
                usedMem: workspaceStats.total_memory
            };
        }

        // Fallback: Client-side calculation
        if (!workspaceStats.containers) return { usedCpu: 0, usedMem: 0 };

        let cpuSum = 0;
        let memSum = 0;

        workspaceStats.containers.forEach(c => {
            const cpuVal = parseFloat(c.CPUPerc.replace('%', ''));
            if (!isNaN(cpuVal)) cpuSum += (cpuVal / 100);

            const memParts = c.MemUsage.split(' / ');
            if (memParts.length > 0) {
                const valStr = memParts[0];
                let val = parseFloat(valStr);
                // Convert to Bytes for consistency
                if (valStr.includes('GiB')) val *= 1024 * 1024 * 1024;
                else if (valStr.includes('MiB')) val *= 1024 * 1024;
                else if (valStr.includes('KiB')) val *= 1024;
                else if (valStr.includes('B') && !valStr.includes('MB')) val *= 1; // Basic bytes
                // Default assumes MiB if parsing failed to match unit? 
                // Let's assume input "15MiB" is standard. 
                // If units missing, safest is 0 or assume MiB.
                // But usually units are there.

                if (!isNaN(val)) memSum += val;
            }
        });

        return { usedCpu: cpuSum, usedMem: memSum };
    }, [workspaceStats]);

    const memoryDisplay = useMemo(() => {
        // totalMemLimit is in MB
        if (totalMemLimit === 0) {
            const usedGB = (usedMem / (1024 * 1024 * 1024)).toFixed(2);
            if (parseFloat(usedGB) < 0.1) {
                const usedMB = (usedMem / (1024 * 1024)).toFixed(1);
                return `${usedMB} / Unlimited MB`;
            }
            return `${usedGB} / Unlimited GB`;
        }

        // totalMemLimit is in MB. Convert to Bytes for comparison/display logic
        const limitBytes = totalMemLimit * 1024 * 1024;

        const formatBytes = (bytes: number) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // We want to show "Used / Limit".
        // If Limit is > 1GB, show both in GB.
        // If Limit is small, show in MB.

        const limitGB = limitBytes / (1024 * 1024 * 1024);
        const usedGB = usedMem / (1024 * 1024 * 1024);

        if (limitGB >= 1.0) {
            return `${usedGB.toFixed(2)} / ${limitGB.toFixed(1)} GB`;
        } else {
            const usedMB = usedMem / (1024 * 1024);
            const limitMB = limitBytes / (1024 * 1024);
            return `${usedMB.toFixed(1)} / ${limitMB.toFixed(0)} MB`;
        }
    }, [totalMemLimit, usedMem]);

    const cpuDisplay = useMemo(() => {
        if (totalCpuLimit === 0) {
            return `${usedCpu.toFixed(2)} / Unlimited Cores`;
        }
        return `${usedCpu.toFixed(2)} / ${totalCpuLimit.toFixed(1)} Cores`;
    }, [totalCpuLimit, usedCpu]);

    return (
        <div className="h-8 bg-slate-900 border-t border-slate-800 flex items-center px-4 justify-between text-[11px] text-slate-400 select-none">

            {/* Left Section: System Health */}
            <div className="flex items-center space-x-6">
                <div className={clsx("flex items-center space-x-2 font-medium transition-colors", isConnected ? "text-emerald-400" : "text-amber-500")}>
                    <div className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500")} />
                    <span>{isConnected ? "System Healthy" : "Connecting..."}</span>
                </div>

                <div className="h-3 w-px bg-slate-800" />

                <div className="flex items-center space-x-2 hover:text-slate-200 transition-colors" title="Workspace CPU Usage / Limit">
                    <Cpu size={14} />
                    <span>{cpuDisplay}</span>
                </div>

                <div className="flex items-center space-x-2 hover:text-slate-200 transition-colors" title="Workspace Memory Usage / Limit">
                    <HardDrive size={14} />
                    <span>{memoryDisplay}</span>
                </div>
            </div>

            {/* Right Section: Workspace Stats */}
            <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-indigo-400">
                    <Users size={14} />
                    <span>You • Live</span>
                </div>

                <div className="h-3 w-px bg-slate-800" />

                <div className="flex items-center space-x-1">
                    <span>{nodes.length} Components</span>
                </div>

                <div className="flex items-center space-x-1">
                    <span>{connections.length} Connections</span>
                </div>
            </div>
        </div>
    );
};
