# Architecture Patterns: Optional Supabase Auth Integration

**Domain:** Party game web app — adding optional Google OAuth + cross-session stats to an anonymous-first system
**Researched:** 2026-06-07
**Overall confidence:** HIGH (Supabase Auth patterns are well-documented; design decisions derived from existing codebase analysis)

---

## Recommended Architecture

### Core Principle: Auth is Additive, Not Gating

The existing anonymous game flow must remain 100% unchanged. Auth layers on top without touching the game path. A player without a Google account plays identically to today. A signed-in player gets the same game experience plus stats persistence after the session ends.

### System Layers

```
┌──────────────────────────────────────────────────────┐
│  Layer 1: Game (unchanged)                           │
│  anon key → Supabase, localStorage identity,         │
│  RLS open policies, Realtime subscriptions           │
└──────────────────────────────────────────────────────┘
          ↓ additive (no mutation)
┌──────────────────────────────────────────────────────┐
│  Layer 2: Auth (new)                                 │
│  @supabase/ssr createBrowserClient, Google OAuth,    │
│  cookie-based session, middleware.ts token refresh   │
└──────────────────────────────────────────────────────┘
          ↓ triggered only at session end
┌──────────────────────────────────────────────────────┐
│  Layer 3: Stats persistence (new)                    │
│  user_stats table, write on EndScreen if user_id,   │
│  profile page reads accumulated data                 │
└──────────────────────────────────────────────────────┘
```

---

## Schema Changes

### Modified Table: `players`

Add one nullable column. Nullable is correct — anonymous players have no account.

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players (user_id);
```

**Why `ON DELETE SET NULL`:** If a user deletes their Supabase account, their player rows stay (game history integrity) but lose the link. Game mechanics are unaffected.

**Why nullable:** Anonymous players remain `user_id = NULL`. The game engine never reads `user_id`. No regression possible.

### New Table: `user_stats`

One row per user per completed session. Never update existing rows — append only. Aggregation happens at read time on the profile page.

```sql
CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_at timestamptz NOT NULL DEFAULT now(),
  theme text NOT NULL,
  rounds_played int NOT NULL DEFAULT 0,
  designated_count int NOT NULL DEFAULT 0,   -- times this user was designated (A + C roulette)
  confessed_count int NOT NULL DEFAULT 0,    -- times this user was the B2 roulette winner
  volunteered_count int NOT NULL DEFAULT 0,  -- times this user volunteered (C)
  group_title text,                          -- the GroupTitleKey for this session
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: each user sees only their own rows
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_stats_own" ON user_stats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats (user_id);
```

**Why not accumulate into a single row per user:** Appending per-session is simpler, safe against race conditions (two tabs can't conflict), and enables per-session history display later. Aggregation (`SUM`, `COUNT`) in a single query is cheap at the scale of a personal profile.

**Why no `room_id` FK:** The room may be deleted before the user views their profile. Keeping stats independent of room lifecycle avoids cascading deletions destroying history.

---

## New Files

### `lib/supabase-browser.ts` — Auth-aware browser client

The existing `lib/supabase.ts` uses `createClient` from `@supabase/supabase-js` (no cookie handling). For auth, a second client using `createBrowserClient` from `@supabase/ssr` is needed — it stores the session token in a cookie that middleware can refresh.

**Do not replace** `lib/supabase.ts`. The game pages import it directly in many places. Replacing it risks regressions. Instead, introduce `lib/supabase-browser.ts` specifically for auth operations.

```typescript
// lib/supabase-browser.ts
import { createBrowserClient } from '@supabase/ssr'

export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Game pages continue using `lib/supabase.ts` (the plain `createClient`). Auth-related components (sign-in button, profile page, stats writer) use `createAuthClient()`. Both use the same anon key and URL — only the cookie storage mechanism differs.

### `lib/supabase-server.ts` — Server client for route handlers

```typescript
// lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

Used only in: `app/auth/callback/route.ts`.

### `middleware.ts` — Token refresh

Required by `@supabase/ssr`. Refreshes the auth token before it expires. Does not block anonymous users — it reads the cookie if present and refreshes it; if there is no cookie (anonymous game player), it passes through unchanged.

```typescript
// middleware.ts (project root)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — no-op if no session cookie is present (anonymous players).
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

**Performance note:** The matcher excludes `/api/` (health endpoint) and Next.js static assets. The middleware adds one cookie-read per navigation — negligible.

### `app/auth/callback/route.ts` — OAuth code exchange

Google OAuth redirects here after the user approves. The route exchanges the authorization code for a session token and redirects to the profile page.

```typescript
// app/auth/callback/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/profile'

  if (code) {
    const supabase = createServerSupabase()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
```

### `app/profile/page.tsx` — Stats profile page (new, client component)

