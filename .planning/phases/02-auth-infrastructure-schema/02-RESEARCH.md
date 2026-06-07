# Phase 2: Auth Infrastructure + Schema - Research

**Researched:** 2026-06-07
**Domain:** Supabase Auth SSR, Next.js 16 App Router middleware, PostgreSQL schema migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Session ID Strategy:** Add `session_uuid` (UUID v4) to `rooms.game_state` jsonb, generated via `crypto.randomUUID()` inside `startGame`. This field serves as the `session_id` for `user_session_stats` in Phase 4. It is reset automatically on every replay because `startGame` already resets `game_state`. No new DB columns required for session tracking.
- **D-02 Dashboard Setup:** Phase 2 includes a manual BLOCKING task: configure Google OAuth in the Supabase Dashboard (enable Google provider, add redirect URL `https://{app-domain}/auth/callback`). This enables smoke-testing the full PKCE callback flow within Phase 2, before Phase 3 adds the sign-in button.

### Claude's Discretion

- **SQL migration approach:** create `supabase/migrations/002-auth.sql` as a standalone migration with only the new changes (ALTER TABLE players ADD COLUMN user_id, CREATE TABLE user_session_stats). Also update `supabase/schema.sql` idempotently to reflect the final desired state of the DB.
- **Auth client library:** use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`). Creates a server-side Supabase client alongside the existing `lib/supabase.ts` client-only instance.
- **Middleware matcher:** run on all paths except `/_next/static`, `/_next/image`, `favicon.ico`, and other static assets. Anonymous requests pass through unchanged.
- **Callback error handling:** on missing `code` param or auth error, redirect silently to `/`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDEN-01 | `players` table has a nullable `user_id` FK — anonymous players have null, signed-in players reference their account | Schema migration pattern: `ALTER TABLE players ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` — nullable, no existing rows affected |
| AUTH-02 | Auth session persists across browser refresh and page navigation | `@supabase/ssr` middleware with `createServerClient` + `getUser()` call refreshes JWT on every request and writes updated session cookies — browser refresh reads the refreshed cookie |
| AUTH-04 | Full anonymous game flow works without regression after every phase that touches RLS or auth configuration | `getUser()` returns `{ data: { user: null }, error: null }` for anonymous requests — no error thrown, no redirect; existing open anon RLS policies on rooms/players/votes remain untouched |
</phase_requirements>

---

## Summary

Phase 2 installs the auth plumbing layer — the `@supabase/ssr` server-side client, `middleware.ts` for silent JWT refresh on every navigation, `app/auth/callback/route.ts` for PKCE code exchange, and the two DB changes (`players.user_id` nullable FK, `user_session_stats` table). No sign-in UI ships in this phase.

The critical constraint is that the existing fully-client-side app (`'use client'` pages, `lib/supabase.ts` browser client) must remain completely unaffected. Middleware and the callback route handler will be the only server-side code in the app. The middleware runs on every request but does nothing for anonymous users beyond returning a pass-through response — `getUser()` returns `{ user: null }` silently when no session cookie is present.

The DB migration is additive-only: adding a nullable column and a new table cannot break existing anon queries. The highest ongoing risk is an accidental RLS policy change that locks out anonymous reads — the phase verification must run the full anonymous game flow (create room, join, all round types, end screen, replay) after every schema change.

**Primary recommendation:** Implement the three server files (`lib/supabase/server.ts`, `lib/supabase/middleware.ts`, root `middleware.ts`) and the callback route using the patterns confirmed from `@supabase/ssr@0.10.3` docs, then run the anonymous smoke test before closing the phase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT session refresh | Frontend Server (middleware) | — | Only server-side code can write HTTP-only cookies; client cannot |
| PKCE code exchange | Frontend Server (Route Handler) | — | Code must be exchanged server-side before setting session cookie |
| Anonymous game flow (all existing routes) | Browser / Client | — | All current pages are `'use client'`; no change needed |
| DB schema changes (nullable FK, new table) | Database / Storage | — | Pure SQL migration; no application tier change required |
| `session_uuid` generation | Browser / Client | — | `crypto.randomUUID()` called in `startGame()` on the client, written into `game_state` jsonb |
| Auth session persistence | Browser / Client + Frontend Server | — | Middleware writes refreshed cookie; client reads it on next request |

---

## Standard Stack

### Core (this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.10.3 | Server-side Supabase clients for middleware and Route Handlers | Official Supabase package for SSR; replaces deprecated `@supabase/auth-helpers-nextjs` |
| `@supabase/supabase-js` | 2.107.0 (already installed) | Client-side Supabase client (no change) | Already installed; `@supabase/ssr@0.10.3` peer-requires `>= 2.105.3` — version 2.107.0 satisfies this |

### Already Present (no install needed)

| Library | Version | Notes |
|---------|---------|-------|
| `next` | 16.2.7 | App Router, Route Handlers, middleware — all required APIs present |
| `@supabase/supabase-js` | 2.107.0 | `getClaims()` introduced; available in this version |
| `typescript` | ^5 | No new type dependencies needed |

### Installation

```bash
npm install @supabase/ssr
```

**Version verified:** `npm view @supabase/ssr version` → `0.10.3` [VERIFIED: npm registry]

**Peer dependency check:** `@supabase/ssr@0.10.3` requires `@supabase/supabase-js >= 2.105.3`. Installed: `2.107.0`. Compatible. [VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | `auth-helpers-nextjs` is deprecated — do not use |
| `getUser()` in middleware | `getClaims()` in middleware | `getClaims()` is faster (local JWT verify, no network call) but does not detect server-side logout. For this phase, the simpler `getUser()` is more correct; `getClaims()` is an optimisation for Phase 3+ when protected routes exist |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/ssr` | npm | ~2.7 yrs (2023-09-06) | High (official Supabase org) | github.com/supabase/ssr | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Postinstall check:** `npm view @supabase/ssr scripts.postinstall` → empty (no postinstall script). [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (all existing 'use client' pages)
  │
  │  HTTP request (every navigation)
  ▼
Next.js Middleware (middleware.ts) ──── NEW
  │  createServerClient(URL, ANON_KEY, { cookies: req/res })
  │  await supabase.auth.getUser()  → silently refreshes JWT if needed
  │  anonymous: { user: null }  →  pass through unchanged
  │  authenticated: refreshed cookie written to response
  ▼
Next.js Route Handler: app/auth/callback/route.ts ──── NEW
  │  (only called when Google OAuth redirects back to the app)
  │  GET ?code=<pkce_code>
  │  createServerClient + await cookies()
  │  supabase.auth.exchangeCodeForSession(code)
  │  redirect → / (success or error, silent)
  ▼
Supabase Auth Server  ←──────────────────────────────────────
  │  (getUser makes network call; exchangeCodeForSession exchanges PKCE)
  ▼
Supabase Postgres
  ├── players (+ nullable user_id column) ──── SCHEMA CHANGE
  └── user_session_stats (new table)       ──── SCHEMA CHANGE
```

### Recommended Project Structure (additions only)

```
lib/
├── supabase.ts           # existing browser client — NO CHANGE
├── supabase/
│   ├── server.ts         # NEW — async createClient() using createServerClient + cookies()
│   └── middleware.ts     # NEW — updateSession(request) helper
middleware.ts             # NEW — project root, calls updateSession, matcher excludes statics
app/
└── auth/
    └── callback/
        └── route.ts      # NEW — PKCE code exchange Route Handler
supabase/
├── schema.sql            # UPDATE — add user_id column + user_session_stats table (idempotent)
├── migrations/
│   └── 002-auth.sql      # NEW — standalone migration (additive only)
```

**Note on file placement:** `lib/supabase/server.ts` lives in a `supabase/` subdirectory of `lib/` to avoid name collision with the existing `lib/supabase.ts` browser client. The existing import path `from '@/lib/supabase'` continues to resolve to the browser client unchanged.

### Pattern 1: Server-side Supabase Client (`lib/supabase/server.ts`)

**What:** Async factory that creates a `@supabase/ssr` server client bound to the Next.js cookie store.
**When to use:** In Route Handlers and middleware — anywhere server-side cookie access is needed.

```typescript
// Source: @supabase/ssr official docs + verified community implementations
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()  // MUST be awaited in Next.js 15+/16

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component: cookie writes are blocked.
            // Middleware will persist any session updates.
          }
        },
      },
    }
  )
}
```

[CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

### Pattern 2: Middleware Session Refresh (`lib/supabase/middleware.ts` + `middleware.ts`)

**What:** `updateSession` creates a server client bound to the request/response cookies and calls `getUser()` to trigger a silent token refresh.
**When to use:** Runs on every navigation. For anonymous requests, `getUser()` returns `{ user: null }` with no error — the request passes through unchanged.

```typescript
// lib/supabase/middleware.ts
// Source: Verified pattern from @supabase/ssr official documentation
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to both the cloned request and the response so cookies
          // are readable by downstream Route Handlers in the same pass.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Triggers token refresh if session cookie is present.
  // Returns { user: null } silently for anonymous requests — no error, no redirect.
  await supabase.auth.getUser()

  return supabaseResponse
}
```

```typescript
// middleware.ts (project root)
// Source: @supabase/ssr official Next.js guide
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

