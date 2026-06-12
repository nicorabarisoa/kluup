---
phase: 05-stats-persistence-profile
plan: 04
subsystem: ui
tags: [supabase, react, next.js, i18n, rls, profile, archetypes]

requires:
  - phase: 05-01
    provides: "profile.* i18n namespace (11 keys) added to all 4 locales; auth infrastructure"
  - phase: 05-02
    provides: "user_session_stats table with RLS stats_select_own scoping reads to auth.uid()"
  - phase: 05-03
    provides: "stats persistence write effect — user_session_stats rows produced by game sessions"

provides:
  - "app/profile/page.tsx — RLS-scoped profile page with auth guard, cumulative stats grid, session history (last 20), dormant archetype block"
  - "Landing page signed-in chip split into name-→-/profile link + separate sign-out tap target (A-02)"

affects: [future-premium-features, social-archetypes-v3]

tech-stack:
  added: []
  patterns:
    - "Profile fetch: single supabase.from('user_session_stats').select('*').order('played_at',{ascending:false}) — RLS auto-scopes, no WHERE needed"
    - "Cumulative over ALL rows; history = allRows.slice(0, 20) (D-07)"
    - "Archetype block dormant while tag_scores total = 0; non-zero render path wired for v3.0 (D-08)"
    - "Chip split pattern: div wrapper (not button) with Link name + button sign-out, stopPropagation (A-02)"

key-files:
  created:
    - app/profile/page.tsx
  modified:
    - app/page.tsx

key-decisions:
  - "Profile page stays all-client ('use client') — no createServerClient / server component (D-41 / RESEARCH Open Question 2)"
  - "Auth guard implemented client-side: getUser() at mount → router.push('/') when unauthenticated; RLS is second layer"
  - "Archetype block ships dormant (fallback 'Une simple personne') until v3.0 wires tag_scores (D-08)"
  - "Landing chip refactored: outer div + Link name + button sign-out (split tap targets within same chip dimensions A-02)"
  - "Cumulative stats reduce over ALL rows; history display capped at 20 (D-07)"

patterns-established:
  - "Inline primitives (PrimaryBtn, GhostBtn, PlayerAvatar) copied per-file — project convention, no shared components/ folder"
  - "getUser() not getSession() for auth validation (ASVS V2)"
  - "NULL-safe theme/rounds_played rendering for pre-Phase-5 rows (Pitfall 4)"

requirements-completed: [PROF-01]

duration: 18min
completed: 2026-06-12
---

# Phase 05 Plan 04: Stats Persistence + Profile — Profile Page + Landing Chip

**RLS-scoped /profile page with auth guard, cumulative stats, last-20 history, dormant archetype block; landing name chip navigates to /profile with sign-out retained as separate tap target**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-12T00:00:00Z
- **Completed:** 2026-06-12
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Created `app/profile/page.tsx` (new): auth-guarded, RLS-scoped fetch from `user_session_stats`, cumulative 2×2 stats grid over all rows, last-20 session history with group title / date / theme / stat badges, dormant archetype block (fallback shown; non-zero path wired for v3.0), empty / loading / error states, all text via i18n
- Modified `app/page.tsx`: split the signed-in chip into two tap targets — `Link href="/profile"` on the name, separate `button` for sign-out with `stopPropagation` — within the same chip dimensions (A-02 locked)
- Build passes (`npm run build`) with `/profile` listed as a static page; TypeScript clean

## Task Commits

1. **Task 1: Build /profile page** - `9117222` (feat)
2. **Task 2: Landing signed-in name chip → /profile** - `fae86b7` (feat)

## Files Created/Modified

- `app/profile/page.tsx` (created, 341 lines) — Full profile page: auth guard, fetch, hero, archetype block, cumulative grid, session history, empty/loading/error states
- `app/page.tsx` (modified) — Signed-in chip split into name Link + sign-out button (A-02)

## Decisions Made

- **All-client profile page (D-41):** Kept `'use client'` with `getUser()` — no server component / `createServerClient`. Avoids a new import pattern for a single auth guard; RLS ensures server-side row scoping regardless.
- **Archetype dormant (D-08):** Block renders the `archetype_fallback` string only when `tag_scores` total is 0. The non-zero path (trait bars, archetype name computation) is implemented but unreachable until v3.0 populates tag_scores.
- **Chip split pattern (A-02):** Changed the wrapping element from `<button>` to `<div>` to allow a `<Link>` and a `<button>` to coexist as siblings without nesting interactive elements; `e.stopPropagation()` on the sign-out button for defense-in-depth.

## Deviations from Plan

None — plan executed exactly as written. The archetype block renders both paths as specified (dormant fallback + wired non-zero path). NULL-safe theme/rounds_played for pre-Phase-5 rows implemented per Pitfall 4.

## Issues Encountered

None.

## Threat Coverage

| Threat | Mitigation applied |
|--------|--------------------|
| T-05-12 (unauthenticated /profile access) | `getUser()` at mount → `router.push('/')` when null |
| T-05-13 (IDOR stats read) | No user_id WHERE clause in URL; RLS `stats_select_own` scopes every SELECT server-side |
| T-05-14 (name-chip nav target) | `/profile` is a same-origin static route — no user-controlled redirect |

## Known Stubs

None — archetype block intentionally shows fallback per D-08 until v3.0 wires tag_scores; this is documented design, not a stub preventing the plan's goal.

## Next Phase Readiness

- PROF-01 complete: signed-in users can view cumulative stats, session history (newest first), and group titles earned
- Auth guard confirmed: unauthenticated visits redirect to `/`
- Archetype block ready to light up in v3.0 without redeploy (D-08)
- Landing `/profile` entry point live (A-02)

---
*Phase: 05-stats-persistence-profile*
*Completed: 2026-06-12*

## Self-Check: PASSED

- `app/profile/page.tsx` exists: FOUND
- `app/page.tsx` modified with /profile link: FOUND
- Commit 9117222 exists: FOUND
- Commit fae86b7 exists: FOUND
- TypeScript: PASS (no output from --noEmit)
- Build: PASS (/profile listed as static page)
