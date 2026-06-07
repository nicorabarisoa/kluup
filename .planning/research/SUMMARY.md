# Project Research Summary

**Project:** Kluup v2.0 - Auth and Stats milestone
**Domain:** Optional authentication + cross-session stats on an anonymous-first party game web app
**Researched:** 2026-06-07
**Confidence:** HIGH

## Executive Summary

Kluup v2.0 adds optional Google OAuth sign-in and cross-session stat persistence on top of an already-working anonymous game loop. The architectural mandate is strict: auth is additive, never gating. The existing anonymous flow (room creation, join, full game, replay) must remain 100% unchanged. The correct mental model is Duolingo gradual-engagement: let players complete a full game first, then surface a sign-in nudge on the end screen after they have concrete results worth keeping.

The recommended approach is a two-layer addition on top of the unchanged game layer: (1) install @supabase/ssr, add middleware.ts for cookie-based token refresh, app/auth/callback/route.ts as a Route Handler for PKCE code exchange, and a new lib/supabase-browser.ts auth client without touching the existing lib/supabase.ts game client; (2) add a nullable user_id column to players, a new append-only user_session_stats table with UNIQUE(user_id, session_id), and a stats-write effect in EndScreen that only fires when a user is authenticated. A /profile page closes the loop.

The highest-risk area is RLS policy management: the same silent-lockout bug that caused the Room introuvable incident in v1 will recur if any new policy on rooms, players, or votes inadvertently replaces the open anon policies. Every DB migration must be followed by a full anonymous game regression test. Secondary risks are PKCE cookie handling on Safari iOS, Realtime channel disconnect when JWT expires during a long game, and stats double-counting after replay.

---

## Key Findings

### Recommended Stack

The existing stack requires exactly one new package: @supabase/ssr@^0.10.3. The existing @supabase/supabase-js@^2.107.0 satisfies its peer dependency. No other packages are needed: Supabase Auth handles Google OAuth natively without next-auth, @react-oauth/google, or any JWT library.

The key architectural constraint from STACK.md is that the existing lib/supabase.ts (plain createClient) must NOT be replaced. All auth-specific code uses a new lib/supabase-browser.ts (createBrowserClient) for client components and lib/supabase-server.ts (createServerClient) for the callback Route Handler only. Two Supabase clients coexist intentionally.

**Core technologies:**
- @supabase/ssr: cookie-based session management for auth -- required for PKCE callback and middleware token refresh; supabase-js alone is insufficient
- middleware.ts (new, project root): token refresh on every navigation; no-op for anonymous requests; mandatory for sessions surviving past the 1-hour access token TTL
- app/auth/callback/route.ts (new, Route Handler): server-side PKCE code exchange; must NOT be a client component
- NEXT_PUBLIC_SITE_URL: single new env var for constructing redirectTo; Google Client ID/Secret go in Supabase Dashboard, not in Next.js env

### Expected Features

**Must have (table stakes):**
- Google OAuth one-tap sign-in -- users will not fill a username/password form for a party game
- Sign-in entirely optional, never blocking -- zero auth checks anywhere in the game loop
- Session persistence (stay logged in across navigations and browser restarts)
- Stats saved automatically on sign-in -- retroactive flush when auth resolves on end screen
- /profile page with cumulative stats history
- Sign-out capability

**Should have (differentiators):**
- Personality snapshot framing -- same stats reframed as identity copy
- Google avatar surfaced in lobby and profile -- instant from user.user_metadata.avatar_url
- End-screen nudge with stat preview -- loss-aversion framing after a real game
- Group titles history -- cross-session narrative

**Defer (v2+):**
- Avatar sync to lobby player row (Realtime complexity not worth it in v1)
- Per-session history detail rows for best game stat
- total_players_met counter (requires set deduplication)
- Email/password auth (add only if demanded post-launch)

**Explicit anti-features:**
- Mandatory account for hosting (breaks frictionless positioning)
- Public leaderboard or stats visible to other players (privacy violation for a confessions-based game)
- signInAnonymously() Supabase feature -- Kluup anonymous identity is localStorage-based per room, not Supabase anonymous users