[CITED: supabase.com/docs/guides/auth/server-side/nextjs]

### Pattern 3: PKCE Callback Route Handler (`app/auth/callback/route.ts`)

**What:** Exchanges the PKCE authorization code returned by Google OAuth for a Supabase session.
**When to use:** Google OAuth redirects to `{app-domain}/auth/callback?code=<code>`. This handler exchanges it and redirects to `/`. On error (missing code, exchange failure), redirect silently to `/`.

```typescript
// app/auth/callback/route.ts
// Source: Verified against supabase/auth-js exchangeCodeForSession docs +
// @supabase/ssr server client pattern
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // No code → not a real OAuth callback; redirect silently (per D-02 decision).
  if (!code) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const cookieStore = await cookies()  // MUST be awaited in Next.js 15+/16

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Route Handlers can write cookies, so this should not trigger.
            // Kept for defensive completeness.
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  // Per D-02: redirect silently to / on success or error.
  if (error) {
    // Log server-side but do not expose to client.
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  return NextResponse.redirect(new URL('/', request.url))
}
```

[CITED: supabase.com/docs/reference/javascript/auth-exchangecodeforsession]
[CITED: supabase.com/docs/guides/auth/sessions/pkce-flow]

### Pattern 4: Schema Migration (additive only)

```sql
-- supabase/migrations/002-auth.sql
-- Additive-only migration. Safe to run on a live prod DB.
-- Existing rows are unaffected: new columns default to NULL.

-- IDEN-01: nullable user_id FK on players
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- STAT-03 (Phase 4): user_session_stats table with idempotency constraint
CREATE TABLE IF NOT EXISTS user_session_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL,  -- sourced from game_state.session_uuid
  -- Per-session counters (denormalised for fast profile queries)
  designated_count  int NOT NULL DEFAULT 0,
  confessed_count   int NOT NULL DEFAULT 0,
  volunteered_count int NOT NULL DEFAULT 0,
  group_title       text,
  played_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_session_stats_unique UNIQUE (user_id, session_id)
);

-- RLS for user_session_stats: only the owning user can read/write their rows.
ALTER TABLE user_session_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stats_select_own" ON user_session_stats;
DROP POLICY IF EXISTS "stats_insert_own" ON user_session_stats;
DROP POLICY IF EXISTS "stats_update_own" ON user_session_stats;
CREATE POLICY "stats_select_own" ON user_session_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stats_insert_own" ON user_session_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stats_update_own" ON user_session_stats
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

[ASSUMED: column names and types for `user_session_stats` — Phase 4 will read from `game_state.stats` which contains `SessionStats`; structure here follows the Phase 4 requirements in REQUIREMENTS.md but exact column needs may evolve]

### Pattern 5: GameState Extension for session_uuid (D-01)

```typescript
// lib/types.ts — add to GameState interface
session_uuid: string   // UUID v4, set by startGame(), used as session_id in user_session_stats

