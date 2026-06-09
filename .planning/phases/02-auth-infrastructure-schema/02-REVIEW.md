---
phase: 02-auth-infrastructure-schema
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/auth/callback/route.ts
  - app/room/[code]/lobby/page.tsx
  - lib/game.ts
  - lib/supabase/middleware.ts
  - lib/supabase/server.ts
  - lib/types.ts
  - middleware.ts
  - supabase/migrations/002-auth.sql
  - supabase/schema.sql
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase introduces the auth infrastructure (Supabase SSR cookie client, OAuth callback route, Edge middleware for session refresh) and schema additions (`user_id` FK on `players`, `user_session_stats` table). The overall structure follows the official `@supabase/ssr` patterns correctly.

Three critical issues were found: the OAuth callback silently redirects on success without distinguishing error from success (leaving a logged-in user with no feedback and potentially on an unexpected page), the `shuffle()` utility in `lib/game.ts` uses a biased sort-based algorithm that produces non-uniform distributions (unfair game outcomes), and the `startGame()` function in the lobby does not guard against concurrent invocations, making double-submit possible. Five warnings cover open RLS posture carried forward, a missing CSRF/state parameter in the OAuth flow, missing `DELETE` RLS on `user_session_stats`, a race window when the lobby Realtime channel fires before `roomIdRef` is set, and the lobby not awaiting the votes-delete before proceeding. Four informational items round out the review.

---

## Critical Issues

### CR-01: Biased shuffle in `pickCandidates` — non-uniform question distribution

**File:** `lib/game.ts:8`
**Issue:** The `shuffle<T>` helper uses `[...arr].sort(() => Math.random() - 0.5)`. This is a well-known anti-pattern: V8's TimSort is not comparison-consistent with a random comparator, producing heavily biased output — early elements are over-represented. In a pool of 3 candidates this means the first question in the DB result set is drawn disproportionately often, violating the "random, unpredictable" design goal documented in CLAUDE.md and producing unfair vote outcomes.

**Fix:**
```typescript
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

---

### CR-02: OAuth callback always redirects to `/` — error and success are indistinguishable to the user

**File:** `app/auth/callback/route.ts:39-46`
**Issue:** On `exchangeCodeForSession` error (e.g. expired code, replay attack), the handler logs server-side and then redirects to `/` — exactly the same as a success. This means:
1. A legitimate sign-in attempt that fails (network hiccup, replayed code) silently brings the user to the homepage with no session and no indication that auth failed. The user has no way to retry.
2. The comment "silent redirect, no error surface" references design decision D-02, but D-02 only specifies *not exposing OAuth error details to the client*. It does not require making success and failure produce identical UX. A redirect to `/?auth=error` would surface a user-facing message without leaking the OAuth detail.

**Fix:**
```typescript
if (error) {
  console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  return NextResponse.redirect(new URL('/?auth=error', request.url))
}
return NextResponse.redirect(new URL('/', request.url))
```
The landing page should then read `?auth=error` and display a localised message (e.g. `fr.auth.login_failed`). This satisfies D-02 (no OAuth detail leaked) while giving the user actionable feedback.

---

### CR-03: `startGame()` in lobby has no concurrency guard — double-submit corrupts game state

**File:** `app/room/[code]/lobby/page.tsx:133-151`
**Issue:** `startGame` sets `starting = true` only *after* the initial guard `if (!roomId) return`. React state updates are asynchronous, so two rapid clicks (or a debounce race on a laggy phone) can both pass the initial check, both call `supabase.from('votes').delete()`, and both write a fresh `game_state` to the room. The second write occurs after the first `navigate()` already redirected the host, but the state update still lands in the DB. Worse, the second `pickCandidates` call returns a different candidate set, potentially overwriting the game state the other clients are now reading. The `starting` flag is only reliable if React batches the re-render synchronously before the async work begins, which it does not guarantee here.

**Fix:** Use a `useRef` guard (like the existing `navigatedRef` pattern) that is set synchronously before any async work:
```typescript
const startingRef = useRef(false)

