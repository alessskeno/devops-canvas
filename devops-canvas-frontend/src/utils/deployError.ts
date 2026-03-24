/** Short, readable text for deployment failure toasts and UI (avoids full docker compose logs). */
export function userFacingDeployError(raw: string): string {
    if (!raw) return 'Deployment failed.';
    let s = String(raw).replace(/^Error:\s*(Error:\s*)+/i, '').trim();
    s = s.replace(/\s*exit status \d+\s*$/i, '').trim();
    const lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
    const hit = lines.find((l) =>
        /failed to resolve reference|pull access denied|repository does not exist|port is already allocated|no space left|cannot connect to the docker daemon/i.test(
            l
        )
    );
    const pick = hit || lines[lines.length - 1] || s;
    const max = 380;
    return pick.length <= max ? pick : pick.slice(0, max - 1) + '…';
}
