---
phase: 05-stats-persistence-profile
reviewed: 2026-06-12T10:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - lib/utils.ts
  - lib/i18n.ts
  - app/layout.tsx
  - app/room/[code]/game/page.tsx
  - app/PendingStatsFlusher.tsx
  - supabase/lifecycle.sql
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 05: Code Review Report (gap-closure pass)

**Reviewed:** 2026-06-12T10:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This gap-closure review covers the six files changed for the Phase 05 pending-stats stash feature:
localStorage stash helpers (`lib/utils.ts`), the `save_prompt.flushed` i18n key (`lib/i18n.ts`), the global flusher mount (`app/layout.tsx`), the OAuth CTA and not-found deferred redirect in the game page (`app/room/[code]/game/page.tsx`), the new `PendingStatsFlusher` component (`app/PendingStatsFlusher.tsx`), and the status-aware TTL for `cleanup_dead_rooms()` (`supabase/lifecycle.sql`).

The OAuth redirect rule is correctly preserved: `handleCTASignIn` routes through `/auth/callback?next=…` per the CLAUDE.md gotcha. The `flushingRef` guard is sound for the JavaScript single-threaded execution model (the flag is set synchronously before the first `await`, so neither concurrent call can pass the guard simultaneously). The `ignoreDuplicates: true` idempotency on both the flusher and the `EndScreen` upsert is correct. The lifecycle SQL status-aware TTL logic is predicate-correct.

No BLOCKER (game-freezing or data-loss) issues are introduced by these specific six files in isolation. However, five warnings were found: a trust model gap in the localStorage stash, a leaked timeout in `PendingStatsFlusher`, a race between the deferred redirect and the toast confirmation timing, an unchecked `JSON.parse` cast in `getPendingStats`, and an operational fragility in the pg_cron Block 5 steps.

## Warnings

### WR-01: localStorage stash payload is trusted without field validation — arbitrary stat values can be injected

**File:** `app/PendingStatsFlusher.tsx:36-57` / `lib/utils.ts:173-185`
**Issue:** `getPendingStats()` parses the raw JSON and casts directly to `PendingStats` with no field-level validation. Any code running on the same origin (XSS, malicious browser extension) can overwrite `kluup_pending_stats` with an arbitrary payload — including inflated `designated_count`, `confessed_count`, `volunteered_count` — and the flusher will write those values verbatim to `user_session_stats` on the next sign-in. Critically, the `session_id` is also taken verbatim from localStorage, so an attacker can fabricate a new UUID to bypass the `UNIQUE(user_id, session_id)` deduplification guard and insert unlimited fake rows. The current MVP has no premium gating on stats, so the practical impact is low today. But this pattern is load-bearing for archetype scores and any future leaderboard/reward — if those features ship without server-side validation of the payload, the trust model cannot be fixed retroactively.

Additionally, a malformed stash (e.g., written by an older code version where the `PendingStats` type had different fields) is cast blindly; if any numeric field is `undefined`, the upsert sends `undefined` to Supabase, which serializes as `null` or errors depending on the column's NOT NULL constraint.

**Fix (short-term):** Add a type guard in `getPendingStats` that validates each required field:
```ts
function isValidPendingStats(p: unknown): p is PendingStats {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    typeof o.session_id === 'string' && o.session_id.length > 0 &&
    typeof o.designated_count === 'number' &&
    typeof o.confessed_count === 'number' &&
    typeof o.volunteered_count === 'number' &&
    typeof o.group_title === 'string' &&
    typeof o.theme === 'string' &&
    typeof o.rounds_played === 'number' &&
    typeof o.code === 'string' &&
    typeof o.stashed_at === 'number'
  )
}
// in getPendingStats:
const p = JSON.parse(raw)
if (!isValidPendingStats(p)) { clearPendingStats(); return null }
```

**Fix (long-term, before premium):** Move the upsert to a `SECURITY DEFINER` RPC that validates the `session_id` against `rooms` (or `game_state.session_uuid`) server-side, so the client cannot fabricate a session the server doesn't know about. CLAUDE.md's "Gating OBLIGATOIREMENT côté serveur" guidance for the premium build applies here.

---

### WR-02: `setTimeout` in `PendingStatsFlusher.flush` is never cancelled on unmount — stale state update

