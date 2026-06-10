---
phase: "03-playtest-quality-fixes"
plan: "04"
subsystem: game-page
tags: [timer, vote-threshold, toast, type-c, realtime]
dependency_graph:
  requires:
    - "GameState.round_started_at (Plan 03-01)"
    - "GameState.vote_round_player_count (Plan 03-01)"
    - "game.player_joined i18n key (Plan 03-02)"
  provides:
    - "VoteTimer.initialSecs prop — refresh-safe remaining time"
    - "snapshot-based vote resolution threshold"
    - "player_joined broadcast + toast notification"
    - "VolunteersRevealScreen 0-volunteer guard"
  affects:
    - "app/room/[code]/game/page.tsx"
tech_stack:
  added: []
  patterns:
    - "IIFE in JSX for derived VoteTimer initialSecs (avoids introducing new render variables)"
    - "Broadcast event pattern extended with player_joined on votes-broadcast channel"
    - "Early-return defensive guard in screen component for 0-length derived array"
key_files:
  created: []
  modified:
    - "app/room/[code]/game/page.tsx"
decisions:
  - "VoteTimer call sites use IIFE (() => { ... })() in JSX to compute elapsed/initialSecs inline without polluting the render scope"
  - "Broadcast send guarded by phase !== 'ended' so no spurious toasts on end screen"
  - "resolveOnShrinkRef uses gs.vote_round_player_count || players.length (same fallback pattern as submitVote/submitChoice)"
  - "VolunteersRevealScreen 0-volunteer guard shows question + footer with no reveal text — keeps the host unblocked even in degenerate state"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-10"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 1
---

# Phase 03 Plan 04: Game Page Threading Summary

Threaded the two new GameState fields through the game page and added the mid-round-join toast and Type C 0-volunteer defensive guard — five surgical change clusters in `app/room/[code]/game/page.tsx`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refresh-safe VoteTimer + snapshot-based vote threshold | 204207c | app/room/[code]/game/page.tsx |
| 2 | Mid-round join toast + player_joined broadcast | b8b76f3 | app/room/[code]/game/page.tsx |
| 3 | Type C 0-volunteer hardening | 5111a38 | app/room/[code]/game/page.tsx |

## What Was Built

### Task 1 — Refresh-safe VoteTimer (SC-5, D-07, D-09)

`VoteTimer` gains an optional `initialSecs?: number` prop (default 30). `useState(initialSecs)` means the countdown starts from the remaining time, not always from 30.

All four call sites (QuestionSelectionScreen, DesignationVoteScreen, ConfessionVoteScreen, ChoiceScreen) now compute:
```
elapsed = gs.round_started_at ? Math.floor((Date.now() - new Date(gs.round_started_at).getTime()) / 1000) : 0
initialSecs = Math.max(0, 30 - elapsed)
```
The `gs.round_started_at ? ... : 0` guard handles in-flight games created before Phase 3 where `round_started_at` is `''` — `new Date('')` is Invalid Date with NaN arithmetic, so the guard safely defaults to `elapsed = 0` (full 30s).

Vote resolution thresholds in `submitVote`, `submitChoice`, and `resolveOnShrinkRef` now use `gs.vote_round_player_count || players.length`. The `||` fallback is critical: in-flight games have `vote_round_player_count === 0` (factory value), and `count >= 0` would always be true, so the fallback to `players.length` prevents a different kind of immediate resolution. Wait — `0` is falsy, so `0 || players.length` evaluates to `players.length`. This is the correct intended behavior.

`resolveVotes` question_selection transition and `onNextRound` both snapshot `round_started_at: new Date().toISOString()` and `vote_round_player_count: playersRef.current.length` (using `playersRef.current` not the stale `players` state to avoid off-by-one on concurrent join).

`VoteProgress total={players.length}` left unchanged — the live roster is the correct denominator for the visual counter; only the resolution threshold uses the snapshot.

### Task 2 — Mid-round join toast (SC-8, D-10)

Two new state/ref additions:
- `const [toastMessage, setToastMessage] = useState<string | null>(null)`
- `const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`

The players-INSERT `postgres_changes` handler now broadcasts `player_joined` on the `votes-broadcast-${r.id}` channel after updating the roster, but only when `currentGs.phase !== 'ended'` — no spurious toast at the end screen.

A third `.on('broadcast', { event: 'player_joined' }, ...)` handler on the same `voteChannel` clears any previous timer, sets the toast message via `fr.game.player_joined(pseudo)`, and schedules auto-dismiss in 2500ms. Clearing the previous timer prevents stacked timers on rapid successive joins.

The toast is rendered inside `GameControlsCtx.Provider`, conditionally when `toastMessage` is non-null:
```jsx
<div role="status" aria-live="polite"
  style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)',
           zIndex:50, background:C.surface, border:`1px solid ${C.border}`,
           borderRadius:24, padding:'8px 16px', maxWidth:280,
           color:'#fff', fontSize:14, fontWeight:500, fontFamily:'var(--font-body)' }}>
  {toastMessage}
</div>
```

### Task 3 — Type C 0-volunteer guard (SC-7, D-11)

`resolveTypeCChoice` already correctly routes 0-volunteer results to `round_c_roulette` — that logic was not touched.

`VolunteersRevealScreen` now starts with an early-return guard:
```typescript
if (vols.length === 0) {
  return (
    <GameScreen header={...} footer={<RoundEndFooter ready isHost={isHost} ... />}>
      <QuestionCard ... />
    </GameScreen>
  )
}
```
This ensures `vols[0].pseudo` is never evaluated on an empty array, and the `volunteers_reveal_one`/`volunteers_reveal_many` text is never shown in a 0-volunteer state. The host can still advance with the `RoundEndFooter`.

## Verification

- `npm run build` passes after all three tasks (TypeScript and build both clean).
- Manual verification required (per 03-VALIDATION.md):
  - SC-5: refresh mid-round shows correct remaining time (not always 30s)
  - SC-8: 3rd player joining mid-vote does not block resolution; shows toast
  - SC-7: Type C with everyone sending someone else goes to roulette, no "répond à voix haute"

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three changes are complete functional implementations.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- app/room/[code]/game/page.tsx: FOUND (modified)
- Commit 204207c: FOUND (Task 1)
- Commit b8b76f3: FOUND (Task 2)
- Commit 5111a38: FOUND (Task 3)
- `VoteTimer` declares `initialSecs` prop: VERIFIED
- All 4 `<VoteTimer ... />` usages pass `initialSecs`: VERIFIED
- `gs.round_started_at ?` guard present: VERIFIED
- `vote_round_player_count || players.length` at resolution sites: VERIFIED
- `round_started_at: new Date().toISOString()` in transitions: VERIFIED
- `toastMessage` state and `toastTimerRef` declared: VERIFIED
- `player_joined` broadcast in INSERT handler: VERIFIED
- `player_joined` listener sets toast message: VERIFIED
- Toast rendered with `role="status"` `position:fixed` `top:16` `maxWidth:280`: VERIFIED
- `VolunteersRevealScreen` early-returns when `vols.length === 0`: VERIFIED
- `vols[0].pseudo` only evaluated when `vols.length >= 1`: VERIFIED
- `npm run build` passes: VERIFIED
