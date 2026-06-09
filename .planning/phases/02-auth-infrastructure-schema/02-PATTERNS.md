# Phase 2: Auth Infrastructure + Schema - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 9 (5 new, 4 modified)
**Analogs found:** 7 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/supabase/server.ts` | utility | request-response | `lib/supabase.ts` | role-match (same client factory pattern, different transport layer) |
| `lib/supabase/middleware.ts` | middleware | request-response | `lib/supabase.ts` | partial (same env vars, different cookie adapter) |
| `middleware.ts` | middleware | request-response | `app/api/health/route.ts` | partial (same NextResponse import/export shape) |
| `app/auth/callback/route.ts` | route | request-response | `app/api/health/route.ts` | role-match (same Route Handler export pattern) |
| `supabase/migrations/002-auth.sql` | migration | batch | `supabase/schema.sql` | role-match |
| `supabase/schema.sql` | config | batch | self (idempotent update) | exact |
| `lib/types.ts` | model | — | self (additive field) | exact |
| `lib/game.ts` | utility | transform | self (additive field in return object) | exact |
| `app/room/[code]/lobby/page.tsx` | component | request-response | self (add one line in existing `startGame`) | exact |

---

## Pattern Assignments

### `lib/supabase/server.ts` (utility, request-response)

**Analog:** `lib/supabase.ts`

**Imports pattern** (`lib/supabase.ts` lines 1):
```typescript
import { createClient } from '@supabase/supabase-js'
```
New file replaces `createClient` from `@supabase/supabase-js` with `createServerClient` from `@supabase/ssr` and adds `cookies` from `next/headers`.

**Env var pattern** (`lib/supabase.ts` lines 7-17):
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in your hosting provider (Railway → Variables) and rebuild — ' +
      'these values are baked in at build time, not runtime.'
  )
}
```
Copy the guard pattern. The new file uses the same two env vars — no new variables needed.

**Core factory pattern** (`lib/supabase.ts` line 19):
```typescript
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
```
New file exports a named async function `createClient()` instead of a const — because `await cookies()` is required in Next.js 16. The fallback `?? ''` pattern for missing env vars is preserved.

**Full target pattern** (from RESEARCH.md Pattern 1):
```typescript
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

**Critical constraint:** Never create `lib/supabase/index.ts` — it would shadow `lib/supabase.ts` and break all existing `import { supabase } from '@/lib/supabase'` calls.

---

### `lib/supabase/middleware.ts` (middleware, request-response)

**Analog:** `lib/supabase.ts` (env var pattern); RESEARCH.md Pattern 2 is the canonical implementation reference.

**Env var reuse** (`lib/supabase.ts` lines 7-8):
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Same vars, used identically.

**Full target pattern** (from RESEARCH.md Pattern 2):
```typescript
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

**Critical:** `supabaseResponse` must be `let` (reassigned in `setAll`). Do not use `const`. Do not use `getSession()` — it is deprecated for server-side use.

---

### `middleware.ts` (middleware, project root)

**Analog:** `app/api/health/route.ts` (minimal named export from a server module).

**Route Handler export shape** (`app/api/health/route.ts` lines 1, 5):
```typescript
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ... });
}
```
New file follows the same pattern: single named export, imports from `next/server`.

**Full target pattern** (from RESEARCH.md Pattern 2):
```typescript
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

**Note:** The `config.matcher` is a required export in Next.js middleware — without it the middleware runs on every request including static assets.

---

### `app/auth/callback/route.ts` (route, request-response)

**Analog:** `app/api/health/route.ts`

**Route Handler pattern** (`app/api/health/route.ts` lines 1-10):
```typescript
import { NextResponse } from "next/server";

const startTime = Date.now();

export function GET() {
  return NextResponse.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
}
```
New file is also a `GET` Route Handler — same export name, same `NextResponse` import. Difference: new file accepts `request: NextRequest` param (needed to read `searchParams` and build redirect URLs).

**Full target pattern** (from RESEARCH.md Pattern 3):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const cookieStore = await cookies()  // MUST be awaited in Next.js 15+/16

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Defensive only — Route Handlers can write cookies.
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  return NextResponse.redirect(new URL('/', request.url))
}
```

**Error handling:** Redirect to `/` on both success and error (D-02 decision). Log error server-side only. Do not expose error details to the client.

---

### `supabase/migrations/002-auth.sql` (migration, batch)

**Analog:** `supabase/schema.sql` (structure and style reference).

**Idempotency pattern** (from existing schema.sql — use `IF NOT EXISTS` and `IF NOT EXISTS` guards throughout):

Full target migration (from RESEARCH.md Pattern 4):
```sql
-- supabase/migrations/002-auth.sql
-- Additive-only migration. Safe to run on a live prod DB.
-- Existing rows are unaffected: new columns default to NULL.

-- IDEN-01: nullable user_id FK on players
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- STAT-03 (Phase 4): user_session_stats table
CREATE TABLE IF NOT EXISTS user_session_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL,
  designated_count  int NOT NULL DEFAULT 0,
  confessed_count   int NOT NULL DEFAULT 0,
  volunteered_count int NOT NULL DEFAULT 0,
  group_title       text,
  played_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_session_stats_unique UNIQUE (user_id, session_id)
);

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

**Critical:** Do NOT touch any policies on `rooms`, `players` (existing rows), or `votes`. Only add the column and the new table.

---

### `supabase/schema.sql` (config, update)

**Nature of change:** Idempotent update — add the same SQL from `002-auth.sql` into `schema.sql` so it reflects the post-Phase-2 final DB state. This is a documentation/source-of-truth update, not a new migration.

**Pattern:** `schema.sql` already uses `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `DROP POLICY IF EXISTS` / `CREATE POLICY` guard patterns throughout. The Phase 2 additions follow the exact same style — no new patterns introduced.

