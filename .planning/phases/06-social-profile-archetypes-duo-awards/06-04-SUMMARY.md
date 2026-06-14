---
phase: 06-social-profile-archetypes-duo-awards
plan: "04"
subsystem: ui
tags: [react, tailwind, modern-screenshot, inline-styles, archetypes, duo-awards]

requires:
  - phase: 06-02
    provides: TRAIT_COLORS + ArchetypeResult + TraitEntry from lib/archetypes.ts
  - phase: 06-03
    provides: DuoAward type from lib/awards.ts

provides:
  - ArchetypeBlock component (capture-safe, Face 2 — archetype name + top-3 trait bars)
  - DuoAwardsBlock component (capture-safe, Face 1 — emoji + award name + player pair rows)
  - ArchetypeBlockProps + DuoAwardsBlockProps interfaces

affects:
  - 06-05 (ShareCard/EndScreen refactor drops these components in)

tech-stack:
  added: []
  patterns:
    - "Capture-safe components: inline style={} only, no className, no % widths inside share card"
    - "Local C-token constants per component file (C object in game/page.tsx is module-private)"
    - "const fr = useT() convention for all i18n strings"
    - "Explicit integer px bar widths: Math.round(pct / 100 * MAX_BAR_PX) — P-07 enforcement"

key-files:
  created:
    - components/ArchetypeBlock.tsx
    - components/DuoAwardsBlock.tsx
  modified: []

key-decisions:
  - "Bar fill widths use Math.round(pct/100*160) not ${pct}% — % widths render as 0 in off-screen modern-screenshot context (P-07)"
  - "C design tokens copied locally rather than extracting to lib/tokens.ts — minimal change, plan 06-05 can decide on extraction"
  - "Fallback archetype (archetypeKey === 'archetype_fallback') omits divider and all trait rows — silent omission, no placeholder text"
  - "DuoAwardsBlock maps over whatever awards array it receives; length >= 2 guard lives in the caller (Plan 05 ShareCard)"

patterns-established:
  - "Capture-safe component: zero className attributes, all layout via inline style={}"
  - "Dynamic i18n key lookup via (fr.section as Record<string, string>)[dynamicKey] pattern"

requirements-completed: [REQ-AR-05, REQ-DA-03]

duration: 12min
completed: 2026-06-15
---

# Phase 06 Plan 04: Capture-Safe Presentation Components Summary

**Two inline-style-only React components (ArchetypeBlock + DuoAwardsBlock) built for the 540x540 modern-screenshot share card, with explicit integer pixel bar widths and zero Tailwind classes**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-15T00:40:00Z
- **Completed:** 2026-06-15T00:53:25Z
- **Tasks:** 2
- **Files created:** 2 (components/ArchetypeBlock.tsx, components/DuoAwardsBlock.tsx)

## Accomplishments

- `ArchetypeBlock` renders the archetype name (28px Bricolage 800 uppercase) and up to 3 trait bars with TRAIT_COLORS-based fill and explicit `Math.round(pct/100*160)` pixel widths — P-07 compliant
- `DuoAwardsBlock` renders a section label plus one capture-safe row per award (32px emoji cell + award name + `PlayerA & PlayerB` with `·` separator), flex + fixed px layout only
- Both components confirmed capture-safe: `grep className` returns 0 matches; no `%` widths; all strings via `const fr = useT()`
- `npx next build` passes; `npx vitest run` stays 12/12 green

## Task Commits

1. **Task 1: ArchetypeBlock.tsx** — `5809a59` (feat)
2. **Task 2: DuoAwardsBlock.tsx** — `9d58fc0` (feat)

## Files Created/Modified

- `components/ArchetypeBlock.tsx` — Capture-safe archetype block: name + top-3 trait bars with explicit px widths; fallback-safe; TRAIT_COLORS from lib/archetypes.ts; useT() for all strings
- `components/DuoAwardsBlock.tsx` — Capture-safe duo-awards block: section label + emoji/name/pair rows; flex + fixed px only; DuoAward from lib/awards.ts; useT() for all strings

## Decisions Made

- **P-07 bar widths:** `Math.round(pct / 100 * MAX_BAR_PX)` where `MAX_BAR_PX = 160`. Percentage-based widths (`style={{ width: '45%' }}`) compute as 0 in the off-screen `modern-screenshot` context because the container has no rendered width when detached from the visible DOM. Integer px is the only reliable approach.
- **C tokens copied locally:** The `C` design-token object in `game/page.tsx` is module-private. Rather than refactoring to `lib/tokens.ts` (scope creep), the 4 needed hex values (`surface`, `border`, `text`, `muted`) are declared as local constants in each component file. Plan 06-05 can consolidate if desired.
- **Fallback archetype:** `archetypeKey === 'archetype_fallback'` → render name only, omit divider and all trait rows. Silent omission matches the UI spec's "no 'not enough data' message" edge case.
- **DuoAwardsBlock length guard deferred to caller:** The component maps over whatever it receives. The `awards.length >= 2` guard that decides whether to render the block at all lives in the Plan 05 ShareCard refactor — not inside this component.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Both components type-checked on first `next build` attempt with 0 TypeScript errors.

## Stub Tracking

None — both components are pure presentation wiring real typed props from lib/archetypes.ts and lib/awards.ts. No hardcoded empty values, no placeholder text.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. These are pure presentational React components. T-A-10 (bar width rendering) fully mitigated by explicit pixel widths; T-A-09 and T-A-11 accepted per threat register.

## Next Phase Readiness

- `ArchetypeBlock` and `DuoAwardsBlock` are ready for drop-in by Plan 06-05 ShareCard/EndScreen refactor
- Both accept `themeColor` as a prop (from `THEME_META[theme].color` in EndScreen) — no additional token wiring needed
- Plan 06-05 must implement the 2-face `activeCard` state, computation hub (fetchVotes + useMemo), and the off-screen capture div pattern described in 06-PATTERNS.md

## Self-Check

- [x] `components/ArchetypeBlock.tsx` exists (186 lines)
- [x] `components/DuoAwardsBlock.tsx` exists (127 lines)
- [x] Commit 5809a59 verified in git log
- [x] Commit 9d58fc0 verified in git log
- [x] `npx next build` passes — TypeScript clean
- [x] `npx vitest run` — 12/12 green

## Self-Check: PASSED

---
*Phase: 06-social-profile-archetypes-duo-awards*
*Completed: 2026-06-15*