// lib/game.ts — add to makeInitialGameState() return
session_uuid: '',      // startGame() overwrites with crypto.randomUUID()

// app/room/[code]/lobby/page.tsx — inside startGame()
const gs = makeInitialGameState(candidates)
gs.session_uuid = crypto.randomUUID()
// then: supabase.from('rooms').update({ game_state: gs, ... })
```

### Anti-Patterns to Avoid

- **Using `@supabase/auth-helpers-nextjs`:** Deprecated. Import from `@supabase/ssr` only.
- **Using `createClient()` from `lib/supabase.ts` in server code:** The existing browser client uses `@supabase/supabase-js` directly and cannot manage cookies. Only the new `lib/supabase/server.ts` client should be used in middleware and Route Handlers.
- **Not awaiting `cookies()` in Next.js 15+/16:** `cookies()` from `next/headers` is async in Next.js 15+. Must be `await cookies()`. Forgetting this causes a hard runtime error.
- **Adding RLS policies that restrict anon on rooms/players/votes:** Any `USING (auth.uid() IS NOT NULL)` on those tables breaks the anonymous game flow. The new `user_session_stats` table has strict RLS; existing tables keep their open anon policies.
- **Using `getSession()` instead of `getUser()`:** `getSession()` is deprecated for server-side use in `@supabase/ssr` — it reads the session from storage without server-side validation. Always use `getUser()` on the server.
- **Calling `supabase.auth.getClaims()` in middleware for this phase:** `getClaims()` is a performance optimisation (no network call) but does not detect server-side logout. Correct for this phase to use `getUser()` which makes the authoritative check.
- **Generating `session_uuid` in `makeInitialGameState()` directly:** The initial state must have `session_uuid: ''` (empty string, not a UUID) so that replays that reset `game_state` via `makeInitialGameState` + overwrite by `startGame` work correctly. Only `startGame` should call `crypto.randomUUID()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-safe JWT storage for SSR | Custom cookie serialisation | `@supabase/ssr` `createServerClient` with `getAll/setAll` | Handles SameSite, HttpOnly, path, expiry correctly across Next.js middleware + Route Handlers |
| PKCE code verifier storage | localStorage / custom cookie | `@supabase/ssr` internal cookie storage | `@supabase/ssr` stores the PKCE code verifier in an HTTP-only cookie automatically during `signInWithOAuth`; the callback just calls `exchangeCodeForSession` |
| Token refresh logic | Manual JWT expiry checks | `supabase.auth.getUser()` in middleware | `getUser()` silently refreshes tokens and writes updated cookies — no custom refresh logic needed |
| SQL UUID generation | `gen_random_uuid()` reimplementation | Postgres `DEFAULT gen_random_uuid()` | Built into Postgres; reliable, no extension required |

