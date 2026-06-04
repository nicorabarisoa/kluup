// Browser-API helpers safe for non-secure contexts (HTTP on a LAN IP).
//
// Several Web APIs only work in a "secure context" (HTTPS or localhost) and
// throw over plain HTTP — which is exactly how the app is served when testing
// on a phone via the dev machine's LAN IP (e.g. http://192.168.1.63:3000).
//
// Always use these helpers instead of calling the raw APIs directly, so the
// HTTP fallback is guaranteed everywhere.

/**
 * Generate a unique id. Uses crypto.randomUUID() when available (secure
 * context), otherwise falls back to a timestamp + random string.
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // fall through to fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Copy text to the clipboard. Uses the async Clipboard API when available
 * (secure context), otherwise falls back to a temporary textarea + execCommand.
 * Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to fallback
    }
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
