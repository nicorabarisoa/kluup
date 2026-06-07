# Phase 2: Auth Infrastructure + Schema - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Install auth plumbing — `@supabase/ssr` client setup, `middleware.ts` for silent token refresh on every navigation, `/auth/callback` Route Handler for PKCE code exchange, and DB schema extensions (`players.user_id` nullable FK, `user_session_stats` table with RLS scoped to `auth.uid() = user_id`). No sign-in UI. The anonymous game flow (create room, join, play all round types, end screen, replay) must remain completely unaffected.

</domain>

<decisions>
## Implementation Decisions

### Session ID Strategy
- **D-01:** Add `session_uuid` (UUID v4) to `rooms.game_state` jsonb, generated via `crypto.randomUUID()` inside `startGame`. This field serves as the `session_id` for `user_session_stats` in Phase 4. It is reset automatically on every replay because `startGame` already resets `game_state`. No new DB columns required for session tracking.

### Supabase Dashboard Setup
- **D-02:** Phase 2 includes a manual BLOCKING task: configure Google OAuth in the Supabase Dashboard (enable Google provider, add redirect URL `https://{app-domain}/auth/callback`). This enables smoke-testing the full PKCE callback flow within Phase 2, before Phase 3 adds the sign-in button.

### Claude's Discretion
- **SQL migration approach:** create `supabase/migrations/002-auth.sql` as a standalone migration with only the new changes (ALTER TABLE players ADD COLUMN user_id, CREATE TABLE user_session_stats). Also update `supabase/schema.sql` idempotently to reflect the final desired state of the DB.
- **Auth client library:** use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`). Creates a server-side Supabase client alongside the existing `lib/supabase.ts` client-only instance.
- **Middleware matcher:** run on all paths except `/_next/static`, `/_next/image`, `favicon.ico`, and other static assets. Anonymous requests pass through unchanged.
- **Callback error handling:** on missing `code` param or auth error, redirect silently to `/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema & Constraints
- `supabase/schema.sql` — source of truth for DB; idempotent; MUST be updated alongside any migration file to reflect post-Phase-2 final state
- `supabase/lifecycle.sql` — room cleanup logic; must remain unaffected
- `CLAUDE.md` §"🔧 Architecture réelle & décisions" > "Modèle de données (Supabase)" — full column specs, RLS posture, `host_id NOT NULL` constraint on prod (do NOT ALTER it)

### Requirements
- `.planning/REQUIREMENTS.md` §Authentication (AUTH-02, AUTH-04) and §Player Identity (IDEN-01) — the three requirements this phase must satisfy

### Existing Client & Patterns
- `lib/supabase.ts` — existing client-only Supabase client; Phase 2 adds a server-side companion for use in middleware and Route Handlers
- `lib/utils.ts` — `genId()` used for ID generation; `session_uuid` follows the same call-site pattern
- `lib/game.ts` — `makeInitialGameState()` must have `session_uuid` field added to its return type and initial value

### Integration Points
- `app/room/[code]/game/page.tsx` — `startGame()` function is where `crypto.randomUUID()` is called and written into `game_state`
- `.planning/ROADMAP.md` §Phase 2 — success criteria (5 items) are the acceptance targets

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase.ts` `createClient()` — existing browser client; the new server client (`@supabase/ssr` `createServerClient`) follows the same export pattern in a new file
- `lib/utils.ts` `genId()` — precedent for client-side ID generation; `crypto.randomUUID()` is the same pattern for session_uuid

### Established Patterns
- All pages are `'use client'` — `middleware.ts` and `app/auth/callback/route.ts` will be the **only server-side code** in the app; no React Server Components exist to conflict
- `supabase/schema.sql` is always the canonical DB state — every migration must also be reflected there
- RLS is currently fully open on `rooms`, `players`, `votes` — these policies must not change in Phase 2
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only current env vars; `@supabase/ssr` uses the same vars for both client and server

### Integration Points
- `middleware.ts` (new) at project root — intercepts every request to refresh the Supabase auth session cookie
- `app/auth/callback/route.ts` (new) — exchanges PKCE code for session; redirects to `/` on success or error
- `lib/game.ts` `makeInitialGameState()` — add `session_uuid: string` to the `GameState` type and initialize to `''`; `startGame` overwrites it with `crypto.randomUUID()`
- `lib/types.ts` `GameState` interface — needs `session_uuid: string` field

</code_context>

<specifics>
## Specific Ideas

- `session_uuid` starts as `''` (empty string) in `makeInitialGameState()` and is populated by `startGame` — this mirrors how `played_question_ids` is initialized as `[]`
- The `user_session_stats` table must have `UNIQUE(user_id, session_id)` where `session_id` stores the UUID from `game_state.session_uuid`
- STATE.md warning applies here: "RLS silent lockout is the highest-risk pitfall — run full anonymous smoke test after every DB migration." Phase 2 verification must include the full anonymous regression test from ROADMAP success criterion #1.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Auth Infrastructure + Schema*
*Context gathered: 2026-06-07*
