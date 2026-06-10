---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
current_phase: 03
status: executing
last_updated: "2026-06-10T15:50:35Z"
last_activity: 2026-06-10 -- Phase 03 Plan 03 paused at checkpoint:human-verify (Task 3: apply migration to live DB)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
  percent: 20
---

# Project State

**Last updated:** 2026-06-10
**Current phase:** 03
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

## Notes

- Project initialized from brownfield (Kluup MVP already deployed)
- Phase 1 implementation pre-existed initialization: `app/api/health/route.ts`
- AUTH-04 (anonymous game regression) is a cross-cutting constraint assigned to Phase 2 but applies as a verification gate for Phase 3 as well
- Research flags: Phase 4 needs validation of `session_id` derivation strategy (confirm game_state has a reliable `started_at` timestamp or add one in Phase 2 schema migration)
- RLS silent lockout is the highest-risk pitfall — run full anonymous smoke test after every DB migration

## Current Position

Phase: 03 (playtest-quality-fixes) — EXECUTING
Plan: 3 of 5
Status: Paused at checkpoint:human-verify (Task 3 — apply idx_players_pseudo_lower to live DB)
Last activity: 2026-06-10 -- Phase 03 Plan 03 checkpoint:human-verify

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 03 P02 | 7m | 3 tasks | 2 files |
| Phase 03 P03 | 1m | 2/3 tasks (paused at human-verify checkpoint) | 2 files |
