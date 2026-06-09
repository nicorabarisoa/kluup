---
phase: 02-auth-infrastructure-schema
plan: 03
subsystem: auth
tags: [session, uuid, gamestae, types, lobby, replay]

# Dependency graph
requires:
  - phase: 02-auth-infrastructure-schema
    provides: "GameState type shape, makeInitialGameState, lobby startGame flow"
provides:
  - "GameState.session_uuid: string field — per-session correlation ID"
  - "makeInitialGameState initializes session_uuid to empty string"
  - "startGame() assigns crypto.randomUUID() before writing game_state to DB"
affects:
  - 04-stats-persistence-profile

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "session_uuid initialized empty in makeInitialGameState, populated by caller (startGame)"
    - "crypto.randomUUID() as browser built-in — no import needed in use client components"

key-files:
  created: []
  modified:
    - lib/types.ts
    - lib/game.ts
    - app/room/[code]/lobby/page.tsx

key-decisions:
  - "session_uuid initialized to '' in makeInitialGameState (not a UUID) — generating it there would break reset-on-replay since startGame rebuilds game_state from scratch each time"
  - "crypto.randomUUID() called in startGame() after makeInitialGameState, before supabase room update — ensures every game launch and replay gets a fresh UUID"
  - "session_uuid type is string (not string | null) — simplifies Phase 4 schema (uuid NOT NULL column)"

patterns-established:
  - "Pattern D-01: GameState carries session_uuid as non-secret correlation ID, client-generated, written into open-RLS rooms.game_state jsonb"

requirements-completed: [IDEN-01]

# Metrics
duration: 10min
completed: 2026-06-10
---

# Phase 02 Plan 03: GameState session_uuid Summary

**`session_uuid: string` added to GameState and auto-populated via `crypto.randomUUID()` in lobby `startGame()` — giving every game session a unique, replay-safe correlation ID without any new DB columns**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-10T00:00:00Z
- **Completed:** 2026-06-10T00:00:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `session_uuid: string` to the `GameState` type in `lib/types.ts` (after `b2_revealed`)
- Initialized `session_uuid: ''` in `makeInitialGameState()` in `lib/game.ts` — empty string, not a UUID, so the reset-on-replay flow is preserved
- Added `gs.session_uuid = crypto.randomUUID()` in lobby `startGame()` immediately after `makeInitialGameState`, before the Supabase room update — fresh UUID on every launch including replay
- `npm run build` exits 0; TypeScript type check passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add session_uuid to GameState type and initialize in makeInitialGameState** - `24193cf` (feat)
2. **Task 2: Populate session_uuid in startGame() and confirm build passes** - `7e994cb` (feat)

## Files Created/Modified

- `lib/types.ts` — added `session_uuid: string` field to `GameState` interface (after `b2_revealed`)
- `lib/game.ts` — added `session_uuid: ''` to `makeInitialGameState()` return object
- `app/room/[code]/lobby/page.tsx` — added `gs.session_uuid = crypto.randomUUID()` in `startGame()` after `makeInitialGameState`, votes purge preserved

## Decisions Made

- `session_uuid` initialized to `''` (empty string) in `makeInitialGameState`, NOT a UUID — generating a UUID there would mean the reset-on-replay flow could inadvertently carry a stale value. `startGame()` rebuilds `game_state` entirely, so the empty-string default is always overwritten before the DB write.
- Type is `string` (not `string | null`) — keeps Phase 4 schema simple with `uuid NOT NULL`.
- `crypto.randomUUID()` requires no import in a `'use client'` Next.js component — it's a browser built-in available in all modern browsers and in Node 19+.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text in game.ts contained literal `crypto.randomUUID` string**
- **Found during:** Task 1 verification script
- **Issue:** The inline comment `// startGame() in lobby overwrites this with crypto.randomUUID() before writing to DB` caused the plan's verification regex (`/crypto\.randomUUID/.test(g)`) to fail, since it checks all of `game.ts` for the literal string
- **Fix:** Rephrased the comment to `// startGame() in lobby assigns a fresh UUID via the browser crypto API before writing to DB` — semantically identical, avoids the literal match
- **Files modified:** `lib/game.ts`
- **Verification:** Verification script printed `OK` after the fix
- **Committed in:** `24193cf` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - comment text regression in verification script)
**Impact on plan:** Trivial comment rewording; no behavior change. The verification invariant is correct — `game.ts` must not call `crypto.randomUUID` — and the comment was correctly revised to match.

## Issues Encountered

None beyond the comment-text deviation documented above.

## User Setup Required

None — no new DB columns, no env vars, no external service configuration required.

## Next Phase Readiness

- `GameState.session_uuid` is ready as the D-01 per-session correlation ID
- Phase 4 (`user_session_stats`) can reference `game_state->>'session_uuid'` as its `session_id` column
- AUTH-04 anonymous game regression smoke test is scheduled in plan 02-04 (cross-cutting verification gate)

---
*Phase: 02-auth-infrastructure-schema*
*Completed: 2026-06-10*
