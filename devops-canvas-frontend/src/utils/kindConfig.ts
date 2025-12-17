import { KindClusterConfig } from "../types";

export function generateKindConfig(config: KindClusterConfig, advancedConfigContent?: string): string {
    const { name, version, topology, networking, mounts } = config;

    const lines: string[] = [];

    // Header
    lines.push(`kind: Cluster`);
    lines.push(`apiVersion: kind.x-k8s.io/v1alpha4`);
    lines.push(`name: ${name || 'kind'}`);

    // Nodes
    lines.push(`nodes:`);

    // Control Plane(s)
    for (let i = 0; i < (topology.controlPlanes || 1); i++) {
        lines.push(`- role: control-plane`);
        if (version) {
            lines.push(`  image: ${version}`);
        }

        // Networking setup for first control plane (Ingress)
        if (i === 0 && networking.enableIngress) {
            lines.push(`  kubeadmConfigPatches:`);
            lines.push(`  - |`);
            lines.push(`    kind: InitConfiguration`);
            lines.push(`    nodeRegistration:`);
            lines.push(`      kubeletExtraArgs:`);
            lines.push(`        node-labels: "ingress-ready=true"`);
            lines.push(`  extraPortMappings:`);
            lines.push(`  - containerPort: 80`);
            lines.push(`    hostPort: 80`);
            lines.push(`    protocol: TCP`);
            lines.push(`  - containerPort: 443`);
            lines.push(`    hostPort: 443`);
            lines.push(`    protocol: TCP`);
        }

        // Mounts (applied to all nodes for now, or just CP? usually helpful on all)
        if (mounts && mounts.length > 0) {
            lines.push(`  extraMounts:`);
            mounts.forEach(m => {
                if (m.hostPath && m.containerPath) {
                    lines.push(`  - hostPath: ${m.hostPath}`);
                    lines.push(`    containerPath: ${m.containerPath}`);
                }
            });
        }
    }

    // Workers
    for (let i = 0; i < (topology.workers || 0); i++) {
        lines.push(`- role: worker`);
        if (version) {
            lines.push(`  image: ${version}`);
        }
        // Mounts for workers too
        if (mounts && mounts.length > 0) {
            lines.push(`  extraMounts:`);
            mounts.forEach(m => {
                if (m.hostPath && m.containerPath) {
                    lines.push(`  - hostPath: ${m.hostPath}`);
                    lines.push(`    containerPath: ${m.containerPath}`);
                }
            });
        }
    }

    // Networking Global
    if (networking.apiServerPort) {
        lines.push(`networking:`);
        lines.push(`  apiServerPort: ${networking.apiServerPort}`);
    }

    // Advanced Config (Raw Append)
    if (advancedConfigContent && advancedConfigContent.trim().length > 0) {
        lines.push(``);
        lines.push(`# --- Advanced Config Patch ---`);
        lines.push(advancedConfigContent);
    }

    return lines.join('\n');
}
