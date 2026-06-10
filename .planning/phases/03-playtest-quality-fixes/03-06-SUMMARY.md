---
phase: 03-playtest-quality-fixes
plan: "06"
subsystem: game-page
tags: [type-c, choice-phase, vote-timer, display-denominator, sc-8, sc-5b, sc-5]
dependency_graph:
  requires: []
  provides: [frozen-choice-denominator, no-choice-timer, lazy-round-stamp]
  affects: [app/room/[code]/game/page.tsx]
tech_stack:
  added: []
  patterns: [frozen-snapshot-display, timer-phase-gating, advancer-elected-write]
key_files:
  created: []
  modified:
    - app/room/[code]/game/page.tsx
decisions:
  - "SC-8: ChoiceScreen VoteProgress and HostSkipBtn gate use gs.vote_round_player_count || players.length (frozen snapshot with 0-fallback for pre-Phase-3 rows)"
  - "5b: Type C choice phase has no VoteTimer — design decision locked 2026-06-10; HostSkipBtn is sole AFK fallback"
  - "SC-5: lazy-stamp implemented (optional enhancement) — one-shot advancer-gated effect stamps round_started_at on first observation of a timer-bearing phase with empty value"
metrics:
  duration: "~15min"
  completed: "2026-06-10T21:31:25Z"
  tasks_completed: 3
  files_modified: 1
---

# Phase 03 Plan 06: Type C Choice Phase Display & Timer Fixes Summary

Frozen denominator in the Type C choice-phase pill, removed VoteTimer from ChoiceScreen (locked design decision), and added optional SC-5 lazy-stamp for legacy in-flight game rows.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Freeze Type C choice-phase display denominator (SC-8) | 77a26cf | app/room/[code]/game/page.tsx |
| 2 | Remove VoteTimer from Type C choice phase (5b) | bc56ca3 | app/room/[code]/game/page.tsx |
| 3 | Lazily stamp round_started_at for pre-Phase-3 rows (SC-5) | 24e28c3 | app/room/[code]/game/page.tsx |

## What Was Built

### Task 1 — SC-8: Frozen display denominator in ChoiceScreen

The `VoteProgress` pill and `HostSkipBtn` gate in `ChoiceScreen` previously read the live `players.length`. A 4th player joining mid-choice caused the pill to render `0/4` even though the resolution threshold was frozen at `3` (from `gs.vote_round_player_count`).

Two edits in the `ChoiceScreen` footer:
- `VoteProgress`: `total={players.length}` → `total={gs.vote_round_player_count || players.length}`
- `HostSkipBtn`: `voteCount < players.length` → `voteCount < (gs.vote_round_player_count || players.length)`

The `|| players.length` fallback is preserved in both: `vote_round_player_count` is `0` for pre-Phase-3 rows, and `0 || players.length` correctly falls back to the live roster. No other vote phase display denominator was touched.

### Task 2 — 5b: Remove VoteTimer from ChoiceScreen

Per the locked design decision (2026-06-10), the Type C choice phase must have no vote timer. The timer was removed by:
- Deleting the `VoteTimer` IIFE block (`elapsed`/`initialSecs` + `<VoteTimer>`) from the `ChoiceScreen` footer
- Removing `isAdvancer` from `ChoiceScreen`'s destructured params, inline type, and the `<ChoiceScreen>` call site at ~line 1941

`isAdvancer` remains defined and used by `QuestionSelectionScreen`, `DesignationVoteScreen`, `ConfessionVoteScreen`, and `VoteTimer` — unchanged. The host `HostSkipBtn` remains as the sole AFK fallback (requires `isHost && hasVoted`).

Resolution is unaffected: `submitChoice` → `resolveTypeCChoice` fires at `count >= gs.vote_round_player_count || players.length` which is timer-independent.

### Task 3 — SC-5: Lazy-stamp round_started_at (IMPLEMENTED)

A small one-shot `useEffect` was added after the existing effects (before the early-return guards). It fires when the advancer (smallest `player.id` present) observes a timer-bearing phase (`voting_question | round_a_vote | round_b_vote | round_c_choice`) with an empty `round_started_at`. In that case it writes `new Date().toISOString()` via `updateRoomGameState` directly (using `roomRef.current` to avoid stale closure).

Guards:
- `lazyStampedRef` prevents re-firing on the realtime echo
- Only the advancer writes (same election used by `onForce`) to avoid simultaneous writes
- Uses `playersRef.current` to get the live roster without adding a dependency

SC-5 (mid-round refresh shows remaining timer) is otherwise **resolved by deployment** — the four `initialSecs` IIFE blocks are already correct in HEAD source. The user must push + redeploy to Railway for SC-5 to take effect in production.

## Verification

All automated checks passed:
- `npx tsc --noEmit` — passes with no errors
- `next build` — passes cleanly
- `ChoiceScreen` contains no `VoteTimer` and no `isAdvancer`
- `ChoiceScreen`'s `VoteProgress` uses `gs.vote_round_player_count || players.length`
- `ChoiceScreen`'s `HostSkipBtn` gate uses `(gs.vote_round_player_count || players.length)`

## Deviations from Plan

None — plan executed exactly as written. Task 3 was implemented (not skipped) as the lazy-stamp fit cleanly into the existing effect structure.

## Known Stubs

None.

## Threat Flags

None — changes are display/timer cosmetic within an existing component; no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- Files modified: `app/room/[code]/game/page.tsx` — confirmed present
- Commits: 77a26cf, bc56ca3, 24e28c3 — all present in git log