**File:** `app/PendingStatsFlusher.tsx:62-63`
**Issue:** `setTimeout(() => setShowToast(false), 4000)` is created inside the async `flush()` function, which is called from within the `useEffect`. The effect's cleanup only cancels the auth subscription:
```ts
return () => { subscription.unsubscribe() }
```
If the component unmounts (e.g., fast navigation away from the page) while the 4-second timeout is pending, `setShowToast(false)` is called on an unmounted component. React 18 silently discards this, but if the component re-mounts quickly, the timer from the first mount now races with a fresh mount's state — producing an unexpected flicker (toast appears, immediately hidden by the stale timer from the previous mount).

**Fix:** Hoist the timeout ref, store the handle in the effect, and cancel it in the cleanup:
```ts
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// inside flush, replace the setTimeout:
if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
toastTimerRef.current = setTimeout(() => setShowToast(false), 4000)

// in the cleanup:
return () => {
  subscription.unsubscribe()
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
}
```

---

### WR-03: Deferred redirect (3500 ms) fires before the flush toast can appear or complete — user never sees confirmation

**File:** `app/room/[code]/game/page.tsx:1678`
**Issue:** When `init()` finds no room and there is a pending stash for this room code, the code defers navigation:
```ts
setTimeout(() => router.push('/'), 3500)
```
The comment says "give it ~4s to fire and show its toast." The actual timing is unsafe:

1. `PendingStatsFlusher` fires `flush()` only after `getUser()` resolves OR `SIGNED_IN` fires. Neither is guaranteed to happen within 3500ms of this component mounting — `getUser()` is a network round-trip and `SIGNED_IN` may have already fired before this page mounted (in which case `getUser()` is the only path, and it must resolve, call `flush()`, the upsert must complete, *then* `setShowToast(true)` must render before 3500ms elapses).
2. If the Supabase upsert itself is slow (e.g., >1s on a cold connection), the toast appears after the navigation has already occurred.
3. The redirect fires at 3500ms while `PendingStatsFlusher`'s toast auto-hides at 4000ms — the user navigates away 500ms before the toast would disappear normally anyway, giving a jarring cut.

A 3500ms magic number was chosen to approximate `PendingStatsFlusher`'s 4000ms toast, but the flush is asynchronous and the timing is not guaranteed.

**Fix:** Emit a custom event from `PendingStatsFlusher` on flush success, or use a cross-component signal (e.g., a shared Zustand atom, or a `BroadcastChannel` message), so `init()` can navigate *after confirmation* rather than after a guessed timeout:
```ts
// In PendingStatsFlusher, after clearPendingStats():
window.dispatchEvent(new CustomEvent('kluup:stats-flushed'))

// In init() not-found branch, replace setTimeout with:
const onFlushed = () => { router.push('/') }
window.addEventListener('kluup:stats-flushed', onFlushed, { once: true })
// Safety fallback: if flush never fires (no pending stash, or flush errors):
const fallback = setTimeout(() => {
  window.removeEventListener('kluup:stats-flushed', onFlushed)
  router.push('/')
}, 6000) // generous deadline
// Store fallback handle to clear on flush
```

---

### WR-04: `cleanup_dead_rooms()` 90-second TTL for non-ended rooms may delete rooms with active presence on poor connections

**File:** `supabase/lifecycle.sql:70-74`
**Issue:** The new TTL for `status != 'ended'` is 90 seconds. The presence heartbeat interval from `lib/usePresence.ts` is 30 seconds (confirmed by earlier review; CLAUDE.md still documents 2 min). This gives a margin of 3× the heartbeat before deletion, which is the stated intent.