### Architecture Approach

The architecture adds two new layers on top of the unchanged game layer. Layer 2 (Auth) introduces @supabase/ssr clients, middleware, and the OAuth callback route. Layer 3 (Stats) adds a user_session_stats table and a fire-and-forget write in EndScreen. The two Supabase clients coexist intentionally: the game client handles Realtime, presence, and all room operations; the auth client handles sign-in, sign-out, and getUser() calls only in auth-related components.

**Major components:**
1. middleware.ts -- cookie-based token refresh on every navigation; no-op for anonymous users; must be deployed first
2. app/auth/callback/route.ts -- server-side PKCE code exchange; receives Google redirect, sets session cookie, redirects to /profile
3. components/AuthButton.tsx -- sign-in/sign-out UI using onAuthStateChange; placed on landing, join, lobby, end screen
4. user_session_stats table -- append-only (INSERT per session), UNIQUE(user_id, session_id) constraint, RLS auth.uid() = user_id
5. app/profile/page.tsx -- reads and aggregates session rows; shows sign-in prompt when unauthenticated
6. EndScreen modification -- fire-and-forget stats INSERT guarded by statsWrittenRef to prevent double-write on replay

### Critical Pitfalls

1. **RLS silent lockout of anonymous players** -- Any new RLS policy that replaces the open anon policy on rooms, players, or votes causes all anonymous game actions to silently return 0 rows. Prevention: add new policies with TO authenticated clause; never drop existing TO anon USING (true) policies; run full anonymous game regression after every DB migration.

2. **PKCE code verifier lost on OAuth callback** -- If app/auth/callback is a client component or callback URLs are not registered identically in Supabase Dashboard and Google Cloud Console, code exchange fails silently. Prevention: implement as Route Handler; register https://kluup.app/auth/callback in both places; test on Safari iOS.

3. **Realtime channels disconnect when JWT expires during a game** -- Supabase Realtime does not auto-re-subscribe with the refreshed token. A game lasting more than 1 hour freezes for authenticated users. Prevention: add onAuthStateChange(TOKEN_REFRESHED) -> supabase.realtime.setAuth(token) in game/page.tsx.

4. **Stats double-counted on replay** -- EndScreen useEffect fires again after replay reaches ended phase. Prevention: UNIQUE(user_id, session_id) DB constraint + statsWrittenRef.current guard; generate session_id from room.id + game_start_timestamp.

5. **Duplicate player row on multi-device join** -- When an authenticated user joins from a second device with no localStorage, a new players row is created alongside the existing one, breaking vote threshold. Prevention: at join time, after getPlayerId(code) returns null, check for existing players row with user_id = auth.uid() for this room and reuse it.

---

## Implications for Roadmap

Based on combined research, a 3-phase structure is recommended. Each phase is independently deployable and verifiable.

### Phase 1: Auth Infrastructure + Schema
**Rationale:** Middleware and the auth callback route must exist before any auth-dependent feature. This is also the highest-risk phase for RLS regressions, so it must be validated in isolation before auth UI ships.
**Delivers:** @supabase/ssr installed, middleware.ts live, app/auth/callback/route.ts live, lib/supabase-browser.ts and lib/supabase-server.ts created, players.user_id nullable FK added, user_session_stats table created, Google provider configured in Supabase Dashboard. Anonymous game flow 100% unchanged.
**Addresses:** Session persistence (table stakes), PKCE callback (table stakes)
**Avoids:** RLS lockout pitfall (regression test after schema changes), PKCE cookie failure (Route Handler not client component), middleware missing for session persistence

### Phase 2: Sign-in UX + Player Row Linking
**Rationale:** Once infrastructure is stable, surface the auth UI and wire user_id into player rows. AuthButton is a secondary CTA -- anonymous flow is unaffected.
**Delivers:** AuthButton component on landing, join, lobby pages. app/page.tsx and app/join/page.tsx read auth.getUser() before inserting player row and pass user_id. Two-device identity reconciliation in join flow.
**Uses:** lib/supabase-browser.ts, onAuthStateChange, signInWithOAuth with google provider
**Avoids:** Duplicate player row pitfall (reconciliation at join), gating the game behind auth

