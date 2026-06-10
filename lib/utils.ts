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
 * Player identity, scoped per room and persisted in localStorage so it survives
 * a browser/tab close (sessionStorage does NOT) — this lets a player who closes
 * and reopens reconnect to their SAME row instead of creating a duplicate.
 * Falls back to the legacy global sessionStorage key for in-flight sessions.
 */
const PID_PREFIX = 'kluup_pid_'

export function getPlayerId(code: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const scoped = localStorage.getItem(PID_PREFIX + code.toUpperCase())
    if (scoped) return scoped
  } catch { /* ignore */ }
  try { return sessionStorage.getItem('player_id') } catch { return null }
}

export function setPlayerId(code: string, id: string) {
  try { localStorage.setItem(PID_PREFIX + code.toUpperCase(), id) } catch { /* ignore */ }
  // Keep the legacy global key in sync for backward compatibility.
  try { sessionStorage.setItem('player_id', id) } catch { /* ignore */ }
}

export function clearPlayerId(code: string) {
  try { localStorage.removeItem(PID_PREFIX + code.toUpperCase()) } catch { /* ignore */ }
  try { sessionStorage.removeItem('player_id') } catch { /* ignore */ }
}

/**
 * Last-used pseudo, scoped per room and persisted independently of the player
 * id/row. Written on a successful join so the /join page can pre-fill the
 * pseudo even after an explicit quit (which clears the player id and deletes
 * the player row, but intentionally leaves this key intact for SC-4).
 */
const LAST_PSEUDO_PREFIX = 'kluup_pseudo_'

export function setLastPseudo(code: string, pseudo: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LAST_PSEUDO_PREFIX + code.toUpperCase(), pseudo) } catch { /* ignore */ }
}

export function getLastPseudo(code: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(LAST_PSEUDO_PREFIX + code.toUpperCase()) } catch { return null }
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
