---
phase: "03-playtest-quality-fixes"
plan: "01"
subsystem: "data-model"
tags: [types, game-state, timer, vote-threshold]
dependency_graph:
  requires: []
  provides:
    - "GameState.round_started_at (string)"
    - "GameState.vote_round_player_count (number)"
  affects:
    - "lib/game.ts (makeInitialGameState)"
    - "Plans 03-04+ (consumers of the new fields)"
tech_stack:
  added: []
  patterns:
    - "Required (non-optional) fields with runtime truthiness guards for backward compat"
key_files:
  created: []
  modified:
    - "lib/types.ts"
    - "lib/game.ts"
decisions:
  - "Both fields are required (not optional) — runtime uses truthiness guards (round_started_at ? ... : 0 and vote_round_player_count || players.length) to handle in-flight games from before Phase 3"
  - "makeInitialGameState uses literal '' and 0 — no new Date() call, no players reference; callers (startGame, onNextRound, resolveVotes) set real values"
  - "Fields placed after session_uuid at the bottom of GameState to keep backward compat visible"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 03 Plan 01: GameState Data-Model Foundation Summary

Added `round_started_at: string` and `vote_round_player_count: number` to `GameState` and initialised them as `''` / `0` in `makeInitialGameState`, establishing the data contract for refresh-safe timers (D-07) and correct mid-round vote thresholds (D-09).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add round_started_at and vote_round_player_count to GameState | 9ed02e9 | lib/types.ts |
| 2 | Initialise new fields in makeInitialGameState | 140a95d | lib/game.ts |

## What Was Built

Extended the `GameState` TypeScript type in `lib/types.ts` with two new required fields:

- `round_started_at: string` — ISO timestamp set by callers at each voting phase start; `''` for non-voting phases. Downstream plans use it to derive remaining timer time after a page refresh (D-07).
- `vote_round_player_count: number` — snapshot of `players.length` taken when the voting phase started; mid-round joiners are excluded from the current round's completion threshold (D-09). `0` is the fallback sentinel for in-flight games created before Phase 3.

Updated `makeInitialGameState` in `lib/game.ts` to return a valid `GameState` by initialising both fields with their safe zero values (`''` and `0`). No `new Date()` call and no roster reference were added — those are the responsibility of callers.

## Verification

- `npm run build` passes cleanly (TypeScript confirms `GameState` is fully satisfied by `makeInitialGameState`).
- Both fields are last two members of `GameState`, after `session_uuid`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. These fields are intentionally zero-valued in the factory; the real values are set by callers in Plans 03-04.

## Self-Check: PASSED

- `lib/types.ts` — FOUND (contains `round_started_at: string` and `vote_round_player_count: number`)
- `lib/game.ts` — FOUND (contains `round_started_at: ''` and `vote_round_player_count: 0`)
- Commit 9ed02e9 — FOUND
- Commit 140a95d — FOUND
- `npm run build` — PASSED
