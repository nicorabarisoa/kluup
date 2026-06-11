---
phase: 04-signin-ux-player-linking
plan: "01"
subsystem: ui
tags: [i18n, auth, localization, typescript]

# Dependency graph
requires: []
provides:
  - "auth i18n namespace (sign_in, sign_out, pseudo_prefilled_hint) in fr/en/es/de dictionaries"
  - "Dict type extended with auth namespace — downstream plans can call t.auth.sign_in etc."
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "auth namespace added as top-level key in each locale dictionary, parallel to existing common/home/join/etc."

key-files:
  created: []
  modified:
    - lib/i18n.ts

key-decisions:
  - "auth.pseudo_prefilled_hint is distinct from join.pseudo_prefilled_hint — the former covers Google pre-fill, the latter covers returning-player pre-fill; both keys coexist"

patterns-established:
  - "New i18n namespaces added at the bottom of each locale block, before the closing brace, to keep the fr block as the canonical type source"

requirements-completed: [AUTH-01, AUTH-03]

# Metrics
duration: 2min
completed: 2026-06-11
---

# Phase 04 Plan 01: Auth i18n Namespace Summary

**Added `auth` namespace (sign_in / sign_out / pseudo_prefilled_hint) to all four locale dictionaries in lib/i18n.ts, extending the Dict type automatically via `typeof fr`**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-11T11:28:32Z
- **Completed:** 2026-06-11T11:29:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `auth.sign_in`, `auth.sign_out`, `auth.pseudo_prefilled_hint` added to fr/en/es/de
- Dict type exhaustiveness enforced at compile time (`: Dict` annotation on en/es/de)
- `npm run build` exits 0 — TypeScript gate passed
- Existing `join.pseudo_prefilled_hint` ("Ton ancien pseudo est pré-rempli.") left intact

## Task Commits

Each task was committed atomically:

1. **Task 1: Add auth namespace to all four locale dictionaries** - `3327e42` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `lib/i18n.ts` - Added `auth: { sign_in, sign_out, pseudo_prefilled_hint }` block to fr, en, es, and de dictionaries

## Decisions Made
- `auth.pseudo_prefilled_hint` is a **distinct** key from `join.pseudo_prefilled_hint`. The `auth` variant covers the Google-name pre-fill case introduced by Phase 4 OAuth flow; the `join` variant covers the returning-player pid pre-fill (unchanged since Phase 3 P05). Both coexist without collision because they live in separate namespaces.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `auth.sign_in`, `auth.sign_out`, `auth.pseudo_prefilled_hint` are now available on the `Dict` type via `useT()`
- Plans 04-02 through 04-04 can safely reference `t.auth.sign_in` etc. without compiler errors
- No blockers

---
*Phase: 04-signin-ux-player-linking*
*Completed: 2026-06-11*
