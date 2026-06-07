# Pitfalls Research

**Domain:** Adding optional Supabase Auth (Google OAuth) to an anonymous-first Next.js party game
**Researched:** 2026-06-07
**Confidence:** HIGH (Supabase official docs + GitHub issues + project-specific codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: RLS Policy Migration Locks Out All Anonymous Players

**What goes wrong:**
Adding an authenticated-user RLS policy on `players` or `rooms` without keeping the open `anon` policy causes every non-authenticated player action to silently return 0 rows or fail with a PostgREST 406/403. The anonymous game appears to work on the surface (no JS crash), but players cannot join, votes are not recorded, and game state does not advance. This is the same root cause as the "Room introuvable" bug already documented in CLAUDE.md — and it will happen again if policies are tightened carelessly.

**Why it happens:**
The natural migration instinct is to replace the `USING (true)` open policy with a `USING (auth.uid() = user_id)` check. But `auth.uid()` returns `NULL` for the `anon` role, and `NULL = anything` is always false in Postgres. The result: every anonymous query is silently rejected.

**How to avoid:**
Keep the `anon` role explicitly covered with a separate, open policy using the `TO anon` clause. Do not modify or drop the existing open policies until anon access is intentionally being removed (which is not part of this milestone). The pattern for the `players` table:

```sql
-- existing open anon policy — DO NOT REMOVE
CREATE POLICY "anon_full_players" ON players
  TO anon
  USING (true)
  WITH CHECK (true);

-- new auth-scoped policy (additive, not a replacement)
CREATE POLICY "auth_own_player" ON players
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);
```

For this milestone, the safest approach is to leave existing policies entirely untouched and only add NEW policies for authenticated operations (stats writes, profile reads).

**Warning signs:**
- Players cannot join rooms (join page hangs or redirects unexpectedly)
- Vote inserts silently fail (no console error, but `voteCount` never increments)
- `console.log('[join] lookup:')` returns an empty array in the browser devtools
- Room creation from the landing page appears to succeed but room lookup immediately returns nothing

**Phase to address:**
First phase of the milestone (DB schema + RLS setup). Must be validated with a real anonymous join before proceeding.

---

### Pitfall 2: PKCE Code Verifier Lost — OAuth Callback Silently Fails

**What goes wrong:**
Google OAuth with Supabase uses PKCE flow. The code verifier is stored in a cookie during the redirect to Google. If that cookie is not set or is lost (third-party cookie blocking, Safari ITP, the user switches devices, or the callback URL is on a different subdomain than the origin), the code exchange in `app/auth/callback/route.ts` fails with "invalid grant" or "code verifier mismatch". The user lands on the callback route, the exchange fails, and they end up unauthenticated with no visible error.

**Why it happens:**
Kluup is currently all `'use client'` — no middleware, no server components. The standard `@supabase/ssr` middleware that manages cookie refresh does not exist. The callback route must be a Next.js Route Handler (server-side), not a client component, because `exchangeCodeForSession` needs to set `httpOnly` cookies that the browser cannot set from client JS. Developers unfamiliar with this will create a client component callback page and wonder why the session is not persisted.

Additionally, the Railway domain (`kluup.app`) must be registered in both the Supabase Auth allowed redirect URLs AND the Google Cloud Console authorized redirect URIs. A mismatch on either side produces "redirect_uri_mismatch" which looks like an OAuth error but is actually a configuration error.

**How to avoid:**
- Create `app/auth/callback/route.ts` as a proper Next.js **Route Handler** (not a page component):

```typescript
// app/auth/callback/route.ts — server-side Route Handler
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(),
                   setAll: (cs) => cs.forEach(c => cookieStore.set(c)) } }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/?error=auth`)
}
```

- Install `@supabase/ssr` alongside the existing `@supabase/supabase-js`. The existing `lib/supabase.ts` `createClient` is fine for all game operations; `@supabase/ssr` is needed only for the callback route and any future server-side auth reads.
- Register `https://kluup.app/auth/callback` in both Supabase Dashboard → Authentication → URL Configuration, and Google Cloud Console → OAuth Client → Authorized redirect URIs.
- Register `http://localhost:3000/auth/callback` separately for local dev.