However, the `rooms_bump_activity` trigger bumps `last_activity` on any rooms UPDATE — so game state writes also keep rooms alive. The risk scenario is a game in a `playing` state where:
- All players are simultaneously on a bad mobile connection (heartbeat drops),
- No game state writes have occurred for >90s (e.g., everyone is in the middle of a 30s vote timer but the host's client lost connectivity after setting up the vote),
- The pg_cron sweep fires.

In that scenario, an active room with live votes in-flight would be deleted, cascade-deleting votes and players, leaving reconnecting players in a broken state with no room to return to. The previous CLAUDE.md-documented TTL was 30 minutes (non-ended rooms). A 97% reduction in TTL significantly narrows the safety margin.

The intent (SC-3: "empty room auto-deleted within ~1 min") applies to **abandoned** rooms, not active ones. Active rooms should be protected by the trigger. But the protection relies entirely on game-state writes happening within 90s — silence in a paused game or a slow vote phase breaks it.

**Fix:** Increase the non-ended TTL to at least 5 minutes to cover a paused game where nobody writes state, or add an explicit guard: `AND status != 'playing'` for the 90s bucket, keeping only `status IN ('waiting', 'lobby')` at 90s and `status = 'playing'` at a longer interval (e.g., 5 min).

```sql
WHERE COALESCE(last_activity, created_at) < now() - (
  CASE
    WHEN status = 'ended'  THEN interval '30 minutes'
    WHEN status = 'playing' THEN interval '5 minutes'
    ELSE interval '90 seconds'   -- waiting / lobby / null
  END
)
```

---

### WR-05: pg_cron Block 5 Step 2 errors if pg_cron is not yet installed — breaks idempotent re-run claim

**File:** `supabase/lifecycle.sql:106`
**Issue:** The comment on Block 5 says "This block is idempotent." Step 2 is:
```sql
SELECT cron.unschedule('cleanup-dead-rooms')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-dead-rooms');
```
If someone runs this statement before Step 1 (`CREATE EXTENSION IF NOT EXISTS pg_cron`), the `cron.job` table does not exist and the `EXISTS` subquery throws `ERROR: relation "cron.job" does not exist`, aborting the statement. The block is only idempotent *when run in the correct order*, but the instructions say "Run each statement ONE AT A TIME" without enforcing the order, and the `IF NOT EXISTS` guard on Step 1 creates a false sense of safety (Step 1 succeeds idempotently, but Step 2 still fails).

Additionally, the Step 2 form `SELECT fn() WHERE condition` relies on PostgreSQL evaluating the function call only when the condition is true. This is correct behavior but non-obvious and fragile — if the planner decides to evaluate `cron.unschedule()` before the `WHERE` (which it does not currently do, but is theoretically permitted for side-effect-free functions), it would error when the job doesn't exist. The explicit, unambiguous pattern used elsewhere in the Supabase ecosystem is:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-dead-rooms') THEN
    PERFORM cron.unschedule('cleanup-dead-rooms');
  END IF;
END $$;
```

**Fix:** Replace Step 2 with the `DO $$ ... $$` form, and add a note that Step 1 must be confirmed installed before Step 2 is run.

---

## Info

### IN-01: `save_prompt.flushed` key duplicates `end.stats_saved` — same string, different keys

**File:** `lib/i18n.ts:236` (fr), `502` (en), `766` (es), `1030` (de)
**Issue:** All four locales have `save_prompt.flushed` and `end.stats_saved` with identical translations (FR: "Stats sauvegardées ✓", EN: "Stats saved ✓", etc.). This is not a bug — the contexts differ (global toast vs. in-game receipt) — but it creates a maintenance hazard: if a future copywriter updates one, they must remember to update the other. A shared key (e.g., `common.stats_saved`) would eliminate the duplication.

---

### IN-02: `myId ?? ''` in `handleCTASignIn` writes a zero-stat row when `myId` is null

**File:** `app/room/[code]/game/page.tsx:1426-1429`
**Issue:** If `myId` is null (a player who arrived at `/game` without a player identity — possible if localStorage was cleared after game ended), all three stat lookups return 0. The stash is written with zero stats. `PendingStatsFlusher` then upserts a `user_session_stats` row with all-zero personal counts. The row is not harmful (it's correct — no verifiable personal stats) but it pollutes the history with an entry the player might not recognize as meaningful.

The stash guard `if (gs.session_uuid)` is correct — it prevents stashing when there is nothing to save — but it does not gate on `myId` being non-null.

**Fix:** Add `&& myId` to the stash guard:
```ts
if (gs.session_uuid && myId) {
  setPendingStats({ ... })
}
```

---

### IN-03: `app/layout.tsx` renders `PendingStatsFlusher` and `children` as adjacent siblings without a fragment wrapper — minor JSX style

**File:** `app/layout.tsx:50`
**Issue:**
```tsx
<LocaleProvider><PendingStatsFlusher />{children}</LocaleProvider>
```
`PendingStatsFlusher` and `{children}` are adjacent JSX children inside `LocaleProvider` on the same line. This is valid React (multiple children are fine), but it means any future addition of another global component must be inserted carefully into this single line. A fragment or a wrapping element would make the intent explicit and the structure easier to maintain.

**Fix (optional, style):**
```tsx
<LocaleProvider>
  <PendingStatsFlusher />
  {children}
</LocaleProvider>
```

---

_Reviewed: 2026-06-12T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
