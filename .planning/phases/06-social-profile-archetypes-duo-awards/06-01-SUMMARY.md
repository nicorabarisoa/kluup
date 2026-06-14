---
phase: 06
plan: 01
subsystem: test-infrastructure, types, i18n
tags: [vitest, tdd, red-scaffolds, i18n, types]
dependency_graph:
  requires: []
  provides: [vitest-test-runner, red-test-scaffolds, question-tags-type, flip-i18n-keys]
  affects: [lib/types.ts, lib/i18n.ts, package.json]
tech_stack:
  added: [vitest@4.1.8]
  patterns: [TDD red-scaffold, ESM config (.mts), Dict exhaustiveness via next build]
key_files:
  created:
    - vitest.config.mts
    - lib/__tests__/archetypes.test.ts
    - lib/__tests__/awards.test.ts
  modified:
    - package.json
    - package-lock.json
    - lib/types.ts
    - lib/i18n.ts
decisions:
  - "Used vitest.config.mts (not .ts) to force ESM loading — avoids ERR_REQUIRE_ESM on Node 22 without adding 'type:module' to package.json (which would break Next.js build)"
  - "Question.tags typed as optional for backward compat with pre-migration rows and existing pickCandidates results"
  - "flip_to_personal / flip_to_group keys placed in card: section of Dict, enforcing exhaustiveness across all 4 locales via next build"
metrics:
  duration_minutes: 12
  completed_date: "2026-06-15"
  tasks_completed: 3
  files_changed: 7
---

# Phase 06 Plan 01: Wave 0 Foundation Summary

**One-liner:** Vitest test runner installed with .mts ESM config, red scaffolds for archetypes+awards, Question.tags optional field, and flip i18n keys across all 4 locales — Wave 0 foundation complete.

## What Was Built

### Task 1: Vitest Install + Config
- Installed `vitest@4.1.8` as a devDependency via `npm install -D vitest`
- Added `"test": "vitest run"` script to `package.json`
- Created `vitest.config.mts` at repo root targeting `lib/__tests__/**/*.test.ts` with `environment: 'node'`

### Task 2: Red Test Scaffolds (TDD — RED phase)
- Created `lib/__tests__/archetypes.test.ts` with:
  - `computeArchetype` tests: simple archetype (drole >50%), hybrid (drole+empathique co-dominant, gap <15%), fallback (all-zero), topTraits shape
  - `computeTraitScores` tests: floor-at-zero (negative points capped at 0), Type B privacy (answer: true boolean, not 'oui' string)
- Created `lib/__tests__/awards.test.ts` with:
  - `computeDuoAwards` tests: empty result below threshold, award_magnetisme with mutual_designations >= 2, variety rule (different pair for second award when tied), P-19 determinism (player array in 3 different orders → identical normalized awards), lexicographic playerA ordering
- Both test files are RED (expected Wave 0 state: "Cannot find module '../archetypes' / '../awards'")

### Task 3: Question.tags Type + 2 Flip i18n Keys
- `lib/types.ts`: Added `tags?: Array<{ tag: string; points: number }>` to `Question` type (optional for backward compat)
- `lib/i18n.ts`: Added `flip_to_personal` and `flip_to_group` to `card:` section in all 4 locales:
  - FR: "↻ voir ton archétype" / "↻ voir le groupe"
  - EN: "↻ see your archetype" / "↻ see the group"
  - ES: "↻ ver tu arquetipo" / "↻ ver el grupo"
  - DE: "↻ Archetyp ansehen" / "↻ Gruppe ansehen"
- `next build` passes — Dict exhaustiveness holds across fr/en/es/de

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed vitest.config.ts → vitest.config.mts for ESM compatibility**
- **Found during:** Task 1 verification / Task 2 RED phase run
- **Issue:** `vitest run` failed with `ERR_REQUIRE_ESM` — Vitest internals use ESM (via `std-env`) but `vitest.config.ts` was being loaded via CommonJS transformer. Node 22.11.0 + no `"type": "module"` in package.json = CJS-first resolution.
- **Fix:** Renamed `vitest.config.ts` to `vitest.config.mts`. The `.mts` extension forces explicit ESM loading without needing `"type": "module"` in package.json (which would break Next.js build pipeline). Vitest auto-discovers both `.ts` and `.mts` config files.
- **Files modified:** `vitest.config.mts` (new), `vitest.config.ts` (deleted)
- **Commit:** 2187b5d

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 8b8b1e4 | chore(06-01): install Vitest + add test script + vitest.config.ts |
| Task 2 | 2187b5d | test(06-01): add red test scaffolds for archetypes + awards; fix config to .mts |
| Task 3 | f20b0d2 | feat(06-01): add Question.tags type + card flip i18n keys (fr/en/es/de) |

## Known Stubs

None. This plan is purely infrastructure (test runner, type additions, i18n keys). No UI data paths are introduced.

## Threat Flags

None. The only new trust boundary crossed is the `vitest` npm install (T-A-01 in plan threat model — mitigated: Vitest is a first-party Vite org package with 30M+ weekly downloads, pinned via package-lock.json).

## Self-Check: PASSED