**Warning signs:**
- Browser console shows "invalid grant" or "pkce_code_verifier" in the OAuth error response
- User is redirected to callback route but `supabase.auth.getUser()` returns null immediately after
- Safari users fail to authenticate while Chrome users succeed (third-party cookie blocking)
- The redirect URL in the error message does not exactly match what is registered in Google Console

**Phase to address:**
Auth integration phase. Must be end-to-end tested on Safari iOS before shipping.

---

### Pitfall 3: Supabase Realtime Channels Disconnect When JWT Expires During a Game

**What goes wrong:**
When an authenticated user is in the middle of a game (which can last 20–40 minutes), their Supabase access token (default TTL: 1 hour, but can be shorter if configured) may expire. The Realtime WebSocket connection is terminated when the JWT expires, with the server sending a disconnect. The `@supabase/supabase-js` client auto-refreshes access tokens for REST API calls, but it does NOT automatically re-subscribe expired Realtime channels with the new token. The channel goes silent: the user no longer receives `phase_changed` broadcasts, `postgres_changes` events, or presence updates. From their perspective, the game simply freezes — other players advance, but their screen stays stuck.

**Why it happens:**
Realtime authorization is separate from REST authorization. The Realtime server requires a new JWT to be sent via an `access_token` message when the old one expires. This must be done explicitly. The `supabase-js` SDK does not wire this up automatically for existing channel subscriptions (confirmed in supabase/realtime-js#274, affecting SDK v2.x).

**How to avoid:**
Listen for `onAuthStateChange` events with the `TOKEN_REFRESHED` event type, and call `supabase.realtime.setAuth(newToken)` to push the refreshed token to all active Realtime connections:

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
    }
  )
  return () => subscription.unsubscribe()
}, [])
```

Place this in `app/room/[code]/game/page.tsx` (the long-lived game page). Anonymous users are unaffected because they use the anon key, which does not expire.

**Warning signs:**
- Game screen freezes for one player while others continue advancing
- No Realtime events received after ~1 hour of play (no `phase_changed`, no vote count updates)
- Browser devtools WebSocket tab shows the connection closed with a 1008/1009 close code
- `onAuthStateChange` fires `TOKEN_REFRESHED` but vote progress does not resume

**Phase to address:**
Auth integration phase. Specifically during the Realtime subscription setup in game page modifications.

---

### Pitfall 4: Stats Double-Counted on Game Replay

**What goes wrong:**
Kluup already has a documented replay bug: replaying without purging votes caused duplicate vote entries. The same category of bug applies to stats: if personal stats are written to a `user_stats` table at end-of-session and the player uses "Rejouer" (which returns to lobby without reloading the page), the end screen is re-reached and stats are written again for the same logical session — doubling designation counts, confession reveals, volunteer counts, etc.

**Why it happens:**
The end screen (`EndScreen` component) in `game/page.tsx` accumulates stats from `game_state.stats` (the jsonb on the room row). If the stat-write trigger fires on every render of the end screen, and the player navigates lobby → game → end screen again with stats from the new game, any idempotency constraint on the stats table will either silently ignore the second write (losing real data from game 2) or allow it (double-counting game 1 data if the room_id/round data is the same).

**How to avoid:**
Design the stats write as a one-time fire using a dedicated `session_id` (can be `room.id + '_' + timestamp_of_game_start` stored in `game_state`). Use `UPSERT` with `ON CONFLICT (user_id, session_id) DO NOTHING` semantics:

```sql
CREATE TABLE user_session_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  -- stat columns...
  UNIQUE(user_id, session_id)
);
```

The stat write in `onEndGame` checks a React ref `statsWrittenRef.current` before calling Supabase, setting it to `true` after the first successful write. On `returnToLobby`, the ref is cleared (or a new `session_id` is generated for the next game).

Also: existing `votes.delete().eq('room_id', ...)` on replay already clears votes. Stats must be written BEFORE this purge if they depend on votes, or use the already-accumulated `game_state.stats` jsonb (which is already the correct source of truth).

**Warning signs:**
- User's designation count doubles after each replay
- Stats profile page shows inflated numbers after a multi-game evening
- `user_session_stats` table has multiple rows for the same `user_id` and `room_id` after a replay session

**Phase to address:**
Stats persistence phase. Schema design must include the `UNIQUE(user_id, session_id)` constraint from day 1.

---

### Pitfall 5: localStorage Player Identity Conflicts With Auth Identity

**What goes wrong:**
The current identity system uses `localStorage` key `kluup_pid_<CODE>` to store a UUID per room. When an authenticated user plays on Device A and then tries to join the same room on Device B (or after clearing browser storage), `getPlayerId(code)` returns null on Device B, so the join flow creates a new `players` row. The room now has two rows for the same Google account: one with `user_id = X` (Device A) and one with `user_id = X` (Device B, or `user_id = NULL` if the auth context was not loaded before join). The vote threshold is `players.length`, so phantom duplicate rows break the vote completion check.

**Why it happens:**
localStorage is device-local and does not sync. The player identity is intentionally tied to localStorage for the anonymous case (reconnect without duplicate rows). When auth is added, the app has two identity systems that can diverge: `user_id` (auth, global) and `kluup_pid_<CODE>` (localStorage, local). If they are not reconciled at join time, they produce duplicate rows.

**How to avoid:**
At join time (`app/join/page.tsx` and lobby redirect), after resolving the auth session:
1. Check `getPlayerId(code)` from localStorage first (existing behavior).
2. If null, check if there is already a `players` row for this room where `user_id = auth.uid()` (new check for authenticated users).
3. If found, reuse that row's `id` and write it to `setPlayerId(code, existingRow.id)` to re-anchor the localStorage identity.
4. Only insert a new row if neither lookup finds a match.

This reconciliation prevents the two-device duplicate row problem for authenticated users while keeping anonymous flow unchanged (step 2 finds nothing, so step 4 runs normally).

**Warning signs:**
- Players appear twice in the lobby roster with the same pseudo
- Vote threshold (`players.length`) is 2 higher than expected
- The duplicate player row has `user_id` set on one entry and `NULL` on the other

**Phase to address:**
Auth integration phase, specifically in the join flow (`app/join/page.tsx`).

---

### Pitfall 6: Middleware Token Refresh Required for Cookie-Based Sessions

**What goes wrong:**
The Supabase recommended pattern for Next.js App Router requires a `middleware.ts` file to refresh expired auth tokens and write updated cookies. Without it, a user who signs in, closes their laptop for a few hours, and then reopens the game will appear signed out — even though their refresh token is valid. The middleware is the only place in the App Router that can both read AND write cookies, making it the necessary proxy for token refresh. Without this file, sessions expire after the access token TTL (default: 1 hour) regardless of the refresh token's validity.

**Why it happens:**
Kluup currently has zero server-side code (`'use client'` everywhere, no middleware). The temptation is to handle auth entirely client-side with `createBrowserClient`. This works for the initial sign-in but fails to keep sessions alive across navigation because the token refresh runs in the browser but the new cookie cannot be propagated back to server routes (Route Handlers like `/auth/callback`).

**How to avoid:**
Create `middleware.ts` at project root with a minimal token-refresh-only setup. This is not a route guard (anonymous access must remain unrestricted) — it only refreshes cookies:

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => cs.forEach(c => supabaseResponse.cookies.set(c)),
      },
    }
  )
  // refresh session if expired — required for SSR cookie sync
  await supabase.auth.getUser()
  return supabaseResponse
}

// only run on relevant paths — do NOT run on static assets
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

Key: this middleware does NOT block or redirect any routes. It only refreshes the token. Route protection is handled client-side via the existing `'use client'` components.

**Warning signs:**
- User signs in successfully, refreshes the page, and is shown as signed out
- `supabase.auth.getUser()` returns null after navigating to a new page despite a recent sign-in
- Stats profile page shows empty data because the auth session was not available when the page loaded

**Phase to address:**
Auth integration phase — must be the first thing set up before any auth-dependent features.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip middleware, handle auth client-only via `onAuthStateChange` | Avoids adding server code to a `'use client'` codebase | Sessions expire after 1 hour; stats profile requires page reload after sign-in | Only acceptable if session duration > 1 hour is tolerable and no server-side auth reads are ever needed |
| Write stats on every `EndScreen` mount without idempotency guard | Simple code | Double-counting after replay, inflated lifetime stats | Never — the unique constraint is not optional |
| Use `service_role` key client-side to bypass RLS during development | Unblocks development fast | Exposes master key; bypasses the exact security layer being tested | Never in client code — use only in server-side scripts |
| Store `user_id` in `players` but not index it | Avoids migration complexity | RLS policy `user_id = auth.uid()` triggers full table scan at scale | Acceptable at MVP scale (<1000 concurrent games); add index before public launch |
| Use a single `createClient` (existing `lib/supabase.ts`) for all operations including auth callback | No new file | Auth callback cannot set httpOnly cookies; session is not persisted server-side | Never — the callback route MUST use `@supabase/ssr`'s `createServerClient` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth redirect | Registering only `kluup.app` without the `/auth/callback` path in Google Console | Register the full callback URL: `https://kluup.app/auth/callback` in both Google Console and Supabase Dashboard |
| `@supabase/ssr` | Installing it and calling `createServerClient` from a `'use client'` component | `createServerClient` is for Route Handlers and Server Components only; use `createBrowserClient` in client components |
| Realtime + auth token | Letting the SDK manage token refresh without wiring it to Realtime | Call `supabase.realtime.setAuth(token)` in the `TOKEN_REFRESHED` auth state change handler |
| RLS policy audit | Running `schema.sql` (which uses `CREATE TABLE IF NOT EXISTS`) to add new policies | Use `ALTER TABLE` or `CREATE POLICY` statements directly; `CREATE TABLE IF NOT EXISTS` silently no-ops on an existing table |
| `user_id` FK on `players` | Adding a `NOT NULL` constraint on `user_id` for "cleanliness" | Keep `user_id` nullable — anonymous players always have `NULL`; making it NOT NULL breaks the entire anonymous game |
| Stats write timing | Writing stats inside `useEffect` that fires when `phase === 'ended'` | Stats write inside the effect will re-fire on component remount (e.g. hot reload, tab focus); use a `statsWrittenRef` guard |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `players.user_id` | `user_id = auth.uid()` RLS policy causes full table scan | `CREATE INDEX idx_players_user_id ON players(user_id)` | At ~10,000 players rows (many sessions accumulated) |
| No index on `user_session_stats.user_id` | Stats profile page slow to load | `CREATE INDEX idx_user_session_stats_user_id ON user_session_stats(user_id)` | Noticeable above ~100 completed sessions per user |
| Fetching full vote history to compute stats at display time | Stats profile page takes 2–5s to load | Pre-compute and store aggregates in `user_session_stats` at end-of-game | From the first user with >20 sessions |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tightening RLS policies before the anonymous game is regression-tested | Silent lockout of all players — the game breaks completely | Test anonymous join+play flow in staging after every RLS change, before merging |
| Adding `user_id` as NOT NULL to `players` | Every anonymous player insert fails with constraint error 23502 | `user_id uuid REFERENCES auth.users(id) DEFAULT NULL` — nullable always |
| Reading `supabase.auth.getSession()` in Route Handlers for auth validation | Session from cookie can be spoofed; JWT is not re-validated | Use `supabase.auth.getUser()` in server code — it validates the JWT against Supabase Auth server |
| Exposing `service_role` key in `NEXT_PUBLIC_` env var | Client can bypass all RLS policies | `service_role` key must never be `NEXT_PUBLIC_*`; use only in server-side scripts with `SUPABASE_SERVICE_ROLE_KEY` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Forcing auth before joining a room ("sign in to see stats") | Breaks the frictionless join that is Kluup's core value proposition | Auth must be entirely opt-in, available from a "Save my stats" prompt on the end screen only |
| OAuth redirect during a game (e.g. prompted mid-round) | Player loses game state, others are blocked waiting | Only allow sign-in from non-game screens (landing, end screen, profile page); never trigger OAuth from lobby or game |
| "Sign in with Google" button with no explanation | Players don't know why they'd sign in | Label and context: "Create a free account to track your stats across sessions" |
| Showing auth errors to players who are anonymous | Confusing — they don't know what "session expired" means | Auth error states must only appear on auth-optional screens (profile, end screen CTA); never inside the game |
| Requiring a page reload after sign-in to see stats | Jarring UX | Use `onAuthStateChange` to reactively update the end screen stats CTA when auth state changes |

