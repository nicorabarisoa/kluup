---
phase: 04-signin-ux-player-linking
plan: 02
subsystem: ui
tags: [react, supabase-auth, green-dot, game-header, lobby]

# Dependency graph
requires:
  - phase: 04-signin-ux-player-linking
    provides: supabase auth client (getUser), middleware, auth callback route

provides:
  - isSignedIn boolean state derived from supabase.auth.getUser() in game page root
  - isSignedIn boolean state derived from supabase.auth.getUser() in lobby page root
  - Optional isSignedIn prop on RoundHeader component
  - Conditional 6px green dot (#22c55e) on RoundHeader Quit button (game, all 9 screens)
  - Conditional 6px green dot (#22c55e) on lobby Quit button

affects: [04-signin-ux-player-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isSignedIn boolean pattern: getUser() once at page root mount via empty-dep useEffect, stored as boolean, threaded as optional prop to sub-components"
    - "Green dot indicator: absolute-positioned 6px span inside relative wrapper on Quit button, aria-hidden, conditionally rendered"

key-files:
  created: []
  modified:
    - app/room/[code]/game/page.tsx
    - app/room/[code]/lobby/page.tsx

key-decisions:
  - "isSignedIn prop threaded via each screen component rather than a new context — keeps the pattern explicit and avoids context indirection for a single boolean"
  - "flexShrink: 0 moved from button to wrapper div so the relative wrapper maintains the original layout behavior"
  - "getUser() called once per page mount (not inside RoundHeader) — satisfies T-04-04 DoS mitigation and Pitfall 3/7"

patterns-established:
  - "isSignedIn boolean pattern: derive at page root, pass as optional prop — avoids per-render network calls"
  - "Green dot wrapper: <div style={{ position:relative, display:inline-block }}> wrapping existing button, dot is a positioned span after the button"

requirements-completed: [AUTH-01]

# Metrics
duration: 15min
completed: 2026-06-11
---

# Phase 4 Plan 02: Green Dot Signed-in Indicator Summary

**Conditional 6px green dot on Quit button in game RoundHeader (all 9 screens) and lobby header, driven by a single mount-time supabase.auth.getUser() call**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-11T12:00:00Z
- **Completed:** 2026-06-11T12:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Game page: `isSignedIn` boolean state + `useEffect` mount call added to `GamePage` root; `RoundHeader` gains optional `isSignedIn?: boolean` prop; Quit button wrapped in relative div with conditional green dot; all 9 `<RoundHeader>` call sites updated via each screen component's prop chain
- Lobby page: identical `isSignedIn` state + `useEffect` in `LobbyPage`; lobby Quit button wrapped in relative div with conditional green dot
- Both builds pass (`npm run build` exits 0); anonymous flow structurally unchanged (dot absent, no new gating)

## Task Commits

1. **Task 1: isSignedIn state + green dot to game RoundHeader** - `eed8d69` (feat)
2. **Task 2: isSignedIn state + green dot to lobby Quit button** - `ae7b92f` (feat)

## Files Created/Modified

- `app/room/[code]/game/page.tsx` — Added isSignedIn state/useEffect in GamePage root; updated RoundHeader signature; wrapped Quit button with green dot; propagated isSignedIn through 8 screen components (QuestionSelectionScreen, DesignationVoteScreen, DesignationRevealScreen, ConfessionVoteScreen, B2RouletteScreen, ChoiceScreen, VolunteersRevealScreen, CRouletteScreen) to reach all 9 RoundHeader call sites
- `app/room/[code]/lobby/page.tsx` — Added isSignedIn state/useEffect in LobbyPage; wrapped lobby Quit button with green dot

## Decisions Made

- `isSignedIn` prop threaded via each screen component rather than a new context — keeps the pattern explicit and avoids context indirection for a single boolean used only in the header
- `flexShrink: 0` moved from the `<button>` to the outer `<div>` wrapper so layout behavior is preserved
- `getUser()` called once per page mount only (not inside `RoundHeader`) — satisfies T-04-04 DoS mitigation (no per-render network calls)

## Deviations from Plan

The plan listed 9 `<RoundHeader>` call sites expecting direct passes from the page root. In practice, each call site lives inside a separate screen sub-component (not directly in GamePage), so `isSignedIn` had to be threaded as a prop through each screen function first. This is a natural consequence of the file structure and is not a rule violation — it is an execution detail the plan did not explicitly address. No deviation rules triggered; the implementation matches the intent exactly.

None - plan executed exactly as written in terms of behavior and acceptance criteria.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Green dot indicator complete for game + lobby; anonymous flow regression-safe
- Plan 03 (sign-in button + signed-in chip on landing and join pages) can proceed

## Self-Check: PASSED

- `app/room/[code]/game/page.tsx` — FOUND (isSignedIn state, getUser call, green dot span, 9 RoundHeader call sites)
- `app/room/[code]/lobby/page.tsx` — FOUND (isSignedIn state, getUser call, green dot span)
- Commit `eed8d69` — FOUND
- Commit `ae7b92f` — FOUND
- `npm run build` — exits 0

---
*Phase: 04-signin-ux-player-linking*
*Completed: 2026-06-11*
