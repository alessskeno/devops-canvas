/** Short relative time for activity feeds (no extra dependencies). */
export function formatRelativeTime(iso: string | Date | undefined): string {
    if (!iso) return '';
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    const t = d.getTime();
    if (Number.isNaN(t)) return '';

    const diff = Date.now() - t;
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

export function getDisplayInitials(name: string | undefined | null): string {
    const n = (name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
