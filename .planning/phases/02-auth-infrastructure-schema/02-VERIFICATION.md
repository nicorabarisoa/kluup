---
phase: 02-auth-infrastructure-schema
verified: 2026-06-10T12:00:00Z
status: human_needed
score: 3/5 must-haves verified (2 require live DB / browser verification)
overrides_applied: 0
human_verification:
  - test: "Run full AUTH-04 anonymous game flow"
    expected: "Anonymous player can create room, join, play all round types (A/B/C), reach end screen, and replay — no errors, no regression from middleware JWT-refresh adding latency or silent failures"
    why_human: "middleware.ts now intercepts every non-static request and calls Supabase Auth getUser(). Any misconfiguration (missing env var, unreachable Auth server) silently breaks the game for anonymous users. Cannot verify live request behavior without running the app."
  - test: "Run 02-VALIDATION.md Auth-04 Smoke Test Script steps 1-11 against prod (Railway)"
    expected: "create room → join → voting_question → round_a → round_b2 roulette → round_c (volunteer + roulette paths) → ended screen → Rejouer → back to lobby → second game launches, votes accepted with no UNIQUE constraint error"
    why_human: "Requires real Supabase project, real browser, two devices/tabs. This is the canonical cross-phase regression gate. The plans explicitly deferred this to plan 02-04 which was never created as a formal plan."
  - test: "Confirm migration 002-auth.sql was applied to the live Supabase project"
    expected: "SQL query on Supabase: SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='players' AND column_name='user_id'; returns user_id | YES. user_session_stats table exists with user_session_stats_unique UNIQUE index."
    why_human: "The SQL migration file is correct on disk but cannot be verified as applied to the live DB without a Supabase client connection. Plans 01/02/03 produce SQL/code files only — pushing the migration was flagged as [BLOCKING] plan 02-04, which was never created or executed. If the migration is not on the live DB, SC#4 and SC#5 are not met."
  - test: "Verify GET /auth/callback live behavior for both code-present and code-absent cases"
    expected: "GET /auth/callback (no ?code) -> 302 redirect to /. GET /auth/callback?code=invalid -> logs error server-side only, 302 redirect to /. No 500, no error exposed to browser."
    why_human: "Route Handler behavior requires a live Next.js deployment and HTTP client. Cannot invoke server-side Next.js routes from a grep check."
  - test: "Confirm middleware JWT-refresh does not degrade /api/health response time or cause health check failures"
    expected: "GET /api/health still returns HTTP 200 {status:ok,uptime:N} within normal latency. Review notes this endpoint is now subject to the Supabase Auth getUser() call on every probe."
    why_human: "Latency and uptime impact require a live deployment observation, not static analysis."
---

# Phase 02: Auth Infrastructure + Schema — Verification Report

**Phase Goal:** Auth plumbing is live and the DB schema is ready for signed-in players — without touching the anonymous game flow.
**Verified:** 2026-06-10
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An anonymous player can create a room, join, play through all round types, reach the end screen, and replay — with no regression | ? UNCERTAIN | Code: middleware passes anonymous requests through (`getUser()` returns `{ user: null }` silently). Functionally correct per code review. Cannot verify live app behavior without running the game against Supabase. |
| 2 | `middleware.ts` silently refreshes tokens on every navigation; anonymous requests pass through unchanged | ? UNCERTAIN | Code: `let supabaseResponse`, `getUser()` (not `getSession()`), correct cookie adapter wiring. Static-asset-excluding matcher confirmed. Live behavior requires human smoke test. |
| 3 | `GET /auth/callback` exchanges a PKCE code and sets a session cookie without crashing for both authenticated and unauthenticated requests | ? UNCERTAIN | Code: `exchangeCodeForSession(code)`, silent redirect to `/` on success, error, and missing code. Error logged server-side only. Cannot invoke live Route Handler without deployment. |
| 4 | The `players` table has a nullable `user_id` column; existing anonymous player rows are unaffected | ? UNCERTAIN | Migration file `supabase/migrations/002-auth.sql` contains correct `ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`. Schema.sql mirrors it. Whether the migration was applied to the live Supabase DB is unverifiable programmatically — no evidence plan 02-04 (the [BLOCKING] push gate) was ever executed. |
| 5 | The `user_session_stats` table exists with `UNIQUE(user_id, session_id)` and RLS scoped to `auth.uid() = user_id`; the open anon policies on `rooms`, `players`, and `votes` remain in place | ? UNCERTAIN | SQL files are correct and verified. Live DB state unknown (same 02-04 gap). Code verification confirms open anon policies intact in schema.sql. |

