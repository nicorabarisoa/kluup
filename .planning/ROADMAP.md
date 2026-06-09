# Roadmap

**4 phases** | **13 requirements mapped** | All v1 + v2 requirements covered ✓

## Phases

- [x] **Phase 1: Health Endpoint** - GET /api/health for load-balancer probes
- [ ] **Phase 2: Auth Infrastructure + Schema** - Lay auth plumbing and DB schema before any user-facing auth ships
- [ ] **Phase 3: Sign-in UX + Player Linking** - Surface optional Google sign-in and wire signed-in identity into player rows
- [ ] **Phase 4: Stats Persistence + Profile** - Persist per-session stats for signed-in players and expose a profile page

---

## Phase Details

### Phase 1: Health Endpoint
**Goal:** Expose `GET /api/health` returning `{"status":"ok","uptime":<seconds>}` for load-balancer health checks.
**Depends on:** Nothing
**Requirements:** HLT-01, HLT-02
**Success Criteria** (what must be TRUE):
  1. `GET /api/health` responds with HTTP 200 and `Content-Type: application/json`
  2. Response body matches `{"status":"ok","uptime":<non-negative integer>}`
**Status:** ✓ Complete
**Plans:** Implemented — `app/api/health/route.ts`

### Phase 2: Auth Infrastructure + Schema
**Goal:** Auth plumbing is live and the DB schema is ready for signed-in players — without touching the anonymous game flow.
**Depends on:** Phase 1
**Requirements:** IDEN-01, AUTH-02, AUTH-04
**Success Criteria** (what must be TRUE):
  1. An anonymous player can create a room, join, play through all round types, reach the end screen, and replay — with no regression
  2. `middleware.ts` silently refreshes tokens on every navigation; anonymous requests pass through unchanged
  3. `GET /auth/callback` (Route Handler) exchanges a PKCE code and sets a session cookie without crashing for both authenticated and unauthenticated requests
  4. The `players` table has a nullable `user_id` column; existing anonymous player rows are unaffected
  5. The `user_session_stats` table exists with `UNIQUE(user_id, session_id)` and RLS scoped to `auth.uid() = user_id`; the open anon policies on `rooms`, `players`, and `votes` remain in place
**Plans:** 3 plans (02-01 complete, 02-02 and 02-03 pending)
**UI hint**: no

### Phase 3: Sign-in UX + Player Linking
**Goal:** Any user (host or player) can optionally sign in with Google; signed-in identity flows into the player row for that session.
**Depends on:** Phase 2
**Requirements:** AUTH-01, AUTH-03, IDEN-02
**Success Criteria** (what must be TRUE):
  1. A user on the landing page can tap "Sign in with Google", complete OAuth, and return to the app signed in — with no mandatory sign-in gate anywhere in the game flow
  2. A signed-in user can sign out from the landing page, join page, lobby, and end screen
  3. A signed-in user joining a room on a second device (no localStorage entry for that code) is matched to their existing player row via `user_id` lookup rather than creating a duplicate row
  4. An anonymous player can still join and play a full game without ever being prompted to sign in during the game
  5. Auth session survives browser refresh and page navigation without the user needing to re-authenticate
**Plans:** TBD
**UI hint**: yes

### Phase 4: Stats Persistence + Profile
**Goal:** Signed-in players accumulate a cross-session stats history they can view on their profile; anonymous players are nudged to sign in after a completed game.
**Depends on:** Phase 3
**Requirements:** STAT-01, STAT-02, STAT-03, PROF-01, PROF-02
**Success Criteria** (what must be TRUE):
  1. After a signed-in player reaches the end screen, their session stats (designation count, confession reveals, volunteer count, group title) are saved automatically — and do not double-write if the player replays the same session
  2. Each game session is stored as a separate row; replaying does not overwrite the previous session's record
  3. A signed-in user visiting `/profile` sees their full stats history (cumulative and per-session) including all group titles earned
  4. An anonymous user who completes a game sees a "sign in to save your stats" CTA on the end screen, displayed after the session stats — with no CTA shown if the user is already signed in
  5. A long game (>1 hour) does not lose Realtime channel sync for authenticated users after JWT expiry
**Plans:** TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Health Endpoint | 1/1 | Complete | 2026-06-07 |
| 2. Auth Infrastructure + Schema | 3/3 | Complete | 2026-06-10 |
| 3. Sign-in UX + Player Linking | 0/? | Not started | - |
| 4. Stats Persistence + Profile | 0/? | Not started | - |