Reads `user_stats` rows for the signed-in user, aggregates `SUM` across sessions, displays history. If the user is not signed in, shows a prompt to sign in (not a redirect — the page is always accessible by URL).

### `components/AuthButton.tsx` — Sign-in/sign-out button (new)

Renders on: landing page, join page, lobby, end screen. Small, non-intrusive. When signed in, shows avatar initial + name. When signed out, shows "Connexion Google" text button.

```typescript
// Simplified outline (not final code)
'use client'
import { createAuthClient } from '@/lib/supabase-browser'

export function AuthButton() {
  const [user, setUser] = useState(null)
  const supabase = createAuthClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    )
    return () => subscription.unsubscribe()
  }, [])

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback?next=/profile` }
  })

  const signOut = () => supabase.auth.signOut()

  if (!user) return <button onClick={signIn}>Connexion Google</button>
  return <button onClick={signOut}>{user.email}</button>
}
```

---

## Component Boundaries

| Component | Responsibility | New/Modified | Communicates With |
|-----------|---------------|--------------|-------------------|
| `lib/supabase.ts` | Anon game client | Unchanged | All existing game pages |
| `lib/supabase-browser.ts` | Auth browser client | New | AuthButton, EndScreen stats writer, profile page |
| `lib/supabase-server.ts` | Auth server client | New | `app/auth/callback/route.ts` |
| `middleware.ts` | Token refresh on navigation | New | All page routes (no-op if no session) |
| `app/auth/callback/route.ts` | OAuth code exchange | New | Google OAuth, `lib/supabase-server.ts` |
| `components/AuthButton.tsx` | Sign-in/out UI | New | `lib/supabase-browser.ts` |
| `app/profile/page.tsx` | Stats history display | New | `lib/supabase-browser.ts`, `user_stats` table |
| `app/room/[code]/game/page.tsx` EndScreen | Stats write on game end | Modified (additive) | `lib/supabase-browser.ts`, `user_stats` table |
| `app/join/page.tsx` | Player row insert | Modified (additive) | reads `user_id` from auth session, writes to `players.user_id` |
| `app/page.tsx` | Room creation | Modified (additive) | reads `user_id` for host player row |
| `lib/types.ts` | Player type | Modified (additive) | add `user_id?: string` |

---

## Data Flow Changes

### Sign-in flow (new path, does not touch game)

```
User clicks "Connexion Google" (AuthButton)
  → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
  → Redirected to Google consent screen
  → Google redirects to /auth/callback?code=…
  → app/auth/callback/route.ts: exchangeCodeForSession(code)
  → Supabase sets session cookie
  → Redirect to /profile