---

### `lib/types.ts` — `GameState` interface (model, additive)

**Analog:** self

**Existing field for pattern reference** (`lib/types.ts` lines 75-78):
```typescript
  played_question_ids: string[]
  paused: boolean
  stats: SessionStats
  b2_revealed: boolean
```

**Change:** Add one field to the `GameState` interface after `b2_revealed`:
```typescript
  session_uuid: string   // UUID v4, set by startGame() in lobby; used as session_id in user_session_stats
```

**Type:** `string` (not `string | null`) — initialized to `''` (empty string), overwritten with `crypto.randomUUID()` by `startGame`. The empty-string default means the field is always present, just unpopulated until a game starts.

---

### `lib/game.ts` — `makeInitialGameState` (utility, transform)

**Analog:** self

**Existing initializer pattern** (`lib/game.ts` lines 78-96):
```typescript
export function makeInitialGameState(candidates: Question[]): GameState {
  return {
    phase: 'voting_question',
    round: 1,
    candidates,
    current_question: null,
    b_subtype: null,
    designated_player_id: null,
    designated_player_ids: [],
    designation_tie_all: false,
    revealed_player_ids: [],
    yes_percentage: null,
    volunteer_player_ids: [],
    played_question_ids: [],
    paused: false,
    stats: emptyStats(),
    b2_revealed: false,
  }
}
```

**Change:** Add one line to the return object (mirrors the `played_question_ids: []` pattern — initialized to zero/empty, not a real value):
```typescript
    session_uuid: '',   // startGame() overwrites with crypto.randomUUID()
```

**Placement:** After `b2_revealed: false` to match the field order in `GameState`.

---

### `app/room/[code]/lobby/page.tsx` — `startGame` function (component, request-response)

**Analog:** self

**Existing `startGame` pattern** (`app/room/[code]/lobby/page.tsx` lines 133-151):
```typescript
async function startGame() {
  if (!roomId) return
  setStarting(true)

  await supabase.from('votes').delete().eq('room_id', roomId)

  const candidates = await pickCandidates(selectedTheme, 1, [])
  const gs = makeInitialGameState(candidates)

  await supabase
    .from('rooms')
    .update({ status: 'playing', theme: selectedTheme, game_state: gs })
    .eq('id', roomId)

  navigate()
}
```

**Change:** Add one line after `const gs = makeInitialGameState(candidates)` and before the `supabase.from('rooms').update(...)` call:
```typescript
  gs.session_uuid = crypto.randomUUID()
```

`crypto.randomUUID()` is a browser built-in available in all modern browsers and the existing `lib/utils.ts` already relies on `crypto` (`genId()` uses `crypto.getRandomValues`). No import required.

---

## Shared Patterns

### Env Var Access
**Source:** `lib/supabase.ts` lines 7-17
**Apply to:** `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Both new server-side clients use the same two `NEXT_PUBLIC_*` vars — no new env vars. The Railway warning note in `lib/supabase.ts` context applies equally to the server client.

### Server-Side Cookie Adapter
**Source:** RESEARCH.md Patterns 1, 2, 3
**Apply to:** `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `app/auth/callback/route.ts`

The cookie adapter shape is identical in all three files — `getAll()` / `setAll()` methods. The difference is the cookie source:
- `lib/supabase/server.ts` and `app/auth/callback/route.ts`: `await cookies()` from `next/headers`
- `lib/supabase/middleware.ts`: `request.cookies` from `NextRequest`

### Route Handler Export
**Source:** `app/api/health/route.ts` lines 5-9
**Apply to:** `app/auth/callback/route.ts`
```typescript
export function GET() {
  return NextResponse.json(...)
}
```
New callback uses `export async function GET(request: NextRequest)` — same named export convention, with `async` and typed parameter added.

### Silent Error Redirect
**Apply to:** `app/auth/callback/route.ts`
Per decision D-02: on any error (missing code, exchange failure), redirect silently to `/` — never expose OAuth error details to the client. Log server-side with `console.error('[auth/callback] ...')`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/supabase/middleware.ts` (full impl) | middleware | request-response | No middleware files exist in the project yet; pattern comes entirely from `@supabase/ssr` official docs (RESEARCH.md Pattern 2) |
| `middleware.ts` (full impl) | middleware | request-response | Same — first middleware in the project; the pattern is well-documented in RESEARCH.md Pattern 2 |

---

## Metadata

**Analog search scope:** `lib/`, `app/api/`, `app/room/`, `supabase/`
**Files scanned:** 6 (lib/supabase.ts, lib/types.ts, lib/game.ts, app/api/health/route.ts, app/room/[code]/lobby/page.tsx, supabase/schema.sql)
**Pattern extraction date:** 2026-06-07
