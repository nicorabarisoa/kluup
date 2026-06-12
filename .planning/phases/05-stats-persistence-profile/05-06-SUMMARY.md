---
phase: 05-stats-persistence-profile
plan: "06"
subsystem: database
tags: [postgres, pg_cron, supabase, lifecycle, ttl, cleanup]

# Dependency graph
requires:
  - phase: 03-playtest-quality-fixes
    provides: "cleanup_dead_rooms() pg_cron sweep (jobid 6, every minute, 60s threshold) — Block 3 baseline this plan modifies"
  - phase: 05-stats-persistence-profile
    provides: "05-05 localStorage stash — primary UAT gap fix; this plan is defense-in-depth complement"
provides:
  - "cleanup_dead_rooms() with status-aware CASE TTL: ended rooms exempt from 90s sweep (30-min TTL), all other rooms keep 90s"
  - "idempotent SQL (CREATE OR REPLACE FUNCTION) applied once in the Supabase SQL editor — no new pg_cron job"
affects:
  - room lifecycle
  - end-screen survival after OAuth redirect

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-aware TTL in a single DELETE via CASE expression inside WHERE — no second pg_cron job needed"

key-files:
  created: []
  modified:
    - supabase/lifecycle.sql

key-decisions:
  - "cleanup_dead_rooms() status='ended' TTL set to 30 minutes; all non-ended rooms keep 90s (SC-3 unchanged)"
  - "CASE expression inside WHERE predicate — one DELETE, no separate cron job for ended rooms"
  - "CREATE OR REPLACE FUNCTION — idempotent; re-running the block is a safe no-op"
  - "Block 3 only — Blocks 1/2/4/5 (trigger, FK cascade, pg_cron schedule) left completely untouched"

patterns-established:
  - "Status-aware TTL: CASE WHEN status = 'ended' THEN interval '30 minutes' ELSE interval '90 seconds' END inside DELETE WHERE"

requirements-completed: [PROF-02, STAT-01]

# Metrics
duration: ~5min (Task 1 code) + human DB apply checkpoint
completed: 2026-06-12
---

# Phase 05 Plan 06: Stats Persistence + Profile — Ended-Room TTL Exemption Summary

**cleanup_dead_rooms() rewritten with a CASE-based TTL: ended rooms survive 30 minutes (OAuth-safe), all other rooms swept at 90 seconds (SC-3 intact) — applied live to prod DB**

## Performance

- **Duration:** ~5 min code + async human DB apply checkpoint
- **Started:** 2026-06-12
- **Completed:** 2026-06-12
- **Tasks:** 2 (1 auto + 1 human-action checkpoint)
- **Files modified:** 1

## Accomplishments

- Rewrote `cleanup_dead_rooms()` Block 3 in `supabase/lifecycle.sql` with a status-aware CASE predicate — ended rooms get a 30-minute TTL so the end screen survives a multi-minute OAuth round-trip; non-ended rooms keep the 90s sweep that SC-3 requires
- Defense-in-depth complement to 05-05 (localStorage stash): both mechanisms together ensure stats survive whether the room lives or not
- Human checkpoint confirmed: user ran the updated `CREATE OR REPLACE FUNCTION` in the Supabase SQL editor for project `dmxjspnrrgcixzcthgwf`; `pg_get_functiondef()` output shows `CASE WHEN status = 'ended' THEN interval '30 minutes' / ELSE interval '90 seconds'` is live

## Task Commits

1. **Task 1: Rewrite cleanup_dead_rooms() with status-aware TTL** — `7eb53c8` (chore)
2. **Task 2: Human-action checkpoint** — confirmed applied by user (no code commit)

## Files Created/Modified

- `supabase/lifecycle.sql` — Block 3 `cleanup_dead_rooms()` updated with CASE-based TTL; Blocks 1/2/4/5 untouched

## Decisions Made

- TTL for ended rooms set to 30 minutes — bounded, small, and enough for any realistic OAuth round-trip; ended rooms are a tiny fraction of churn and still get swept
- CASE expression inside the DELETE WHERE — one DELETE statement, no second pg_cron job or separate table scan
- Blocks 1/2/4/5 strictly untouched — pg_cron schedule (jobid 6, every-minute `* * * * *`), activity trigger, and FK cascade stay exactly as they were

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

The updated `cleanup_dead_rooms()` (Block 3) must be applied manually in the Supabase SQL editor — Claude cannot reach the prod DB. The user confirmed this was done: `pg_get_functiondef('cleanup_dead_rooms()'::regprocedure)` shows the CASE-based predicate is live in project `dmxjspnrrgcixzcthgwf`.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: longer-lived-ended-rooms | supabase/lifecycle.sql | Ended rooms survive 30 min instead of 90s — bounded and intentional; accepted (T-05-19, open RLS MVP model, T-05-20) |

## Next Phase Readiness

- Phase 5 is now fully complete (6/6 plans done)
- Both UAT gap-closure plans (05-05 localStorage stash + 05-06 TTL exemption) are live; the OAuth-return stats-loss scenario is addressed on two independent layers
- SC-3 (empty non-ended room auto-deleted within ~1 min) is not regressed — the ELSE branch preserves the 90s threshold for all non-ended rooms

## Self-Check: PASSED

- `supabase/lifecycle.sql` confirmed modified (commit 7eb53c8)
- Commit 7eb53c8 exists in git log
- No files unexpectedly deleted

---
*Phase: 05-stats-persistence-profile*
*Completed: 2026-06-12*