```

### Join/create room with signed-in user (modified path)

The join and create-room flows read the current auth session before inserting into `players`. If a user is signed in, the `user_id` is included in the insert. If not, it is omitted (null).

```typescript
// In joinRoom() — app/join/page.tsx (additive change)
const { data: { user } } = await createAuthClient().auth.getUser()
const { data: player } = await supabase.from('players').insert({
  room_id: room.id,
  pseudo: pseudo.trim(),
  is_host: false,
  user_id: user?.id ?? null,  // NEW — null for anonymous
}).select().single()
```

The game engine never reads `players.user_id`. The change is invisible to all game logic.

### Stats write at session end (new path, runs after game)

When the game reaches the `ended` phase, `EndScreen` checks if the current user is authenticated. If so, it writes one row to `user_stats`. This is fire-and-forget — a failure does not affect the end screen UX.

```typescript
// In EndScreen — additive block
useEffect(() => {
  if (gs.phase !== 'ended') return
  const me = players.find(p => p.id === myId)
  createAuthClient().auth.getUser().then(({ data: { user } }) => {
    if (!user) return  // anonymous — skip
    supabase.from('user_stats').insert({
      user_id: user.id,
      theme: room.theme,
      rounds_played: totalRounds,
      designated_count: (gs.stats.designated ?? {})[myId ?? ''] ?? 0,
      confessed_count:  (gs.stats.confessed  ?? {})[myId ?? ''] ?? 0,
      volunteered_count: (gs.stats.volunteered ?? {})[myId ?? ''] ?? 0,
      group_title: titleKey,
    })
  })
}, [gs.phase])
```

---

## RLS Implications

### Existing policies: unchanged, still safe

The current open policies (`USING (true)`) on `rooms`, `players`, `votes` remain. Adding `user_id` to `players` does not affect these policies — they still allow anon access. No regression.

### New policy: `user_stats` is user-scoped

Only policy needed: each user can only read and write their own rows. Already shown in schema section. Anon users never touch `user_stats` (the write is guarded by `if (!user) return`).

### No policy changes needed on `players`

Even though `players.user_id` is now populated for authenticated users, there is no reason to restrict reads or writes based on it. The game relies on open anon access. Leave `players` policies as-is.

### Middleware does not break anon game access

The middleware reads the auth cookie and refreshes it — this is a no-op for requests with no cookie (every anonymous game player). It does not authenticate the Supabase client differently. The game pages still use `lib/supabase.ts` (plain anon client) and are unaffected.

---

## Patterns to Follow

### Pattern 1: Additive column — nullable FK on players

Never make `user_id` required. The game inserts player rows without going through auth. A `NOT NULL` constraint would break anonymous joins immediately.

**What:** `players.user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` (nullable)
**When:** Any table where rows can be created by both authenticated and anonymous actors

### Pattern 2: Separate auth client, don't replace game client

The game client (`lib/supabase.ts`) has no cookie support and does not manage auth sessions — that's intentional. Auth-aware features use `createBrowserClient` from `@supabase/ssr`. The two clients share the same project credentials; the difference is session storage mechanism (memory vs cookies).

**Why two clients:** Replacing `lib/supabase.ts` with `createBrowserClient` everywhere would require auditing all game pages for side effects. The game pages are complex and have subtle timing requirements (Realtime subscriptions, presence). Isolating the auth client eliminates risk.

### Pattern 3: Stats write is fire-and-forget with user guard

Stats persistence is a best-effort operation. It must never block the end screen or throw an unhandled rejection.

```typescript
// Always guard + always catch
if (!user) return
supabase.from('user_stats').insert({...}).then(({ error }) => {
  if (error) console.warn('[stats write]', error.message)
})
```

### Pattern 4: signInWithOAuth with `next` param in redirectTo

The callback route accepts a `next` query param so sign-in can be initiated from any page and land the user back somewhere sensible:

- Initiated from landing → `next=/profile`
- Initiated from join page → `next=/join?code=XXXX` (resume join after sign-in)
- Initiated from end screen → `next=` (same URL, the end screen re-mounts)

### Pattern 5: Auth state via onAuthStateChange, not repeated getUser calls

`getUser()` makes a network call to validate the JWT. In components that need to react to sign-in/sign-out, use `onAuthStateChange` (event-driven, no extra round-trip) and call `getUser()` once on mount.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Gating the game join behind auth

**What:** Requiring sign-in to join or create a room
**Why bad:** The product's entire value proposition depends on frictionless join. Players scan a QR code and are in the game in 10 seconds. An OAuth redirect breaks that.
**Instead:** Auth is surfaced as a secondary CTA ("Save your stats with Google") after the join form, or on the landing page alongside the primary room creation form.

### Anti-Pattern 2: Replacing lib/supabase.ts with the SSR browser client

**What:** Swapping `createClient` for `createBrowserClient` globally
**Why bad:** All 3 game pages (`lobby`, `game`, `join`) have established Realtime subscriptions and timing-sensitive flows. The SSR client behaves slightly differently (cookie storage, singleton management). Changes there are high-risk for zero benefit in game pages.
**Instead:** Two coexisting clients. The game client is the existing singleton. The auth client is created per-component.

### Anti-Pattern 3: Writing user_stats inside game state resolution

**What:** Persisting stats inside `onNextRound`, `onEndGame`, or `advance()` (the game engine functions)
**Why bad:** Those functions are called by the host and need to complete fast. A stats write failure or latency would delay round transitions. The host's `advance()` broadcasts a `phase_changed` event that all clients wait for.
**Instead:** Stats are written client-side in `EndScreen`'s `useEffect` on the player's own device, independently from the host's game logic.

### Anti-Pattern 4: Storing user identity in the same localStorage key as player identity

**What:** Overloading `kluup_pid_<CODE>` to also store auth user info
**Why bad:** The player ID is scoped per room and cleared on quit. The auth session is managed by Supabase cookies across the whole origin. Mixing them creates confusion about scope and lifecycle.
**Instead:** Auth state lives entirely in Supabase's cookie-managed session. Player identity stays in `kluup_pid_<CODE>` localStorage keys exactly as today.

### Anti-Pattern 5: user_stats as a single accumulating row per user

**What:** One row per user with `designated_total`, `confessed_total` etc. that get incremented each session
**Why bad:** Concurrent sessions (a user plays on two devices simultaneously) cause update conflicts. Postgres `UPDATE` on a single row also loses session history.
**Instead:** Append one row per session (INSERT only). Aggregate with `SUM()` queries on the profile page.

---

## Integration Points by File

This table answers "what existing file changes" for the milestone:

| File | Change Type | What Changes |
|------|-------------|--------------|
| `app/page.tsx` | Additive | Read auth user before creating host player row; pass `user_id` to players insert; render `AuthButton` in header |
| `app/join/page.tsx` | Additive | Read auth user before player insert; pass `user_id` to players insert; render `AuthButton` in header |
| `app/room/[code]/lobby/page.tsx` | Additive | Render `AuthButton` in header |
| `app/room/[code]/game/page.tsx` | Additive | In `EndScreen`: read auth user, write `user_stats` row on mount when phase=ended |
| `lib/types.ts` | Additive | Add `user_id?: string \| null` to `Player` type |
| `lib/supabase.ts` | Unchanged | Do not touch |
| `supabase/schema.sql` | Additive | `ALTER TABLE players ADD COLUMN user_id ...` + `CREATE TABLE user_stats ...` + RLS policy |

---

## Build Order

Each step is independently deployable. Deploy and verify before moving to the next.

### Step 1: Schema migration

Run in Supabase SQL editor (safe to run on live DB):

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players (user_id);
-- Then the full user_stats table + RLS from schema section above
```

