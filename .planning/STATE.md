---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
current_phase: 04
status: completed
last_updated: "2026-06-11T11:47:00.290Z"
last_activity: 2026-06-11 -- Phase 04 Plan 04 complete (all 4 plans done)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 15
  completed_plans: 15
  percent: 60
---

# Project State

**Last updated:** 2026-06-10
**Current phase:** 04
**Overall status:** Executing — Plan 02-03 complete (Phase 2 all plans done)

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Health Endpoint | ✓ Complete |
| 2 | Auth Infrastructure + Schema | ✓ Complete (3/3 plans done) |
| 3 | Sign-in UX + Player Linking | Not started |
| 4 | Stats Persistence + Profile | Not started |

## Active Work

Phase 2 complete. Next: Phase 3 — Sign-in UX + Player Linking

## Decisions

- user_session_stats.session_id is uuid NOT NULL with no FK (sourced from game_state.session_uuid in plan 02-03)
- No DELETE RLS policy on user_session_stats (anon and other users cannot delete rows)
- user_session_stats NOT added to supabase_realtime publication (stats fetched via client query)
- middleware.ts retained (not renamed to proxy.ts): Next.js 16.2.7 deprecation warning only; @supabase/ssr docs target this filename; rename deferred to Next.js upgrade
- lib/supabase/index.ts NOT created: would shadow lib/supabase.ts and break existing imports
- getUser() used instead of getSession(): authoritative Auth server validation
- D-02 silent-redirect: callback always redirects to / — no OAuth error detail exposed to client
- session_uuid initialized to '' in makeInitialGameState (not a UUID) — startGame() overwrites it; prevents stale ID on replay
- session_uuid type is string (not string|null) — simplifies Phase 4 schema (uuid NOT NULL column)
- crypto.randomUUID() used as browser built-in in use client lobby component — no import required
- [Phase ?]: GRACE_MS reduced to 15s (D-04/D-06): covers phone screen-lock without keeping ghost players for 60s
- [Phase ?]: landing.players_hint updated to Conseille/Recommended phrasing (D-15): string-only change in i18n dictionaries
- [Phase 03 P03]: idx_players_pseudo_lower uses CREATE UNIQUE INDEX not ADD CONSTRAINT — PostgreSQL rejects expression-based UNIQUE constraints via ALTER TABLE
- [Phase 03 P03]: Index scoped to (room_id, LOWER(pseudo)) — uniqueness is per room and case-insensitive; error code 23505 on violation (caught in join page Plan 05)
- [Phase 03 P04]: VoteTimer initialSecs derived from round_started_at elapsed time, clamped [0,30] with NaN guard for pre-Phase3 in-flight games
- [Phase 03 P04]: Vote resolution threshold uses vote_round_player_count || players.length fallback; 0 (factory default) correctly triggers fallback to live players.length
- [Phase 03 P05]: inline pseudo-taken error uses pseudoError state + 23505 branch; reconnect path (getPlayerId + existing row reuse) unchanged
- [Phase 03 P05]: storedPseudo pre-population via maybeSingle query on stored pid; hint hidden when user edits
- [Phase 03 P05]: lobby onQuit — no window.confirm; mirrors game onQuit; clearPlayerId + delete player + promote oldest or delete room (SC-3)
- [Phase 03 P05]: startGame sets gs.round_started_at and gs.vote_round_player_count before DB write (not in makeInitialGameState)
- [Phase 03 P06]: ChoiceScreen display denominator frozen to gs.vote_round_player_count || players.length (SC-8)
- [Phase 03 P06]: VoteTimer removed from Type C choice phase — HostSkipBtn is sole AFK fallback (5b locked decision 2026-06-10)
- [Phase 03 P06]: SC-5 lazy-stamp implemented — advancer-elected one-shot effect stamps round_started_at for pre-Phase-3 in-flight rows
- [Phase ?]: SC-4: kluup_pseudo_ key persists pseudo independently of clearPlayerId; pre-fill fallback in /join reads it when pid is null (post-quit)
- [Phase 03 P08]: cleanup_dead_rooms() threshold lowered from 30 minutes to 60 seconds; pg_cron scheduled every minute ('* * * * *') via idempotent block in lifecycle.sql
- [Phase 03 P08]: SC-3 acceptance window relaxed from >15s to ~1 min (server sweep interval); no pagehide/beforeunload handler this pass (locked decision 2026-06-10)
- [Phase ?]: auth namespace i18n foundation
- [Phase 04 P02]: isSignedIn prop threaded via each screen component (not a new context) — explicit, no indirection for a single boolean
- [Phase 04 P02]: flexShrink:0 moved from button to wrapper div so relative-positioned wrapper preserves original layout
- [Phase 04 P02]: getUser() called once at page root mount only (not inside RoundHeader) — satisfies T-04-04 no per-render network calls
- [Phase ?]: [Phase 04 P03]: googlePrefill state tracks Google-origin pre-fill separately from storedPseudo (different hint keys: auth.pseudo_prefilled_hint vs join.pseudo_prefilled_hint)
- [Phase ?]: [Phase 04 P03]: IDEN-02 guard is user && !stored — localStorage entry takes precedence over cross-device lookup
- [Phase ?]: [Phase 04 P04]: googlePrefill state on landing page mirrors join page pattern — hint shown only when pseudo === googlePrefill
- [Phase ?]: [Phase 04 P04]: user_id added only to players insert (host row), not to rooms insert — host_id: genId() unchanged (NOT NULL in prod)

## Notes

- Project initialized from brownfield (Kluup MVP already deployed)
- Phase 1 implementation pre-existed initialization: `app/api/health/route.ts`
- AUTH-04 (anonymous game regression) is a cross-cutting constraint assigned to Phase 2 but applies as a verification gate for Phase 3 as well
- Research flags: Phase 4 needs validation of `session_id` derivation strategy (confirm game_state has a reliable `started_at` timestamp or add one in Phase 2 schema migration)
- RLS silent lockout is the highest-risk pitfall — run full anonymous smoke test after every DB migration

## Current Position

Phase: 04 (signin-ux-player-linking) — COMPLETE (4/4 plans done)
Plan: 4 of 4
Status: All plans complete — Phase 04 done
Last activity: 2026-06-11 -- Phase 04 Plan 04 complete

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 03 P02 | 7m | 3 tasks | 2 files |
| Phase 03 P03 | 2m | 3/3 tasks (migration applied to live DB) | 2 files |
| Phase 03 P04 | 15m | 3 tasks | 1 file |
| Phase 03 P05 | 2min | 4 tasks | 2 files |
| Phase 03 P06 | 15min | 3 tasks | 1 file |
| Phase 03 P07 | 7min | 2 tasks | 2 files |
| Phase 03 P08 | ~2m + human DB apply | 3/3 tasks (pg_cron live, jobid 6, every-minute sweep, 60s threshold) | 3 files |
| Phase 04 P01 | 2min | 1 tasks | 1 files |
| Phase 04 P02 | 15min | 2 tasks | 2 files |
| Phase 04 P03 | 10min | 2 tasks | 1 files |
| Phase 04 P04 | 10min | 2 tasks | 1 files |