**Key insight:** `@supabase/ssr` handles all the JWT cookie complexity — PKCE verifier storage, token refresh, cookie serialisation. The only application code needed is wiring the `getAll`/`setAll` cookie accessors to Next.js's `request.cookies` / `cookieStore`.

---

## Common Pitfalls

### Pitfall 1: RLS Silent Lockout on Existing Tables

**What goes wrong:** A new RLS policy on `rooms`, `players`, or `votes` inadvertently restricts anonymous access (e.g., `USING (auth.uid() IS NOT NULL)`). `SELECT` returns 0 rows without an error, so the lobby shows "room not found" or players don't appear.
**Why it happens:** `002-auth.sql` is additive, but if `schema.sql` is regenerated carelessly it could overwrite existing open policies.
**How to avoid:** `002-auth.sql` only runs `ALTER TABLE players ADD COLUMN` and `CREATE TABLE user_session_stats` — it never touches the policies on `rooms`, `players`, or `votes`. After running migration, verify: `SELECT * FROM pg_policies WHERE tablename IN ('rooms','players','votes')`.
**Warning signs:** "Room introuvable" error, players not appearing in lobby real-time.

### Pitfall 2: `cookies()` Not Awaited in Next.js 16

**What goes wrong:** `const cookieStore = cookies()` (without `await`) compiles in older Next.js versions but is a hard error in Next.js 15+. Since the project uses Next.js 16.2.7, this will throw at runtime.
**Why it happens:** Next.js 15 made `cookies()`, `headers()`, and `draftMode()` async functions. Pre-15 code examples omit the `await`.
**How to avoid:** Always use `const cookieStore = await cookies()` and make the enclosing function `async`.
**Warning signs:** Runtime error mentioning "cookies() should be awaited" or similar.

### Pitfall 3: Middleware Interfering with Realtime or Broadcast Channels

**What goes wrong:** Middleware adds latency to every request. If it makes a network call (`getUser()`) on hot paths used by Realtime polling, it could slow down the game.
**Why it happens:** `getUser()` makes a network call to the Supabase Auth server on every matched request.
**How to avoid:** The middleware matcher already excludes `/_next/static`, `/_next/image`, and static assets. Realtime uses WebSocket connections, not HTTP requests that go through middleware, so this is not a risk for Supabase Realtime channels. The matcher is path-based — ensure it does not match websocket upgrade paths (Next.js handles websockets outside the middleware chain).
**Warning signs:** Increased game round latency after adding middleware.

