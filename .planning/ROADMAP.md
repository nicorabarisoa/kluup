# Roadmap

**5 phases** | **13 requirements mapped** | All v1 + v2 requirements covered ✓

## Phases

- [x] **Phase 1: Health Endpoint** - GET /api/health for load-balancer probes
- [x] **Phase 2: Auth Infrastructure + Schema** - Lay auth plumbing and DB schema before any user-facing auth ships
- [x] **Phase 3: Playtest Quality Fixes** - Fix core game bugs found in playtest before auth ships (8/8 plans complete, all SCs addressed)
- [ ] **Phase 4: Sign-in UX + Player Linking** - Surface optional Google sign-in and wire signed-in identity into player rows
- [ ] **Phase 5: Stats Persistence + Profile** - Persist per-session stats for signed-in players and expose a profile page

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

### Phase 3: Playtest Quality Fixes

**Goal:** Fix the core game bugs and UX issues found during playtest so the game is solid before auth ships.
**Depends on:** Phase 2
**Requirements:** (game quality — no auth requirements)
**Success Criteria** (what must be TRUE):

  1. Two players cannot join a room with the same pseudo — the second attempt is rejected with a clear message
  2. Closing the browser tab or navigating away removes the player from the room within a short grace period; screen-lock on mobile does not trigger removal
  3. A room with zero connected players is automatically deleted by the server within ~1 min (pg_cron sweep interval)
  4. A player rejoining a lobby after quitting gets a fresh join flow (new pseudo entry), not their old cached pseudo
  5. A player who refreshes mid-round sees the correct remaining timer and all previously cast votes are counted
  6. The quit button is accessible from the lobby (same as in-game)
  7. Type C with 0 volunteers triggers the roulette designation flow, not a "responds out loud" message
  8. A player joining mid-round does not distort the vote threshold or timer for the current question
  9. Landing page says "recommended 3–10 players" instead of "3 to 10 players"

**Plans:** 8/8 plans complete
Plans:

- [x] 03-01-PLAN.md — GameState fields (round_started_at, vote_round_player_count)
- [x] 03-02-PLAN.md — i18n keys + landing copy + presence grace/heartbeat constants
- [x] 03-03-PLAN.md — pseudo-uniqueness DB migration (SQL written + applied to live DB 2026-06-10)
- [x] 03-04-PLAN.md — game page: refresh-safe timer, snapshot threshold, join toast, Type C 0-vol guard
- [x] 03-05-PLAN.md — join page (pseudo error + rejoin pre-populate) + lobby quit button
- [x] 03-06-PLAN.md — [gap] game page: Type C choice frozen display denominator (SC-8) + remove choice-phase timer (5b) + SC-5 lazy-stamp (implemented)
- [x] 03-07-PLAN.md — [gap] rejoin pseudo persistence (lib/utils.ts kluup_pseudo_<CODE> + join page fallback) (SC-4)
- [x] 03-08-PLAN.md — [gap] pg_cron server sweep for empty-room deletion (~1 min) + SC-3 acceptance relax (pg_cron live, jobid 6, applied 2026-06-10)

**UI hint**: no

### Phase 4: Sign-in UX + Player Linking

**Goal:** Any user (host or player) can optionally sign in with Google; signed-in identity flows into the player row for that session.
**Depends on:** Phase 3
**Requirements:** AUTH-01, AUTH-03, IDEN-02
**Success Criteria** (what must be TRUE):

  1. A user on the landing page can tap "Sign in with Google", complete OAuth, and return to the app signed in — with no mandatory sign-in gate anywhere in the game flow
  2. A signed-in user can sign out from the landing page, join page, lobby, and end screen
  3. A signed-in user joining a room on a second device (no localStorage entry for that code) is matched to their existing player row via `user_id` lookup rather than creating a duplicate row
  4. An anonymous player can still join and play a full game without ever being prompted to sign in during the game
  5. Auth session survives browser refresh and page navigation without the user needing to re-authenticate

**Plans:** 3/4 plans executed
**Wave 1**

- [x] 04-01-PLAN.md — i18n auth namespace (sign_in/sign_out/pseudo_prefilled_hint) in fr/en/es/de
- [x] 04-02-PLAN.md — game + lobby green-dot signed-in indicator on Quit buttons (D-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — join page: auth pill + IDEN-02 user_id reconnect + user_id insert + Google-name pre-fill
- [ ] 04-04-PLAN.md — landing page: auth pill + user_id on host insert + Google-name pre-fill

**UI hint**: yes

### Phase 5: Stats Persistence + Profile

**Goal:** Signed-in players accumulate a cross-session stats history they can view on their profile; anonymous players are nudged to sign in after a completed game.
**Depends on:** Phase 4
**Requirements:** STAT-01, STAT-02, STAT-03, PROF-01, PROF-02
**Success Criteria** (what must be TRUE):

  1. After a signed-in player reaches the end screen, their session stats (designation count, confession reveals, volunteer count, group title) are saved automatically — and do not double-write if the player replays the same session
  2. Each game session is stored as a separate row; replaying does not overwrite the previous session's record
  3. A signed-in user visiting `/profile` sees their full stats history (cumulative and per-session) including all group titles earned
  4. An anonymous user who completes a game sees a "sign in to save your stats" CTA on the end screen, displayed after the session stats — with no CTA shown if the user is already signed in
  5. A long game (>1 hour) does not lose Realtime channel sync for authenticated users after JWT expiry
  6. `user_session_stats` includes a `tag_scores jsonb` field (per-trait scores for that session) — accumulated into a global archetype on the profile page

**Plans:** TBD
**UI hint**: yes

---

## Future Milestone: v3.0 Superpowers

> Not part of v2.0. These phases are planned once v2.0 is shipped.
> Sequencing validated 2026-06-10 via spec ingest.

### Phase A: Social Profile & Archetypes + Duo Awards

**Goal:** Assign social archetypes to players based on in-game behaviour tags, and compute duo awards for the most notable pairs — both displayed on a new 2-faced share card.
**Depends on:** v2.0 complete
**Requirements:** REQ-AR-01 through REQ-AR-06, REQ-DA-01 through REQ-DA-05
**Key constraints:** Archetypes and Duo Awards share Face 2 of the share card — must ship together. modern-screenshot for both faces (locked decision). REQ-AR-07 (cross-session tag_scores) deferred to Phase 5.
**DB migrations needed:**

  - `ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb`
  - Question curation (all existing questions tagged)

### Phase B: Contextual Questions

**Goal:** Insert adaptive follow-up questions between rounds, triggered by in-game events with increasing probability.
**Depends on:** Phase A (contextual_questions table, no archetype dependency)
**Requirements:** REQ-CQ-01 through REQ-CQ-06
**DB migrations needed:**

  - `CREATE TABLE contextual_questions (id uuid, parent_question_id uuid FK → questions ON DELETE CASCADE, template jsonb)`

### Phase C: Power Cards (Target & Reveal)

**Goal:** Assign secret power cards to volunteers via weighted draw; usable during Type B roulette reveal for dramatic extra revelations.
**Depends on:** Phase A (volunteer tracking already in place)
**Requirements:** REQ-PC-01 through REQ-PC-08

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Health Endpoint | 1/1 | Complete | 2026-06-07 |
| 2. Auth Infrastructure + Schema | 3/3 | Complete | 2026-06-10 |
| 3. Playtest Quality Fixes | 8/8 | Complete   | 2026-06-10 |
| 4. Sign-in UX + Player Linking | 3/4 | In Progress|  |
| 5. Stats Persistence + Profile | 0/? | Not started | - |