async function startGame() {
  if (!roomId || startingRef.current) return
  startingRef.current = true
  setStarting(true)
  // ... rest of function
}
```

---

## Warnings

### WR-01: No CSRF `state` parameter check in the OAuth callback — open to CSRF login attack

**File:** `app/auth/callback/route.ts:6-11`
**Issue:** The route accepts a `code` query parameter and immediately exchanges it for a session without validating a `state` parameter. The OAuth 2.0 spec (RFC 6749 §10.12) requires the client to generate a random `state` value, embed it in the authorization URL, and verify it on callback to prevent CSRF login attacks. An attacker who tricks a victim into visiting a crafted callback URL can sign the victim into the attacker's account. Supabase PKCE flow mitigates the server-side code-for-token exchange, but the missing `state` check still exposes the client to login CSRF.

**Fix:** Supabase's `signInWithOAuth` automatically generates and stores a `state` value; verify it is present and matches before calling `exchangeCodeForSession`. If using `@supabase/ssr`, the cookie-based PKCE verifier handles this automatically — confirm the `pkce_code_verifier` cookie is present before proceeding:
```typescript
const verifier = cookieStore.get('sb-pkce-verifier')
if (!verifier) {
  return NextResponse.redirect(new URL('/?auth=error', request.url))
}
```

---

### WR-02: RLS on `rooms`, `players`, `votes` is fully open to `anon` — no write constraints

**File:** `supabase/schema.sql:114-139`
**Issue:** All INSERT, UPDATE, and DELETE policies on `rooms`, `players`, and `votes` use `WITH CHECK (true)` / `USING (true)`. This means any anonymous browser can:
- Delete any room and all its players (cascade)
- Update any room's `game_state` (vote manipulation, game corruption)
- Delete any player from any room
- Delete any vote

This is acknowledged as "MVP RLS ouvert" in CLAUDE.md. It is carried forward as-is in this phase, which adds `user_session_stats` with properly scoped RLS. The contrast makes the open posture more visible as a risk. At minimum, the `rooms_delete` policy should be scoped (only the host or an empty room can be deleted). Recording as a Warning because the team has consciously accepted this for MVP, but the Phase 2 auth work is the right time to at least add write constraints to `rooms.game_state`.

**Fix:** At minimum, scope the `rooms_update` policy to prevent arbitrary game state writes:
```sql
-- Only the host can update game_state; anyone can update last_activity / status
-- (tighten further when server-side RPC is introduced)
CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE USING (true) WITH CHECK (true); -- keep for now, document tightening in phase 3
```
Raise a tracked issue to move `updateRoomGameState` behind a `SECURITY DEFINER` RPC before the paywall work begins (as already noted in CLAUDE.md's monetisation section).

---

### WR-03: `user_session_stats` has no `DELETE` RLS policy

**File:** `supabase/migrations/002-auth.sql:32-42` and `supabase/schema.sql:143-155`
**Issue:** `user_session_stats` has SELECT, INSERT, and UPDATE policies but no DELETE policy. With RLS enabled and no DELETE policy, no role (including the row owner) can delete their own stats. This is probably intentional for data retention, but it is undocumented. If a user deletes their Supabase Auth account (`ON DELETE CASCADE` will fire), the rows are removed by the FK cascade — fine. But if a future admin workflow needs to purge individual stats, there is no policy to enable it without disabling RLS or using a `SECURITY DEFINER` function.

**Fix:** Explicitly document the intent with a comment, OR add a scoped policy:
```sql
-- Users cannot delete their own stats (retention policy).
-- Deletion only via auth.users cascade or a SECURITY DEFINER admin function.
-- (no DELETE policy is intentional)
```

---

### WR-04: Realtime `INSERT` handler in lobby fires before `roomIdRef` is set

**File:** `app/room/[code]/lobby/page.tsx:76-88`
**Issue:** The Realtime channel subscription is created immediately after `loadRoom()` is called, but `loadRoom()` is async. The `roomIdRef.current` guard on line 83 (`if (payload.new.room_id !== roomIdRef.current) return`) depends on `loadRoom()` having completed its async DB call and set `roomIdRef.current`. If a player INSERT fires via Realtime before the DB fetch returns (a narrow but real window in a fast network path or an instant reconnect), `roomIdRef.current` is still `null` and the guard `payload.new.room_id !== null` will be `true` for any real room id — silently dropping a legitimate player from the live roster.

**Fix:** Either subscribe to the channel only after `loadRoom()` resolves (move the `channel` creation inside `loadRoom()`), or use the room `code` as the filter instead of `room_id`:
```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'players',
  filter: `room_id=eq.${roomId}`, // use roomId state once set
}, ...)
```
Since `roomId` state is also set asynchronously, the cleanest fix is to move channel setup inside `loadRoom()` after the room fetch.

---

### WR-05: `votes.delete()` in `startGame` is not awaited before writing game state

**File:** `app/room/[code]/lobby/page.tsx:140`
**Issue:** The comment on line 139 correctly explains why votes must be purged before restart (UNIQUE constraint on `(room_id, round, player_id, vote_type)`). However, looking more carefully: `await supabase.from('votes').delete().eq('room_id', roomId)` IS awaited. But the error returned by this delete is not checked. If the delete fails (e.g. a transient network error or RLS hiccup), `makeInitialGameState` proceeds and `pickCandidates` runs against a DB that still has old votes. The subsequent round resolution will then hit the UNIQUE constraint and silently reject new votes, breaking the game — exactly the bug the comment warns about.

**Fix:**
```typescript
const { error: deleteError } = await supabase.from('votes').delete().eq('room_id', roomId)
if (deleteError) {
  console.error('[startGame] Failed to purge votes:', deleteError.message)
  setStarting(false)
  return // surface the error to the user rather than proceeding into a broken state
}
```

---

## Info

### IN-01: `lib/game.ts` imports `supabase` from `./supabase` (browser client) — not composable server-side

**File:** `lib/game.ts:1`
**Issue:** `lib/game.ts` is imported by `app/room/[code]/lobby/page.tsx` (client component) today. But the module-level import `import { supabase } from './supabase'` creates a hard dependency on the browser Supabase singleton. If any of the exported functions (`pickCandidates`, `fetchVotes`, `countVotes`, etc.) are ever called from a Server Component, API route, or Server Action, they will use the browser client (unauthenticated, no cookie session) instead of the cookie-aware server client from `lib/supabase/server.ts`. The game engine is logically pure and should receive a Supabase client as a parameter rather than importing a singleton.

**Fix (future refactor):** Thread a `client` parameter through `pickCandidates`, `fetchVotes`, `countVotes`, `countChoiceVotes`, and `updateRoomGameState`. Not blocking for the current client-only usage, but worth noting before any server-side game logic is added.

---

### IN-02: `middleware.ts` runs on ALL non-static routes including the health endpoint

**File:** `middleware.ts:9-13`
**Issue:** The matcher pattern includes everything except `_next/static`, `_next/image`, and image extensions. This means `app/api/health/route.ts` is subject to the `updateSession` middleware (a `getUser()` call to the Supabase Auth server) on every health check. For a lightweight ping endpoint this adds unnecessary latency and external dependency. The health check will appear degraded if Supabase Auth is slow, even if the app itself is fine.

**Fix:** Exclude the health endpoint from the middleware matcher:
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

### IN-03: `BSubtype = 'B1' | 'B2'` type is dead — `B1` is never assigned

**File:** `lib/types.ts:29`
**Issue:** `BSubtype` is declared as `'B1' | 'B2'`. Per CLAUDE.md, B1/B2 sub-modes were removed after playtest — confession is always roulette now, and `b_subtype` is always set to `'B2'` for stats continuity. The `'B1'` branch in `accumulateStats` (`lib/game.ts:124-128`) is dead code. The `SessionStats` fields `rounds_b1` and `rounds_b2` are populated but `rounds_b1` will always remain 0. The `BSubtype` type should at minimum have a comment, and ideally be simplified to `'B2'` to prevent future code from accidentally branching on `'B1'`.

**Fix:**
```typescript
// B1 sub-mode was removed after playtest. b_subtype is always 'B2' for stats continuity.
export type BSubtype = 'B2'
```

---

### IN-04: `schema.sql` `UPDATE rooms SET status = 'waiting' WHERE status = 'lobby'` — destructive on live prod

**File:** `supabase/schema.sql:84`
**Issue:** The schema file is documented as "idempotent, safe to re-execute". However, line 84 runs `UPDATE rooms SET status = 'waiting' WHERE status = 'lobby'` unconditionally every time the file is run. For a prod database with active games that may somehow have a `'lobby'` status row (a legacy row), this is fine. But the file header says "safe to run on a live prod DB" without noting that this line mutates live data. It would be safer to guard this with a check or move it to a one-time migration file where it belongs.

**Fix:** Either document explicitly that this is a one-time data migration step and should be commented out after first run, or wrap it in a guard:
```sql
-- One-time migration: align legacy 'lobby' status to 'waiting'.
-- Safe to run repeatedly (no-op if already migrated).
UPDATE rooms SET status = 'waiting' WHERE status = 'lobby';
```
(Already a no-op if no `'lobby'` rows exist; just add a comment so future operators understand the intent.)

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
