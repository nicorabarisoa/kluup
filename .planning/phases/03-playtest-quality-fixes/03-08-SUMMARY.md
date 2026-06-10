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
  duration: "79s"
  completed_date: "2026-06-10"
  tasks_completed: 2
  tasks_total: 3
  tasks_blocked_at_checkpoint: 1
  files_modified: 3
---

# Phase 03 Plan 08: pg_cron server sweep for empty-room deletion — Summary

**One-liner:** Lowered `cleanup_dead_rooms()` idle threshold from 30 min to 60s and added an idempotent pg_cron every-minute schedule block — SC-3 acceptance window relaxed to ~1 min.

## Status: BLOCKED AT CHECKPOINT (Task 3 — human must apply SQL to live Supabase DB)

Tasks 1 and 2 are complete and committed. Task 3 is a blocking human-action checkpoint: the updated `supabase/lifecycle.sql` (Block 3 lowered threshold + new Block 5 pg_cron schedule) must be applied to the live Supabase database by a human. Claude cannot run SQL against the Supabase project (`dmxjspnrrgcixzcthgwf`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Lower cleanup threshold + add pg_cron schedule in lifecycle.sql | `3159c81` | `supabase/lifecycle.sql` |
| 2 | Relax SC-3 acceptance criterion in ROADMAP.md and note it in 03-UAT.md | `5ea6ab9` | `.planning/ROADMAP.md`, `.planning/phases/03-playtest-quality-fixes/03-UAT.md` |

## Task 3 (BLOCKED — human-action checkpoint)

**Name:** Apply the lowered threshold + pg_cron schedule to the live Supabase database

**Blocked by:** Claude cannot run SQL against the Supabase project. Human must apply the updated lifecycle.sql blocks in the Supabase SQL editor (project `dmxjspnrrgcixzcthgwf`) and confirm the cron job exists.

## What Was Built

### Task 1 — `supabase/lifecycle.sql`

`cleanup_dead_rooms()` (Block 3) now uses `interval '60 seconds'` instead of `interval '30 minutes'`. Connected clients refresh `last_activity` via the presence heartbeat (HEARTBEAT_MS = 30s in `lib/usePresence.ts`), which keeps live rooms comfortably under the 60s threshold — so only truly-abandoned rooms get swept.

New Block 5 adds the pg_cron schedule, idempotently:
- `CREATE EXTENSION IF NOT EXISTS pg_cron;`
- `SELECT cron.unschedule('cleanup-dead-rooms') WHERE EXISTS (...)` — no-op guard
- `SELECT cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()');` — every minute

The `* * * * *` expression is pg_cron's minimum granularity (every minute), which is why SC-3's guarantee is "~1 min", not ">15s".

### Task 2 — Documentation

- `ROADMAP.md` Phase 3 SC-3: "A room with zero connected players is automatically deleted by the server within ~1 min (pg_cron sweep interval)"
- `03-UAT.md` SC-3 gap entry: added `resolution:` note recording the relaxed window, the plan 03-08 delivery, and the no-pagehide-beacon scope decision

## Deviations from Plan

None — plan executed exactly as written for the two auto tasks. Task 3 is a planned checkpoint.

## Security (Threat Model)

- **T-03-08-01 (DoS — orphan rows):** Mitigated. pg_cron every-minute sweep deletes rooms idle for 60s; players + votes cascade.
- **T-03-08-02 (Tampering — live game swept):** Mitigated by design. The presence heartbeat (30s) keeps `last_activity` fresh for any room with a connected client; the 60s threshold ensures live rooms are never swept mid-session. Step-7 smoke test in the human checkpoint confirms this.
- **T-03-08-03 (EoP — anon callable):** Accepted. `cleanup_dead_rooms()` is `SECURITY DEFINER` and only deletes rooms past the idle threshold. Existing GRANT to anon unchanged. Low-value party-game dataset.

## Known Stubs

None.

## Self-Check: PASSED

- `supabase/lifecycle.sql` exists and modified: interval '60 seconds', CREATE EXTENSION IF NOT EXISTS pg_cron, cron.schedule('cleanup-dead-rooms', '* * * * *', ...), cron.unschedule guard — all present; interval '30 minutes' absent. Automated node check: PASS.
- `.planning/ROADMAP.md` contains '~1 min' and 'pg_cron'. Automated node check: PASS.
- `.planning/phases/03-playtest-quality-fixes/03-UAT.md` contains '~1 min'. Automated node check: PASS.
- Task 1 commit `3159c81` exists in git log.
- Task 2 commit `5ea6ab9` exists in git log.