**Score:** 3/5 truths have correct code foundations; all 5 require live DB/browser confirmation.

The 3 truths confirmed in code (not needing DB state):

| # | Truth | Code Evidence |
|---|-------|---------------|
| T-A | middleware.ts wires updateSession with correct patterns | `let supabaseResponse`, `getUser()`, static-asset matcher, import from `@/lib/supabase/middleware` — all present |
| T-B | GameState carries session_uuid populated by startGame | `session_uuid: string` in types.ts, `session_uuid: ''` in `makeInitialGameState`, `gs.session_uuid = crypto.randomUUID()` in lobby startGame after `makeInitialGameState`, before DB write |
| T-C | SQL migration is additive-only and preserves open anon policies | 002-auth.sql contains zero `ALTER TABLE rooms`, zero `DROP POLICY ... ON rooms/votes`, zero `ALTER ... host_id`; schema.sql retains `rooms_select USING (true)`, `players_select USING (true)`, `votes_select USING (true)` |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/002-auth.sql` | Additive migration with user_id FK + user_session_stats + scoped RLS | VERIFIED | Contains all required patterns: `ADD COLUMN IF NOT EXISTS user_id`, `REFERENCES auth.users(id) ON DELETE SET NULL`, `CREATE TABLE IF NOT EXISTS user_session_stats`, `UNIQUE (user_id, session_id)`, `ENABLE ROW LEVEL SECURITY`, `auth.uid() = user_id` on all 3 policies |
| `supabase/schema.sql` | Updated canonical idempotent source with Phase 2 additions | VERIFIED | Contains all Phase 2 additions at correct section positions; open anon SELECT policies on rooms/players/votes confirmed present |
| `lib/supabase/server.ts` | async createClient() server-side factory | VERIFIED | Exports `createClient` (async), imports `createServerClient` from `@supabase/ssr`, `cookies` from `next/headers`, contains `await cookies()`, correct getAll/setAll adapter with try/catch |
| `lib/supabase/middleware.ts` | updateSession(request) JWT refresh helper | VERIFIED | Exports `updateSession`, uses `let supabaseResponse` (not const), calls `await supabase.auth.getUser()`, no `getSession()` or `getClaims`, correct double-cookie-write pattern |
| `middleware.ts` | Root Next.js middleware with static-asset-excluding matcher | VERIFIED | Imports `updateSession` from `@/lib/supabase/middleware`, exports `middleware` and `config`, matcher excludes `_next/static`, `_next/image`, `favicon.ico`, image extensions |
| `app/auth/callback/route.ts` | PKCE code-exchange GET Route Handler | VERIFIED | Exports `async function GET`, reads `code` from `searchParams`, redirects to `/` when absent, calls `exchangeCodeForSession(code)`, logs error server-side, redirects to `/` on both success and error, contains `await cookies()` |
| `lib/types.ts` | GameState.session_uuid field | VERIFIED | `session_uuid: string` present (not `string \| null`), after `b2_revealed: boolean` |
| `lib/game.ts` | session_uuid initialized to '' in makeInitialGameState | VERIFIED | `session_uuid: ''` in makeInitialGameState return object; `crypto.randomUUID` NOT called in game.ts (confirmed absent) |
| `app/room/[code]/lobby/page.tsx` | crypto.randomUUID() assigned in startGame | VERIFIED | `gs.session_uuid = crypto.randomUUID()` present immediately after `makeInitialGameState(candidates)`, before supabase room update; `supabase.from('votes').delete().eq('room_id', roomId)` purge preserved |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | `lib/supabase/middleware.ts` | `import { updateSession }` | WIRED | Confirmed at line 2 of middleware.ts |
| `app/auth/callback/route.ts` | `@supabase/ssr` | `exchangeCodeForSession` | WIRED | Present at line 37 of route.ts |
| `app/room/[code]/lobby/page.tsx` | `lib/game.ts` | `makeInitialGameState` then `gs.session_uuid = crypto.randomUUID()` | WIRED | `makeInitialGameState` imported and called at line 143; `gs.session_uuid` assigned at line 144 |
| `supabase/migrations/002-auth.sql` | `supabase/schema.sql` | Identical additive SQL reflected in both | WIRED | Both contain `user_session_stats_unique` UNIQUE constraint and identical column definitions |
| `@supabase/ssr` | `package.json` | npm dependency | WIRED | `"@supabase/ssr": "^0.12.0"` present in dependencies (plan specified 0.10.3; installed version is ^0.12.0 — minor version advance, still compatible) |

### Data-Flow Trace (Level 4)

Not applicable to this phase. No components rendering dynamic data were introduced. All new artifacts are plumbing-layer (SQL migration, server utilities, middleware, route handler, type field, initializer line). No React rendering paths were added.

### Behavioral Spot-Checks

Step 7b skipped for SQL and server-side files — spot-checks would require a running Next.js server with live Supabase credentials. The only runnable check (file content assertions) was performed inline above.

### Probe Execution

No `scripts/*/tests/probe-*.sh` files were declared or found. This phase does not use the conventional probe pattern. Step 7c: SKIPPED (no probes declared or found).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IDEN-01 | 02-01, 02-03 | `players` table has nullable `user_id` FK; anonymous players have null | UNCERTAIN | SQL files correct; live DB push unverified (plan 02-04 gap) |
| AUTH-02 | 02-02 | Auth session persists across browser refresh and page navigation | UNCERTAIN | `lib/supabase/middleware.ts` correct; live behavior needs human smoke test |
| AUTH-04 | 02-02 | Full anonymous game flow works without regression after every phase touching RLS or auth config | UNCERTAIN | Code analysis shows no regressions in existing files; middleware wiring correct; live regression test (the AUTH-04 smoke script in 02-VALIDATION.md) has not been run — no evidence it was executed |

All three requirements from the phase's PLAN frontmatter are accounted for. No orphaned requirements found — REQUIREMENTS.md maps IDEN-01, AUTH-02, AUTH-04 to Phase 2 and no other Phase 2 requirement IDs exist.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX markers | — | None |
| — | — | No stub returns (return null / return {} / return []) | — | None |
| — | — | No placeholder comments | — | None |
| `lib/game.ts` | 8 | Biased `sort(() => Math.random() - 0.5)` shuffle | INFO (pre-existing) | Pre-existing pattern — not introduced by this phase, not modified by this phase. Flagged in 02-REVIEW.md as CR-01. Not a Phase 2 regression. |
| `middleware.ts` | 12 | Health endpoint `/api/health` included in middleware matcher | INFO | Every health probe now triggers a Supabase Auth `getUser()` call. Minor latency/dependency risk. Flagged in 02-REVIEW.md as IN-02. No formal follow-up reference — informational only. |

No BLOCKER-level debt markers found. The only anti-patterns are pre-existing (`shuffle` in game.ts) or informational (health endpoint in matcher). Neither was introduced by this phase in a way that blocks the phase goal.

---

### Human Verification Required

#### 1. AUTH-04 Full Anonymous Game Flow Regression

**Test:** Open the deployed app in a private/incognito window. Run the full smoke test from `02-VALIDATION.md`:
1. Create a room (host)
2. Open second device/tab, join the room
3. Start the game
4. Play: voting_question → round_a_vote → round_a_reveal
5. Continue: round_b_vote → round_b2_roulette
6. Continue: round_c_choice → volunteer path AND separately roulette path
7. Continue until ended (7 rounds or "End session")
8. Verify end screen with stats and group title
9. Host clicks "Rejouer" → back to lobby, new theme
10. Start second game — verify votes accepted (no UNIQUE constraint error)

**Expected:** All steps complete without errors. No 500s, no Supabase errors in console, no broken state after replay.

**Why human:** middleware.ts now runs `getUser()` on every page navigation. Any misconfiguration of `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Railway would silently break this flow. Cannot replicate a live networked Supabase + browser environment in static analysis.

---

#### 2. Live DB Migration Confirmation

**Test:** In the Supabase Dashboard SQL Editor (or via psql), run:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'players' AND column_name = 'user_id';
-- Expected: user_id | uuid | YES

SELECT table_name FROM information_schema.tables WHERE table_name = 'user_session_stats';
-- Expected: 1 row

SELECT indexname FROM pg_indexes WHERE tablename = 'user_session_stats';
-- Expected: index on user_id + session_id (UNIQUE)

SELECT COUNT(*) FROM players WHERE user_id IS NOT NULL;
-- Expected: 0 (all pre-migration rows have NULL)
```

**Expected:** All four queries return expected results.

**Why human:** The migration file `supabase/migrations/002-auth.sql` is authored correctly and ready to execute. However, plans 01/02/03 all explicitly state "this plan does NOT execute [the migration] against the live DB" and refer to a future plan 02-04 marked [BLOCKING] for the actual DB push. Plan 02-04 was never created as a file and the ROADMAP says 3/3 plans complete. Whether the migration was pushed manually (outside the plan system) cannot be determined from the codebase. This must be confirmed by a human with Supabase Dashboard access.

---

#### 3. GET /auth/callback Live Behavior

**Test:**
- Request `GET {app-domain}/auth/callback` (no query params) → should get 302 to `/`, no 500
- Request `GET {app-domain}/auth/callback?code=invalid_test_code` → should get 302 to `/`, error logged server-side only

**Expected:** Both requests return HTTP 302 redirecting to `/`. No error detail exposed in the response body or redirect URL. Server logs show `[auth/callback] exchangeCodeForSession error:` for the invalid code case.

**Why human:** Route Handler behavior requires a live deployed Next.js app. Cannot invoke server-side routes from static analysis.

---

#### 4. Middleware JWT Refresh Live Confirmation

**Test:** On a device where Google OAuth is configured (even if Phase 3 sign-in UI hasn't shipped yet — can test via Supabase Dashboard magic link or direct token injection): sign in, navigate multiple pages, refresh the browser. Verify the session cookie is refreshed and the user remains authenticated.

**Expected:** Session persists across navigation and refresh without the user re-authenticating.

**Why human:** Requires a live Supabase Auth session and browser. AUTH-02 cannot be satisfied without this test passing.

---

#### 5. /api/health Not Degraded by Middleware

**Test:** Time several `GET /api/health` requests before and after deployment. Confirm response time is still <200ms and no `500` or `503` responses appear under normal conditions.

**Expected:** Health endpoint continues to respond with `{"status":"ok","uptime":N}` within acceptable latency. Middleware now calls Supabase Auth on every probe — if Auth is slow/down, probes may fail.

**Why human:** Latency measurement requires a live environment.

---

### Gaps Summary

No code-level gaps found — all artifacts exist, are substantive, and are correctly wired. The phase goal is blocked at the human verification stage for two reasons:

1. **Live DB push unconfirmed:** The migration file is correct, but the [BLOCKING] plan 02-04 (push to live Supabase) was referenced in all three summaries and never executed as a formal plan. Success Criteria 4 and 5 depend on the migration being applied to the live DB. The ROADMAP updated "3/3 plans complete" without this gate being met.

2. **AUTH-04 regression test never run:** The validation document specifies a mandatory AUTH-04 smoke test after every DB migration and middleware deployment. No evidence exists that this test was executed. The anonymous game flow correctness (SC#1) cannot be confirmed without it.

These are not code failures — the code is correct. They are operational/process gaps that require a human with access to the live environment to close.

---

_Verified: 2026-06-10_
_Verifier: Claude (gsd-verifier)_
