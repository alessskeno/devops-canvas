/**
 * Copy text to the clipboard. Works on HTTP (non-localhost) where
 * navigator.clipboard.writeText is unavailable or rejects (insecure context).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through — common on http://<ip> in Chromium
        }
    }
    return fallbackCopyText(text);
}

function fallbackCopyText(text: string): boolean {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, text.length);
    try {
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(el);
    }
}
