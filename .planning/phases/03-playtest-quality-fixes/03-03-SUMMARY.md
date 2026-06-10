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
duration: 2min
completed: 2026-06-10
---

# Phase 03 Plan 03: Pseudo Uniqueness Constraint Summary

**Case-insensitive per-room pseudo uniqueness enforced via PostgreSQL expression UNIQUE INDEX `idx_players_pseudo_lower ON players (room_id, LOWER(pseudo))`, written as idempotent migration + mirrored into schema.sql, and applied to the live Supabase database (project ref dmxjspnrrgcixzcthgwf).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-10T15:49:34Z
- **Completed:** 2026-06-10 (Task 3 confirmed applied by user)
- **Tasks:** 3 of 3 complete
- **Files modified:** 2

## Accomplishments

- Created `supabase/migrations/003-pseudo-unique.sql` with idempotent DO block that creates `idx_players_pseudo_lower`
- Mirrored the same idempotent block into `supabase/schema.sql` after the `idx_players_room_id` line
- Both files verified via automated node check: contain `idx_players_pseudo_lower`, `LOWER(pseudo)`, `CREATE UNIQUE INDEX`, `IF NOT EXISTS`, no `ADD CONSTRAINT`
- Migration applied to live Supabase database — user confirmed pre-flight duplicate check was clean and index is live

## Task Commits

1. **Task 1: Write the 003-pseudo-unique.sql migration** — `42856dd` (feat)
2. **Task 2: Mirror the index into the source-of-truth schema.sql** — `c88b222` (feat)
3. **Task 3: Apply the migration to the live Supabase database** — completed by human on 2026-06-10 (no code commit — human-action gate satisfied)

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

None beyond the comment-wording fix described above. Task 3 was a blocking human-action gate; the user confirmed the migration was applied cleanly with a clean pre-flight duplicate check.

## Next Phase Readiness

- SQL files are complete and committed; the index definition is correct and live in the DB
- Plan 05 (join page 23505 error handling) can wire the inline error UI against this index — SC-1 now holds end-to-end
- No TypeScript changes in this plan; next build is unaffected

## Known Stubs

None — this plan contains only SQL files. No client-side stub values.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. The index itself is the mitigation for T-03-01 (pseudo uniqueness tampering).

## Self-Check: PASSED

- `42856dd` — feat(03-03): add 003-pseudo-unique.sql migration — verified in git log
- `c88b222` — feat(03-03): mirror idx_players_pseudo_lower into schema.sql — verified in git log
- Task 3 (DB apply): human-action gate satisfied — user confirmed migration applied to live DB on 2026-06-10

---
*Phase: 03-playtest-quality-fixes*
*Completed: 2026-06-10*