---

## "Looks Done But Isn't" Checklist

- [ ] **Anonymous game unchanged:** After adding auth, verify a full anonymous game session (create room → join → 7 rounds → end screen → replay) with browser devtools Network tab open, confirming zero 403/406 responses on any Supabase request.
- [ ] **OAuth callback on Safari iOS:** Test the Google sign-in flow specifically on Safari iOS (strict ITP cookie policy) — Chrome passing is not sufficient.
- [ ] **Token refresh in long game:** Verify that a game lasting >60 minutes does not freeze for an authenticated user; manually shorten JWT TTL to 5 minutes in Supabase Auth settings for testing.
- [ ] **Duplicate player row on two-device join:** Sign in on Device A, join a room as an authenticated player; then join the same room on Device B with the same Google account and verify that only one `players` row exists.
- [ ] **Stats not double-counted after replay:** Play a full game, replay it, and verify that `user_session_stats` has exactly 2 rows (not 4) and that the counts reflect real totals.
- [ ] **Stats profile RLS:** Verify that `SELECT` on `user_session_stats` returns only the authenticated user's own rows and returns zero rows (not an error) for anonymous users.
- [ ] **Redirect URL in Railway:** After adding the callback route, redeploy (not just restart) Railway to bake in any new env vars; verify `/auth/callback` is reachable at `https://kluup.app/auth/callback` returning the expected redirect behavior.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS lockout of anonymous players | HIGH (production outage) | Immediately run `supabase/rls.sql` (already in repo) to restore open anon policies; then diagnose what policy change caused the lockout |
| PKCE cookie verifier lost | LOW | User simply retries sign-in; the auth code is single-use and 5-minute TTL, so there is no stale-code accumulation risk |
| Realtime channel silent after token expiry | MEDIUM (frustrating UX, not data loss) | The game can continue after the authenticated user manually refreshes the page; long-term fix: add the `TOKEN_REFRESHED` → `setAuth` handler |
| Stats double-counted | MEDIUM (data cleanup required) | Write a one-time SQL migration to deduplicate `user_session_stats` by keeping `MAX(id)` per `(user_id, session_id)` grouping |
| Duplicate player row on multi-device join | MEDIUM (breaks vote threshold) | The existing ghost-pruning system (usePresence) will eventually remove the second row after 60s grace; short-term fix is host pressing "Passer sans attendre" |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS lockout of anonymous players | Phase 1: DB schema + RLS setup | Anonymous join test passes after every policy change |
| PKCE callback failure | Phase 1: OAuth setup + callback route | Full OAuth flow on Chrome + Safari iOS |
| Realtime disconnect on token expiry | Phase 1: Auth integration in game page | Confirmed via short-TTL JWT test in staging |
| Stats double-counted on replay | Phase 2: Stats persistence schema | `UNIQUE(user_id, session_id)` constraint + replay test |
| localStorage / auth identity conflict | Phase 1: Join flow reconciliation | Two-device join test with same Google account |
| Middleware missing for session persistence | Phase 1: Middleware setup (before anything else) | Sign in → navigate away → return → still authenticated |

---

## Sources

- Supabase RLS official docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth + Next.js App Router: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase PKCE flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase anonymous sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous
- GitHub issue — Realtime token not refreshed after standby: https://github.com/supabase/realtime-js/issues/274
- Kluup project codebase: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/INTEGRATIONS.md`
- CLAUDE.md (project source of truth) — "Room introuvable" root cause, host_id NOT NULL precedent, replay vote purge bug

---

*Pitfalls research for: optional Supabase Auth on anonymous-first Next.js party game (Kluup v2.0)*
*Researched: 2026-06-07*
