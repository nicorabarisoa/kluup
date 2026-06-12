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
// Global breadcrumb: the code of the room this browser most recently joined.
// Lets the landing page offer "resume your game" from the bare base URL — the
// per-room kluup_pid_<CODE> survives a tab close, but nothing global tracked
// WHICH room you were in. Written on every successful join/create (via
// setPlayerId), cleared on explicit quit (via clearPlayerId).
const LAST_ROOM_KEY = 'kluup_last_room'

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
  // Remember this as the active room for the resume banner.
  try { localStorage.setItem(LAST_ROOM_KEY, code.toUpperCase()) } catch { /* ignore */ }
  // Keep the legacy global key in sync for backward compatibility.
  try { sessionStorage.setItem('player_id', id) } catch { /* ignore */ }
}

export function clearPlayerId(code: string) {
  try { localStorage.removeItem(PID_PREFIX + code.toUpperCase()) } catch { /* ignore */ }
  // Drop the resume breadcrumb only if it points at the room being left, so
  // quitting room A doesn't erase a still-active membership in room B.
  try {
    if (localStorage.getItem(LAST_ROOM_KEY) === code.toUpperCase()) {
      localStorage.removeItem(LAST_ROOM_KEY)
    }
  } catch { /* ignore */ }
  try { sessionStorage.removeItem('player_id') } catch { /* ignore */ }
}

/**
 * The code of the most recently joined room, or null. The landing page uses
 * this to offer a "resume your game" entry point from the bare base URL.
 * Returns null if the stored value isn't a valid room code (defensive).
 */
export function getLastRoom(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const code = localStorage.getItem(LAST_ROOM_KEY)
    if (code && /^[A-HJ-NP-Z2-9]{6}$/.test(code)) return code
  } catch { /* ignore */ }
  return null
}

export function clearLastRoom() {
  try { localStorage.removeItem(LAST_ROOM_KEY) } catch { /* ignore */ }
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

// ---------------------------------------------------------------------------
// Pending-stats stash — survives the full-page signInWithOAuth redirect
//
// When an anonymous player taps the end-screen "Se connecter" CTA, the OAuth
// redirect destroys all React state. In a solo room the pg_cron sweep also
// deletes the room (and its game_state) before the callback returns, so the
// retroactive-save effect inside EndScreen can never fire (rooms row gone).
//
// Fix: stash the entire save payload — everything needed for the
// user_session_stats upsert EXCEPT user_id, which is only known after sign-in
// — in localStorage BEFORE the redirect. A globally-mounted PendingStatsFlusher
// reads the stash on SIGNED_IN and upserts it, independent of room lifetime.
//
// The 24-hour TTL prevents a stash left by an abandoned/cancelled OAuth from
// flushing a stale session on any future unrelated sign-in.
// ---------------------------------------------------------------------------

const PENDING_STATS_KEY = 'kluup_pending_stats'
export const PENDING_STATS_TTL_MS = 24 * 60 * 60 * 1000 // 24 h

/** User-agnostic save payload. stashed_at is stash-only metadata (not a DB column). */
export type PendingStats = {
  session_id:       string
  designated_count: number
  confessed_count:  number
  volunteered_count: number
  group_title:      string
  theme:            string
  rounds_played:    number
  code:             string
  stashed_at:       number
}

export function setPendingStats(p: PendingStats): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(PENDING_STATS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

export function getPendingStats(): PendingStats | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PENDING_STATS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as PendingStats
    if (!p.stashed_at || Date.now() - p.stashed_at > PENDING_STATS_TTL_MS) {
      clearPendingStats()
      return null
    }
    return p
  } catch { return null }
}

export function clearPendingStats(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(PENDING_STATS_KEY) } catch { /* ignore */ }
}

/**
 * Extract the Google/OAuth first name from a Supabase User object for
 * pseudo pre-fill. Truncates to 12 chars (UI-SPEC). Returns an empty string
 * if no name can be determined (caller should skip the pre-fill in that case).
 */
export function getGoogleFirstName(user: { user_metadata?: { full_name?: string; name?: string }; email?: string }): string {
  const raw =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    ''
  return raw.length > 12 ? raw.slice(0, 11) + '…' : raw
}
