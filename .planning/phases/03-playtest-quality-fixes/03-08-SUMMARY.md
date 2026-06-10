---
phase: 03-playtest-quality-fixes
plan: "08"
subsystem: supabase
tags: [pg_cron, lifecycle, cleanup, sc-3, server-sweep]
dependency_graph:
  requires: []
  provides: [SC-3-server-sweep]
  affects: [supabase/lifecycle.sql, .planning/ROADMAP.md, .planning/phases/03-playtest-quality-fixes/03-UAT.md]
tech_stack:
  added: [pg_cron]
  patterns: [server-side-sweep, idempotent-sql-migration]
key_files:
  created: []
  modified:
    - supabase/lifecycle.sql
    - .planning/ROADMAP.md
    - .planning/phases/03-playtest-quality-fixes/03-UAT.md
decisions:
  - "cleanup_dead_rooms() threshold lowered from 30 minutes to 60 seconds (locked decision: user 2026-06-10)"
  - "pg_cron scheduled every minute via '* * * * *' expression (finest pg_cron granularity)"
  - "SC-3 acceptance window relaxed from >15s to ~1 min (server sweep interval); no pagehide/beforeunload handler this pass"
  - "pg_cron Block 5 is idempotent: unschedule guard precedes cron.schedule to prevent duplicate jobs on re-run"
metrics:
  duration: "~2m (tasks 1-2) + human DB apply (task 3)"
  completed_date: "2026-06-10"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 03 Plan 08: pg_cron server sweep for empty-room deletion — Summary

**One-liner:** Lowered `cleanup_dead_rooms()` idle threshold from 30 min to 60s, added idempotent pg_cron every-minute schedule block, applied to live DB (pg_cron 1.6.4, jobid 6) — SC-3 acceptance window relaxed to ~1 min.

## Status: COMPLETE

All 3 tasks done. Tasks 1 and 2 were automated commits. Task 3 was a blocking human-action checkpoint — the user confirmed pg_cron 1.6.4 is installed, `cleanup_dead_rooms()` was redefined with the 60s threshold, and `cron.schedule('cleanup-dead-rooms', '* * * * *', ...)` was applied live (jobid 6).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Lower cleanup threshold + add pg_cron schedule in lifecycle.sql | `3159c81` | `supabase/lifecycle.sql` |
| 2 | Relax SC-3 acceptance criterion in ROADMAP.md and note it in 03-UAT.md | `5ea6ab9` | `.planning/ROADMAP.md`, `.planning/phases/03-playtest-quality-fixes/03-UAT.md` |
| 3 | Apply the lowered threshold + pg_cron schedule to the live Supabase database | human action | live DB (project `dmxjspnrrgcixzcthgwf`) |

## What Was Built

### Task 1 — `supabase/lifecycle.sql`

`cleanup_dead_rooms()` (Block 3) now uses `interval '60 seconds'` instead of `interval '30 minutes'`. Connected clients refresh `last_activity` via the presence heartbeat (HEARTBEAT_MS = 30s in `lib/usePresence.ts`), which keeps live rooms comfortably under the 60s threshold — only truly-abandoned rooms are swept.

New Block 5 adds the pg_cron schedule, idempotently:
- `CREATE EXTENSION IF NOT EXISTS pg_cron;`
- `SELECT cron.unschedule('cleanup-dead-rooms') WHERE EXISTS (...)` — no-op guard
- `SELECT cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()');` — every minute

The `* * * * *` expression is pg_cron's minimum granularity (every minute), which is why SC-3's guarantee is "~1 min", not ">15s".

### Task 2 — Documentation

- `ROADMAP.md` Phase 3 SC-3: "A room with zero connected players is automatically deleted by the server within ~1 min (pg_cron sweep interval)"
- `03-UAT.md` SC-3 gap entry: added `resolution:` note recording the relaxed window, the plan 03-08 delivery, and the no-pagehide-beacon scope decision

### Task 3 — Live DB Apply (human)

Confirmed by the user:
- `SELECT extname, extversion FROM pg_extension` returned `pg_cron 1.6.4`
- Block 3 (`cleanup_dead_rooms()` with `interval '60 seconds'`) applied — no error
- `cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()')` returned jobid 6

The every-minute sweep is live in production.

## Recommended Manual Verification (pending)

The structural implementation is complete. The SC-3 end-to-end smoke tests (plan steps 6-7) were NOT yet run by the user at the time of this write:

- **Step 6 (SC-3 sweep):** Create a room with 2 players (two tabs), close BOTH tabs (not via Quitter), wait ~70s, attempt to join — must report "Room introuvable". Optionally confirm via `SELECT count(*) FROM rooms WHERE code = '<CODE>';` = 0.
- **Step 7 (live room survival):** With one tab open and heartbeating, wait ~2 min and confirm the room still exists / is still joinable.

These are empirical confirmations of the already-live infrastructure. Run them before the next production playtest.

## Deviations from Plan

None — plan executed exactly as written. Task 3 was a planned checkpoint resolved by the user applying the SQL.

## Security (Threat Model)

- **T-03-08-01 (DoS — orphan rows):** Mitigated. pg_cron every-minute sweep deletes rooms idle for 60s; players + votes cascade.
- **T-03-08-02 (Tampering — live game swept):** Mitigated by design. The presence heartbeat (30s) keeps `last_activity` fresh for any room with a connected client; the 60s threshold ensures live rooms are never swept mid-session. Step-7 smoke test (pending empirical run) will confirm this.
- **T-03-08-03 (EoP — anon callable):** Accepted. `cleanup_dead_rooms()` is `SECURITY DEFINER` and only deletes rooms past the idle threshold. Existing GRANT to anon unchanged. Low-value party-game dataset.

## Known Stubs

None.

## Self-Check: PASSED

- `supabase/lifecycle.sql` exists and modified: `interval '60 seconds'`, `CREATE EXTENSION IF NOT EXISTS pg_cron`, `cron.schedule('cleanup-dead-rooms', '* * * * *', ...)`, unschedule guard — all present; `interval '30 minutes'` absent. Automated node check: PASS.
- `.planning/ROADMAP.md` contains '~1 min' and 'pg_cron'. Automated node check: PASS.
- `.planning/phases/03-playtest-quality-fixes/03-UAT.md` contains '~1 min'. Automated node check: PASS.
- Task 1 commit `3159c81` exists in git log.
- Task 2 commit `5ea6ab9` exists in git log.
- Task 3 (live DB): pg_cron 1.6.4 installed, jobid 6 returned by `cron.schedule` — confirmed by user.
