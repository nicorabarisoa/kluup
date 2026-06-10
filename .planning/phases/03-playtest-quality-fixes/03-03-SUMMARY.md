---
phase: 03-playtest-quality-fixes
plan: "03"
subsystem: database
tags: [postgres, supabase, unique-index, expression-index, migration]

# Dependency graph
requires:
  - phase: 02-auth-infrastructure-schema
    provides: players table with user_id column (schema baseline for index)
provides:
  - Idempotent migration file supabase/migrations/003-pseudo-unique.sql
  - Case-insensitive per-room pseudo uniqueness via idx_players_pseudo_lower
  - schema.sql updated as source of truth with same idempotent block
affects:
  - plan 03-05 (join page — catches 23505 error code from this index)
  - any future plan that inserts into players table

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgreSQL expression unique index via CREATE UNIQUE INDEX (not ALTER TABLE ADD CONSTRAINT)"
    - "Idempotent DO $$ IF NOT EXISTS (SELECT 1 FROM pg_indexes ...) $$ migration block"

key-files:
  created:
    - supabase/migrations/003-pseudo-unique.sql
  modified:
    - supabase/schema.sql

key-decisions:
  - "Used CREATE UNIQUE INDEX (not ADD CONSTRAINT) — PostgreSQL rejects expression-based UNIQUE constraints via ALTER TABLE"
  - "Index scoped to (room_id, LOWER(pseudo)) — two different rooms can each have a Nico; same-room duplicates rejected"
  - "Idempotent DO block guards via pg_indexes lookup — safe to re-run on DB that already has index"

patterns-established:
  - "Pattern: idempotent expression-index migration using DO $$ IF NOT EXISTS $$ block"

requirements-completed: [SC-1]

# Metrics
duration: 1min
completed: 2026-06-10
---

# Phase 03 Plan 03: Pseudo Uniqueness Constraint Summary

**Case-insensitive per-room pseudo uniqueness enforced via PostgreSQL expression UNIQUE INDEX `idx_players_pseudo_lower ON players (room_id, LOWER(pseudo))`, written as idempotent migration + mirrored into schema.sql — pending human application to live DB**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-06-10T15:49:34Z
- **Completed:** 2026-06-10T15:50:35Z (checkpoint pause)
- **Tasks:** 2 of 3 complete (Task 3 is a blocking human-action checkpoint)
- **Files modified:** 2

## Accomplishments

- Created `supabase/migrations/003-pseudo-unique.sql` with idempotent DO block that creates `idx_players_pseudo_lower`
- Mirrored the same idempotent block into `supabase/schema.sql` after the `idx_players_room_id` line
- Both files verified via automated node check: contain `idx_players_pseudo_lower`, `LOWER(pseudo)`, `CREATE UNIQUE INDEX`, `IF NOT EXISTS`, no `ADD CONSTRAINT`

## Task Commits

1. **Task 1: Write the 003-pseudo-unique.sql migration** - `42856dd` (feat)
2. **Task 2: Mirror the index into the source-of-truth schema.sql** - `c88b222` (feat)
3. **Task 3: Apply the migration to the live Supabase database** - PENDING HUMAN ACTION

## Files Created/Modified

- `supabase/migrations/003-pseudo-unique.sql` — New idempotent migration creating `idx_players_pseudo_lower ON players (room_id, LOWER(pseudo))`
- `supabase/schema.sql` — Added same idempotent DO block after `idx_players_room_id` line, before diagnostic comment block

## Decisions Made

- Used `CREATE UNIQUE INDEX` (not `ALTER TABLE ADD CONSTRAINT`) — PostgreSQL does not support expression-based unique constraints via ADD CONSTRAINT; this is the canonical approach for case-insensitive uniqueness
- Index expression is `(room_id, LOWER(pseudo))` — uniqueness is scoped per room (different rooms may reuse the same pseudo) and case-insensitive
- Idempotency guard checks `pg_indexes` table — if index already exists, the DO block is a no-op

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed ADD CONSTRAINT text from comment**
- **Found during:** Task 1 verification
- **Issue:** The automated verify script checks `!s.includes('ADD CONSTRAINT')`. The migration comment initially mentioned "ADD CONSTRAINT" in its description of what NOT to do, causing the verification to fail
- **Fix:** Rewrote the comment to describe the approach without mentioning the forbidden pattern
- **Files modified:** supabase/migrations/003-pseudo-unique.sql
- **Verification:** `node` verification script returned exit 0
- **Committed in:** 42856dd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 comment wording bug caught by verification)
**Impact on plan:** Trivial — comment-only fix, no functional change.

## Issues Encountered

None beyond the comment-wording fix described above.

## User Setup Required

**Task 3 is a blocking human-action checkpoint.** See the checkpoint section below.

The `idx_players_pseudo_lower` index must be applied to the live Supabase database (project ref `dmxjspnrrgcixzcthgwf`) before Plan 05 (join page 23505 error handling) can be verified end-to-end.

**Steps:**
1. Open Supabase Dashboard → SQL Editor (project `dmxjspnrrgcixzcthgwf`)
2. Pre-flight: run `SELECT room_id, LOWER(pseudo) AS p, COUNT(*) FROM players GROUP BY room_id, LOWER(pseudo) HAVING COUNT(*) > 1;` — resolve any rows before proceeding
3. Paste and run `supabase/migrations/003-pseudo-unique.sql`
4. Confirm: `SELECT indexname FROM pg_indexes WHERE tablename = 'players' AND indexname = 'idx_players_pseudo_lower';` must return one row
5. Smoke-test: join room with "Nico", try joining same room with "nico" — second join must be rejected
6. Re-run migration to confirm idempotency (no error)

## Next Phase Readiness

- SQL files are complete and committed; the index definition is correct
- Task 3 (DB apply) is the only blocker — once applied, Plan 05 can wire the 23505 error UI
- No TypeScript changes in this plan; next build is unaffected

## Known Stubs

None — this plan contains only SQL files. No client-side stub values.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. The index itself is the mitigation for T-03-01 (pseudo uniqueness tampering).

---
*Phase: 03-playtest-quality-fixes*
*Completed: 2026-06-10 (partial — checkpoint at Task 3)*