### Phase 3: Stats Persistence + Profile Page
**Rationale:** Stats can only be written correctly once player rows have user_id (Phase 2). The profile page is the reward that makes sign-up feel worthwhile.
**Delivers:** Stats write in EndScreen (fire-and-forget, statsWrittenRef guard, UNIQUE(user_id, session_id)), end-screen nudge for anonymous users with non-zero stats, /profile page with cumulative stats + titles history, TOKEN_REFRESHED -> setAuth handler in game page.
**Avoids:** Stats double-count on replay (unique constraint + ref guard), Realtime disconnect during long game (token refresh handler)

### Phase Ordering Rationale

- Middleware must come before any auth-dependent code -- prerequisite for cookie-based sessions surviving navigation.
- Player row linking (Phase 2) must precede stats writes (Phase 3) -- stats need user_id on the player row to be meaningful.
- RLS changes happen in Phase 1 (schema-only, no user-visible features) so regressions are caught before auth UI ships.
- user_session_stats table can be created in Phase 1 even though write logic ships in Phase 3 -- causes no harm and simplifies Phase 3.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Stats Persistence):** The session_id derivation strategy (room.id + game_start_timestamp) needs validation against the existing game_state jsonb -- confirm that a reliable game_start_at timestamp is available or can be added cheaply.

Phases with standard patterns (can skip research-phase):
- **Phase 1 (Auth Infrastructure):** @supabase/ssr patterns are thoroughly documented; middleware and callback route are copy-from-docs.
- **Phase 2 (Sign-in UX):** signInWithOAuth + AuthButton pattern is standard; no novel integration needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | @supabase/ssr patterns verified against official docs; npm peer deps confirmed; no speculative packages |
| Features | HIGH | Table stakes derived from well-documented gradual-engagement patterns; anti-features are explicit decisions |
| Architecture | HIGH | Two-client coexistence is architecturally sound; append-only stats is standard event-sourcing; one item needing integration test: createBrowserClient singleton across App Router navigation |
| Pitfalls | HIGH | RLS lockout and PKCE failure corroborated by existing CLAUDE.md incidents; Realtime token issue confirmed in supabase/realtime-js#274 |

**Overall confidence:** HIGH

### Gaps to Address

- **createBrowserClient singleton across navigation:** Whether createAuthClient() called in multiple components shares state correctly across App Router client component tree needs a quick integration test in Phase 2.
- **session_id source of truth:** Confirm whether game_state already stores a started_at timestamp or whether one must be added in Phase 1 schema migration.
- **Railway callback URL reachability:** After deploying Phase 1, manually verify https://kluup.app/auth/callback returns the expected redirect before configuring Google Cloud Console.

---

## Sources

### Primary (HIGH confidence)
- Supabase @supabase/ssr official docs -- install, createBrowserClient, createServerClient, middleware pattern, PKCE callback route
- Supabase Auth Next.js App Router quickstart -- server-side auth setup
- Supabase Google OAuth provider guide -- signInWithOAuth, redirect URL config
- Supabase RLS official docs -- policy scoping, TO anon vs TO authenticated
- Supabase Realtime authorization docs -- setAuth for long-lived channel token refresh
- npm registry -- @supabase/ssr@0.10.3 latest, @supabase/supabase-js@2.107.0 peer dep verified

### Secondary (MEDIUM confidence)
- GitHub supabase/realtime-js#274 -- Realtime token not refreshed on standby (SDK v2.x confirmed affected)
- GitHub supabase discussions #37797 -- linkIdentity() missing metadata bug (basis for avoiding account linking)
- Supabase community discussions #4047 -- Google OAuth user_metadata fields

### Tertiary (LOW confidence - patterns / UX)
- Duolingo gradual engagement pattern -- timing recommendation for nudge placement
- Social login conversion rate studies -- rationale for Google-only OAuth

---
*Research completed: 2026-06-07*
*Ready for roadmap: yes*
