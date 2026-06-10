---
phase: 03-playtest-quality-fixes
plan: 07
subsystem: ui
tags: [localStorage, pseudo, prefill, join, utils]

# Dependency graph
requires:
  - phase: 03-playtest-quality-fixes
    provides: "join page with storedPseudo state + pseudo_prefilled_hint + clearPlayerId identity helpers"
provides:
  - "setLastPseudo / getLastPseudo helpers keyed kluup_pseudo_<CODE> in lib/utils.ts"
  - "Post-quit pseudo pre-fill in /join page — fallback survives clearPlayerId"
  - "setLastPseudo call on every successful join for future pre-fill durability"
affects: [join-page, utils, lobby-quit-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "id/row-independent localStorage key for UX state that must outlive the player row lifecycle"

key-files:
  created: []
  modified:
    - lib/utils.ts
    - app/join/page.tsx

key-decisions:
  - "kluup_pseudo_<CODE> is a separate key from kluup_pid_<CODE> — clearPlayerId must NOT touch it (SC-4 locked decision)"
  - "Pre-fill effect applies remembered fallback first, then DB authoritative override — dual-path handles both quit and reconnect"
  - "setLastPseudo written on every successful join regardless of reconnect vs insert path"

patterns-established:
  - "Pattern: id/row-independent persistence for UX state (pseudo) — separate localStorage key from identity key, survives quit"

requirements-completed: [SC-4]

# Metrics
duration: 7min
completed: 2026-06-10
---

# Phase 03 Plan 07: Pseudo Pre-fill After Quit (SC-4) Summary

**`kluup_pseudo_<CODE>` localStorage key persists last-used pseudo independently of player id/row, enabling editable pre-fill on /join after quit**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-10T21:28:00Z
- **Completed:** 2026-06-10T21:34:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `setLastPseudo` / `getLastPseudo` helpers in `lib/utils.ts` — SSR-safe, try/catch guarded, keyed `kluup_pseudo_<CODE>` (uppercased), independent of `clearPlayerId`
- Updated pre-fill effect in `app/join/page.tsx` to apply `getLastPseudo` as baseline fallback (works after quit when pid is null), with DB row still taking precedence when the reconnect path is intact
- `joinRoom` now calls `setLastPseudo(room.code, pseudo.trim())` right after `setPlayerId`, so the pseudo key is populated on every successful join
- `tsc --noEmit` and `next build` both pass green

## Task Commits

1. **Task 1: Add id/row-independent last-pseudo persistence helpers** - `55338a2` (feat)
2. **Task 2: Wire pseudo pre-fill fallback on join page** - `fa83181` (feat)

## Files Created/Modified

- `lib/utils.ts` — Added `LAST_PSEUDO_PREFIX`, `setLastPseudo(code, pseudo)`, `getLastPseudo(code)`; `clearPlayerId` body left untouched
- `app/join/page.tsx` — Updated import + pre-fill effect with `getLastPseudo` fallback + `setLastPseudo` call in `joinRoom`

## Decisions Made

- `kluup_pseudo_<CODE>` is a separate localStorage key from `kluup_pid_<CODE>` — `clearPlayerId` must not touch it (SC-4 requirement: pseudo survives quit)
- Pre-fill effect applies remembered pseudo as baseline first, then DB value overwrites if the reconnect path is intact — correct behavior for both the post-quit path (no pid) and the reconnect path (pid + row exist)
- `setLastPseudo` is written on every successful join, regardless of whether it was a fresh insert or a reconnect reuse — ensures the key is always current

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC-4 fixed: the pseudo pre-fill now works correctly after an explicit quit
- Plan 08 (final gap closure plan in Phase 03) is ready to proceed
- All changes are purely client-side localStorage helpers — no DB migration, no server changes, no risk of regression on the anonymous game flow

## Self-Check

- [x] `lib/utils.ts` exists and contains `setLastPseudo` + `getLastPseudo` + `LAST_PSEUDO_PREFIX`
- [x] `clearPlayerId` body does NOT reference `kluup_pseudo_`
- [x] `app/join/page.tsx` imports `getLastPseudo` + `setLastPseudo` and calls both
- [x] Commits `55338a2` and `fa83181` exist in git log
- [x] `tsc --noEmit` passes
- [x] `next build` passes

---
*Phase: 03-playtest-quality-fixes*
*Completed: 2026-06-10*