No app changes yet. No breakage possible (nullable column, new table).

### Step 2: Install dependency + middleware + auth client files

```bash
npm install @supabase/ssr
```

Create `lib/supabase-browser.ts`, `lib/supabase-server.ts`, `middleware.ts`, `app/auth/callback/route.ts`.

Deploy and verify: existing game flow works, middleware passes through cleanly for anonymous users.

### Step 3: AuthButton component + Google OAuth wiring

Create `components/AuthButton.tsx`. Add it to `app/layout.tsx` (or individually to landing, join, lobby). Configure Google provider in Supabase dashboard. Add callback URL to Google OAuth credentials. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already set.

Deploy and verify: sign-in/sign-out round-trip works. Game flow still works for anonymous users.

### Step 4: Link player rows to user accounts

Modify `app/page.tsx` (create room) and `app/join/page.tsx` (join room) to read `auth.getUser()` and include `user_id` in the players insert when signed in.

Deploy and verify: signed-in host creates room, `players.user_id` is populated. Anonymous join still works (null user_id).

### Step 5: Stats persistence + profile page

Add stats write effect to `EndScreen` in `app/room/[code]/game/page.tsx`. Create `app/profile/page.tsx`. Update `lib/types.ts`.

Deploy and verify: complete session as signed-in user, check `user_stats` table, view profile page.

---

## Scalability Considerations

| Concern | At current scale (MVP) | At 10K sessions/month | Notes |
|---------|------------------------|----------------------|-------|
| `user_stats` table size | Negligible | ~10K rows | `SUM` aggregation stays fast until millions of rows |
| Auth cookie refresh (middleware) | No-op for all anonymous requests | Same — no-op is O(1) | Matcher excludes static assets |
| `players.user_id` index | Not needed yet | Useful for profile queries | Already added in schema step |
| Profile page query | Single `SELECT ... WHERE user_id = $1` | Same | Add `LIMIT` if sessions history is paginated |

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| `@supabase/ssr` client patterns | HIGH | Official Supabase docs, multiple verified examples |
| middleware.ts cookie refresh pattern | HIGH | Official Supabase Next.js SSR guide |
| `app/auth/callback/route.ts` pattern | HIGH | Official docs + multiple community sources agree |
| `signInWithOAuth` with Google | HIGH | Official Google provider guide |
| `user_stats` append-only design | HIGH | Standard event-sourcing pattern, well-understood |
| RLS backward compatibility | HIGH | Verified: open `USING (true)` policies unaffected by new nullable column |
| Two-client coexistence | MEDIUM | Architecturally sound but not officially documented as "do this"; inferred from Supabase's own guidance to keep browser/server clients separate |
| Stats write latency at EndScreen | MEDIUM | Fire-and-forget INSERT is correct; exact timing of `useEffect` on phase transition needs integration testing |

---

## Open Questions

These could not be resolved from documentation alone and need integration testing:

1. **Auth state across navigation:** When a signed-in user navigates from the profile page into a game room, does `createAuthClient().auth.getUser()` return the user correctly in the game page's `useEffect`? The cookie should be set, but the singleton pattern of `createBrowserClient` across page navigations in App Router client components needs verification.

2. **`getUser()` timing in join flow:** The join page currently inserts a player row synchronously after room lookup. Adding an `auth.getUser()` call adds one extra round-trip before the insert. Acceptable for the join flow (user is actively waiting), but the timing should be measured to confirm no perceptible delay.

3. **signInWithOAuth redirect from game pages:** If a user initiates sign-in from the end screen (to save stats), the OAuth redirect navigates away from the game page. When they return via `/auth/callback`, the room may no longer exist (rooms auto-cleanup after 30 min). The `next` param in the callback should redirect to `/profile` rather than back to the game, since the game state is not recoverable post-cleanup.

4. **Supabase Auth enablement in dashboard:** Google OAuth requires enabling the Google provider in the Supabase dashboard and adding Client ID/Secret from Google Cloud Console. This is an ops step, not a code step, but it must happen before Step 3 is deployed.
