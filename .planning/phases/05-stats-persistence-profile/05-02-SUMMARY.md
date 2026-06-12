---
phase: 05-stats-persistence-profile
plan: 02
subsystem: database
tags: [supabase, postgresql, migration, production, checkpoint]

# Dependency graph
requires:
  - phase: 05-stats-persistence-profile
    provides: supabase/migrations/005-stats-columns.sql (Plan 01)
provides:
  - Live prod Supabase DB (dmxjspnrrgcixzcthgwf) with theme/rounds_played/tag_scores columns on user_session_stats
  - AUTH-04 anonymous-regression smoke confirmed post-migration
affects: [05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual SQL-editor apply (no Supabase CLI db push) — Phase 2/3 convention"

key-files:
  created: []
  modified: []

key-decisions:
  - "Migration applied manually via Supabase SQL editor per project convention (no CLI)"
  - "User confirmed columns present, stats_*_own RLS policies intact, anonymous smoke passed"

requirements-completed: [STAT-01 (DB side), STAT-02 (DB side)]

# Metrics
duration: human checkpoint (multi-session)
completed: 2026-06-12
---

# Phase 05 Plan 02: Apply migration to live prod Supabase

## What was done

Human-action checkpoint executed by the operator:

1. **Migration applied** — full contents of `supabase/migrations/005-stats-columns.sql` pasted and run in the Supabase SQL editor for project `dmxjspnrrgcixzcthgwf`. Additive DDL only (`ADD COLUMN IF NOT EXISTS theme text / rounds_played int / tag_scores jsonb` on `user_session_stats`).
2. **Columns verified** — `information_schema.columns` confirmed `theme` (text), `rounds_played` (integer), `tag_scores` (jsonb), all nullable.
3. **RLS verified intact** — `pg_policies` still lists `stats_select_own`, `stats_insert_own`, `stats_update_own`. No policy touched.
4. **AUTH-04 anonymous smoke** — anonymous (incognito) full game: create room, second-tab join, Type A + B + C rounds, end screen, "Rejouer" returns to lobby. No "Room introuvable", no missing players. User sign-off: "applied".

## Deviations / discoveries during the smoke test

The smoke test surfaced three pre-existing bugs unrelated to the migration (column-only DDL); all were fixed and deployed during this checkpoint window:

- `043f119` fix(lobby): host transfer on presence-prune when the host closes their window (presence prune deleted the host row without promoting a new host → lobby stuck with no host).
- `c7458ea` feat(landing): resume-your-game banner from the base URL (global `kluup_last_room` breadcrumb; resume reuses the existing player row — never a new entity).
- `f967ae3` fix(presence): disconnect grace 15s → 20s, applies identically to signed-in and anonymous players.
- `dea4a83` fix(game): vote resolution threshold capped by live roster — `min(vote_round_player_count, players.length)` — so a mid-round disconnect/quit unblocks the round instead of waiting forever; `resolveOnShrink` re-gated on isAdvancer.

## Verification

- Live prod `user_session_stats` has the three new columns (SC-6). ✓
- RLS unchanged; anonymous flow regression-clean (AUTH-04 gate). ✓

## Self-Check: PASSED