### Pitfall 4: Double `supabaseResponse` Overwrite in Middleware

**What goes wrong:** In the `updateSession` pattern, `supabaseResponse` is reassigned inside `setAll`. If any code after that assignment reads the old reference, updated cookies are lost.
**Why it happens:** The `setAll` callback must re-assign `supabaseResponse = NextResponse.next({ request })` to get a response object that can accept new cookies (the initial `NextResponse.next()` does not carry over the request mutations).
**How to avoid:** Follow the exact pattern in the Code Examples section — `supabaseResponse` is a `let` variable reassigned inside `setAll`.
**Warning signs:** Session not persisting across page navigations; `getUser()` returns null on the second request even after signing in.

### Pitfall 5: Google OAuth Redirect URL Mismatch

**What goes wrong:** PKCE callback fails with "Invalid redirect URL" or code exchange returns error.
**Why it happens:** The redirect URL registered in Google Cloud Console must match exactly what Supabase sends. Both the Supabase Dashboard redirect URL and the Google Console "Authorized redirect URIs" must point to `https://{app-domain}/auth/callback`.
**How to avoid:** D-02 requires this as a blocking manual task. The Supabase Dashboard redirect goes to `https://{project-ref}.supabase.co/auth/v1/callback` (Supabase's own OAuth endpoint), not the app's `/auth/callback`. The app's `/auth/callback` is where Supabase redirects after completing OAuth. These are two different URLs.
**Warning signs:** OAuth redirect loop, code exchange error in server logs.

### Pitfall 6: Conflict Between `lib/supabase.ts` and `lib/supabase/server.ts`

**What goes wrong:** Import paths collide, or the wrong client is used in server code.
**Why it happens:** `lib/supabase.ts` exports the browser client as `supabase`. A new `lib/supabase/server.ts` file at `lib/supabase/server.ts` lives in a subdirectory, so `import { supabase } from '@/lib/supabase'` continues resolving to the browser client — no clash. BUT: if `lib/supabase/index.ts` were created, it would shadow the parent file.
**How to avoid:** Never create `lib/supabase/index.ts`. The server client is always imported as `import { createClient } from '@/lib/supabase/server'`.
**Warning signs:** TypeScript error "Property X does not exist" or "Cannot read cookie in browser context".

---

## Runtime State Inventory

Not applicable — this is a greenfield addition (new files + additive schema changes). No rename/refactor/migration of existing identifiers. The `players.user_id` column is new and all existing rows retain `NULL` — no data migration required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/ssr` | middleware, callback route | ✗ (not yet installed) | — | none — must install |
| Next.js 16 App Router middleware | `middleware.ts` | ✓ | 16.2.7 | — |
| Next.js Route Handlers | `app/auth/callback/route.ts` | ✓ | 16.2.7 | — |
| `cookies()` from `next/headers` | server client, callback route | ✓ | built-in Next.js 16 | — |
| Supabase Auth (Google provider) | PKCE callback | MANUAL TASK (D-02) | — | Phase cannot be smoke-tested end-to-end without this |
| `crypto.randomUUID()` | `session_uuid` generation | ✓ | Browser built-in | `genId()` in `lib/utils.ts` already handles insecure-context fallback |

**Missing dependencies with no fallback:**
- `@supabase/ssr` — must be installed (`npm install @supabase/ssr`)

**Missing dependencies with fallback:**
- Supabase Dashboard Google provider configuration (D-02) — manual task; app will run without it, but the `/auth/callback` handler cannot be smoke-tested for PKCE exchange

---

## Validation Architecture

### Test Framework

No test framework is currently installed. No `jest.config.*`, `vitest.config.*`, or `*.test.*` files exist in the project. The project's `package.json` has no test script. The health endpoint (Phase 1) was verified manually.

Given the project's current state, validation for this phase is smoke-test based (manual browser testing), not automated unit tests.

| Property | Value |
|----------|-------|
| Framework | None installed — smoke tests only |
| Config file | none |
| Quick run command | `npm run build` (build-time type check) |
| Full suite command | Manual: browser smoke test script below |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-04 | Anonymous player creates room, joins, plays all round types, reaches end screen, replays | Manual smoke test | — | ❌ Wave 0 gap |
| AUTH-02 | Session cookie persists across page refresh (authenticated user) | Manual smoke test | — | ❌ Wave 0 gap (requires Google sign-in from Phase 3 to test fully) |
| IDEN-01 | `players.user_id` column is nullable; existing rows have NULL | SQL verification query | — | ❌ |

### Smoke Test Script (AUTH-04 regression)

```
1. Open {app-domain} in a private/incognito window
2. Create a room (host)
3. Open second device/tab, join the room
4. Start the game
5. Play through: voting_question → round_a_vote → round_a_reveal
6. Continue: round_b_vote → round_b2_roulette
7. Continue: round_c_choice → (volunteer or roulette path)
8. Continue until ended (7 rounds or use "End session")
9. Verify end screen with stats and group title
10. Host clicks "Rejouer" → back to lobby, new theme selection
11. Start second game — verify votes accepted (no UNIQUE constraint error)
```

**Critical:** Run this full flow after EVERY DB migration and after middleware.ts is deployed.

### SQL Verification Queries (post-migration)

```sql
-- Verify players.user_id column exists and is nullable
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'players' AND column_name = 'user_id';
-- Expected: user_id | uuid | YES

-- Verify user_session_stats table and UNIQUE constraint
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'user_session_stats'::regclass;
-- Expected: user_session_stats_unique | u

-- Verify open anon policies still exist on rooms/players/votes
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('rooms', 'players', 'votes')
ORDER BY tablename, policyname;
-- Expected: all _select, _insert, _update, _delete policies with USING(true)
```

### Wave 0 Gaps

- [ ] No test framework — `npm run build` is the only automated check
- [ ] AUTH-04 smoke test must be run manually after every deployment
- [ ] DB verification queries (above) should be run after `002-auth.sql` executes

*(The project has no test infrastructure; these gaps are pre-existing, not introduced by this phase.)*

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` per config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (PKCE flow); no passwords in this phase |
| V3 Session Management | Yes | `@supabase/ssr` HTTP-only cookies; `getUser()` validates server-side |
| V4 Access Control | Partial | RLS on `user_session_stats` scoped to `auth.uid() = user_id`; existing tables keep open anon policies |
| V5 Input Validation | No | No user input in this phase (only code exchange from trusted OAuth provider) |
| V6 Cryptography | No | PKCE handled by Supabase Auth server; no custom crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session cookie theft | Spoofing | `@supabase/ssr` uses HttpOnly cookies (not accessible to JS); HTTPS on Railway production |
| PKCE code replay | Spoofing | `exchangeCodeForSession` invalidates code after first use (Supabase Auth enforces 5-minute TTL, single-use) |
| Anon RLS bypass via auth migration | Tampering | `002-auth.sql` is additive only; never drops or replaces existing policies on rooms/players/votes |
| `user_session_stats` data leakage | Disclosure | RLS `USING (auth.uid() = user_id)` prevents any other user from reading stats |
| Service role key exposure | Disclosure | Phase uses only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe for client) — no service role key in application code |

