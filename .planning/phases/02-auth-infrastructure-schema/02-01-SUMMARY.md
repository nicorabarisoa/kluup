---
phase: 02
plan: 01
subsystem: database-schema
tags: [supabase, sql, migration, rls, auth]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/002-auth.sql
    - players.user_id column (nullable FK to auth.users)
    - user_session_stats table
    - user_session_stats_unique UNIQUE constraint
    - RLS policies stats_select_own / stats_insert_own / stats_update_own
  affects:
    - supabase/schema.sql (updated canonical source of truth)
tech_stack:
  added: []
  patterns:
    - Additive-only SQL migration (IF NOT EXISTS guards throughout)
    - Scoped RLS (USING/WITH CHECK on auth.uid() = user_id)
    - Idempotent canonical schema (mirrors migration in schema.sql)
key_files:
  created:
    - supabase/migrations/002-auth.sql
  modified:
    - supabase/schema.sql
decisions:
  - "user_session_stats.session_id is uuid NOT NULL (no FK — sourced from game_state.session_uuid set in plan 02-03)"
  - "No DELETE RLS policy on user_session_stats — anon and other users cannot delete rows"
  - "user_session_stats NOT added to supabase_realtime publication — stats are fetched via client query, not Realtime"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-09T22:35:39Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 02 Plan 01: Auth Schema Migration Summary

Additive-only SQL migration adding a nullable `user_id` FK to `players` and creating `user_session_stats` with per-user scoped RLS, mirrored idempotently into `supabase/schema.sql`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create supabase/migrations/002-auth.sql | bc90bcf | supabase/migrations/002-auth.sql (created) |
| 2 | Mirror Phase 2 changes into supabase/schema.sql | 96a4a42 | supabase/schema.sql (modified) |

## What Was Built

### supabase/migrations/002-auth.sql (new)

Standalone additive-only migration safe to run on the live prod DB:

1. `ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` — satisfies IDEN-01; existing player rows stay NULL (anonymous).
2. `CREATE TABLE IF NOT EXISTS user_session_stats` with columns: id, user_id (NOT NULL FK → auth.users CASCADE), session_id (uuid NOT NULL), designated_count, confessed_count, volunteered_count, group_title, played_at — and `CONSTRAINT user_session_stats_unique UNIQUE (user_id, session_id)`.
3. `ALTER TABLE user_session_stats ENABLE ROW LEVEL SECURITY` + three scoped policies (`stats_select_own`, `stats_insert_own`, `stats_update_own`) each guarded by `DROP POLICY IF EXISTS` for idempotency.

### supabase/schema.sql (updated)

Post-Phase-2 canonical idempotent source of truth. The new SQL blocks were inserted in the correct section positions:
- Phase 2 additions (players.user_id + user_session_stats CREATE TABLE) placed after the `votes` table block, before the constraints section.
- user_session_stats RLS block placed after the votes policies block, before the Realtime section.
- All existing rooms/players/votes open anon policies remain byte-for-byte intact.

## Verification Results

Both plan verification scripts passed (exit 0, output `OK`):

```
node -e "...002-auth.sql checks..." → OK
node -e "...schema.sql checks..." → OK
```

Checks confirmed:
- Required patterns present: `ADD COLUMN IF NOT EXISTS user_id`, `REFERENCES auth.users(id) ON DELETE SET NULL`, `CREATE TABLE IF NOT EXISTS user_session_stats`, `UNIQUE (user_id, session_id)`, `ENABLE ROW LEVEL SECURITY`, `auth.uid() = user_id`
- Forbidden patterns absent: `ALTER TABLE rooms`, `DROP POLICY ... ON rooms`, `DROP POLICY ... ON votes`, `ALTER ... host_id`
- Open anon SELECT policies preserved: `rooms_select USING (true)`, `players_select USING (true)`, `votes_select USING (true)`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Mitigation Applied |
|--------|--------------------|
| T-02-01: RLS tampering on rooms/players/votes | Migration is additive-only; verify scripts assert no forbidden patterns; all existing anon policies unchanged |
| T-02-02: user_session_stats information disclosure | RLS USING/WITH CHECK on `auth.uid() = user_id` on all three policies; no DELETE policy blocks anon deletes |
| T-02-03: host_id column tampering | Migration does not touch host_id; verify script asserts no `ALTER ... host_id` |

## Known Stubs

None. This plan produces SQL files only — no UI rendering or data flow involved.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced (SQL files only).

## Next Steps

- Plan 02-02: Create server-side Supabase client (`lib/supabase/server.ts`, `lib/supabase/middleware.ts`) and OAuth callback route (`app/auth/callback/route.ts`)
- Plan 02-03: Add `session_uuid` to `GameState` (lib/types.ts + lib/game.ts + lobby startGame)
- Plan 02-04: [BLOCKING] Push migration 002-auth.sql to live Supabase DB and verify schema post-migration

## Self-Check: PASSED

- supabase/migrations/002-auth.sql: EXISTS
- supabase/schema.sql: EXISTS (modified)
- Commit bc90bcf: EXISTS
- Commit 96a4a42: EXISTS