**Security note:** The existing Supabase project (`dmxjspnrrgcixzcthgwf`) was built with an open anon RLS posture (MVP). Phase 2 does not change that posture for existing tables — the game is intentionally unauthenticated at the data access layer. Only `user_session_stats` has scoped RLS. This is a deliberate, documented MVP decision.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` (deprecated) | `@supabase/ssr` | 2023 | Direct replacement; `createRouteHandlerClient`, `createMiddlewareClient` → `createServerClient` with cookie adapters |
| Synchronous `cookies()` | `await cookies()` | Next.js 15 | Breaking change; all `createServerClient` call sites must be in `async` functions |
| `getSession()` on server | `getUser()` on server | 2024 | `getSession()` is deprecated for server-side — reads from storage without server validation; `getUser()` validates with Auth server |
| `getUser()` in middleware (network call) | `getClaims()` in middleware (local JWT verify) | Late 2024/2025 | Performance improvement for high-traffic apps; for this phase, `getUser()` is still preferred as it is more correct and simpler |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated — do not use. Replaced by `@supabase/ssr`.
- `createRouteHandlerClient`, `createMiddlewareClient`, `createServerComponentClient`: These exports are from the deprecated package. Use `createServerClient` from `@supabase/ssr`.
- `supabase.auth.getSession()` in server code: Deprecated for server-side. Always use `getUser()`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `user_session_stats` column names (`designated_count`, `confessed_count`, `volunteered_count`, `group_title`) are sufficient for Phase 4 requirements | Standard Stack / Pattern 4 | Phase 4 planner may need to ALTER TABLE to add/rename columns; `ADD COLUMN IF NOT EXISTS` makes this safe |
| A2 | Google OAuth redirect URL at Supabase is the Supabase callback (`*.supabase.co/auth/v1/callback`), not the app's `/auth/callback` | Common Pitfalls §5 | If wrong, D-02 manual task instructions would be incorrect and Google OAuth would fail |
| A3 | `getClaims()` is available in `@supabase/supabase-js@2.107.0` | Standard Stack | Confirmed by grepping installed bundle — `getClaims` string found in dist/umd/supabase.js. Marked [ASSUMED] only for minimum version requirement; functional presence is confirmed |

---

## Open Questions

1. **`getClaims()` vs `getUser()` for long-running Phase 4 concern**
   - What we know: Phase 4 success criterion #5 requires "a long game (>1 hour) does not lose Realtime channel sync for authenticated users after JWT expiry." The middleware token refresh (via `getUser()`) handles this for page navigations. Realtime channels use a separate WebSocket connection.
   - What's unclear: Whether the Supabase Realtime client automatically reconnects on JWT expiry, or whether the client needs to explicitly call `setSession()` with a refreshed token.
   - Recommendation: Defer to Phase 4 research. Phase 2 middleware correctly refreshes JWTs on navigation — this is sufficient for AUTH-02. The Realtime-specific concern is out of Phase 2 scope.

2. **`host_id NOT NULL` constraint on prod DB**
   - What we know: CLAUDE.md warns that `host_id` is `NOT NULL` on the prod DB even though `schema.sql` declares it nullable (because `CREATE TABLE IF NOT EXISTS` doesn't ALTER existing tables).
   - What's unclear: Whether `ALTER TABLE players ADD COLUMN user_id` will encounter any similar constraint surprises on the prod DB.
   - Recommendation: `ADD COLUMN IF NOT EXISTS` is safe — adding a nullable column never conflicts with existing constraints. No risk here.

---

## Sources

### Primary (HIGH confidence)
- `@supabase/ssr@0.10.3` npm package — version, peer deps, postinstall confirmed via `npm view` [VERIFIED: npm registry]
- `supabase.com/docs/guides/auth/server-side/creating-a-client` — createServerClient API and cookie adapter pattern [CITED]
- `supabase.com/docs/guides/auth/server-side/nextjs` — middleware.ts and callback route structure [CITED]
- `supabase.com/docs/reference/javascript/auth-exchangecodeforsession` — exchangeCodeForSession API [CITED]
- `supabase.com/docs/guides/auth/sessions/pkce-flow` — PKCE flow explanation [CITED]
- `supabase.com/docs/guides/auth/social-login/auth-google` — Google OAuth Dashboard configuration steps [CITED]
- Project codebase: `lib/supabase.ts`, `lib/types.ts`, `lib/game.ts`, `lib/utils.ts`, `supabase/schema.sql`, `app/room/[code]/lobby/page.tsx` — examined directly [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)
- `@supabase/supabase-js@2.107.0` bundle — `getClaims` confirmed present via `grep` on installed dist file [VERIFIED: codebase grep]
- Multiple community sources confirming `await cookies()` requirement in Next.js 15+/16 — cross-verified with Next.js 15 release notes context [MEDIUM]
- `getClaims()` vs `getUser()` distinction (local JWT vs network call) — found in official Supabase issue #40985 and docs [CITED: supabase.com/docs/reference/javascript/auth-getclaims]

### Tertiary (LOW confidence)
- `user_session_stats` column names (A1 above) — derived from Phase 4 requirements in REQUIREMENTS.md; not confirmed against a working implementation [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack (`@supabase/ssr`, version, peer deps): HIGH — verified via npm registry
- Architecture patterns (middleware, callback, server client): HIGH — verified against official Supabase SSR docs and multiple cross-checked sources
- DB migration (additive SQL): HIGH — standard Postgres `ADD COLUMN IF NOT EXISTS` pattern
- `user_session_stats` schema: MEDIUM — follows Phase 4 requirements but exact column set is an assumption
- Pitfalls: HIGH — all top pitfalls (RLS silent lockout, `await cookies()`, response reassignment) verified from official docs and known project history

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable ecosystem; `@supabase/ssr` 0.10.x is the current stable branch)
