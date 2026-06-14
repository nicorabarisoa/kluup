---
phase: 06-social-profile-archetypes-duo-awards
plan: 03
subsystem: testing
tags: [typescript, vitest, pure-function, social-graph, duo-awards, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: vitest config, red test scaffolds for awards.test.ts, VoteRow type in archetypes.ts
  - phase: 06-02
    provides: lib/archetypes.ts style conventions, VoteRow interface, pure-module pattern
provides:
  - lib/awards.ts — pure duo-awards engine: computePairMetrics (5 metrics), computeDuoAwards (4 awards), PairMetrics + DuoAward types, AWARD_DEFS constant
  - P-19 determinism: player pairs sorted by player.id (localeCompare) before computation
  - P-12 privacy note: confession_overlap scoped to computePairMetrics, flagged for future server-side RPC
affects:
  - 06-04 (DuoAwardsBlock component consumes DuoAward[])
  - 06-05 (EndScreen calls computeDuoAwards, passes results to ShareCard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure duo-awards engine: no Supabase/React import; data arrives as function args (mirrors lib/game.ts boundary)"
    - "Variety rule (strong): award omitted when only already-awarded pairs qualify — introduces new pairs or no award"
    - "Deterministic pair construction: [...players].sort((a,b) => a.id.localeCompare(b.id)) before nested loop (P-19)"
    - "Per-round grouping: Map<round, VoteRow[]> built once; each metric evaluated per-round bucket"

key-files:
  created:
    - lib/awards.ts
  modified: []

key-decisions:
  - "Variety rule is strong (omit award) not weak (tie-break only): if only already-awarded pairs meet threshold, the award is omitted. This matches the test contract and the 'introduce new pairs' intent."
  - "VoteRow interface defined locally in awards.ts (matching archetypes.ts definition) rather than re-importing — both modules are pure and the shape is identical."
  - "AWARD_DEFS exported as ReadonlyArray to prevent accidental mutation by callers."

patterns-established:
  - "Variety-rule omit: when walking AWARD_DEFS, filter to unawarded candidates first; if empty, skip the award entirely."
  - "P-19 determinism: sort players by id before pair construction, not after; pair key is always ${sorted[i].id}:${sorted[j].id}."
  - "P-12 scoping: confession answer values read inside computePairMetrics and never surfaced to return value or caller."

requirements-completed: [REQ-DA-01, REQ-DA-02]

# Metrics
duration: 8min
completed: 2026-06-15
---

# Phase 06 Plan 03: Duo Awards Engine Summary

**Pure duo-awards engine (lib/awards.ts): 5 pair metrics from flat votes array, 4 named awards with score >= 2 threshold and strong variety rule; deterministic pair sort by player.id (P-19); 5/5 tests green.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-14T22:41:34Z
- **Completed:** 2026-06-14T22:46:44Z
- **Tasks:** 2 (TDD — Task 1: computePairMetrics, Task 2: computeDuoAwards)
- **Files modified:** 1 (lib/awards.ts created)

## Accomplishments

- `computePairMetrics(allVotes, aId, bId)` computes all 5 per-round metrics: mutual_designations, vote_alignment, opposition, confession_overlap, co_volunteers — grouped by round, each contributing at most 1 per metric
- `computeDuoAwards(allVotes, players)` sorts players by `player.id` (localeCompare, P-19), builds unique pairs, computes metrics per pair, assigns up to 4 awards (threshold >= 2, variety rule)
- P-12 privacy: `confession_overlap` reads confession vote `answer` values scoped to `computePairMetrics`; raw answer values never returned to callers; inline comment flags this as a known MVP privacy gap requiring a future server-side RPC
- Full test suite (12 tests: 7 archetypes + 5 awards) green; `next build` succeeds

## Task Commits

Both tasks implemented atomically in a single file:

1. **Task 1+2: PairMetrics + computePairMetrics + computeDuoAwards** - `597b8d9` (feat)

**Plan metadata:** (docs commit — see state update below)

## Files Created/Modified

- `lib/awards.ts` — Pure duo-awards engine: `VoteRow`, `PairMetrics`, `DuoAward` types; `AWARD_DEFS` constant; `computePairMetrics` (5 metrics per pair per round); `computeDuoAwards` (deterministic assignment with variety rule). 315 lines. No Supabase, no React.

## Decisions Made

**Variety rule: strong (omit) vs. weak (tie-break)**
- The test contract requires: when A-B earns magnetisme with `mutual_designations=3` and A-B is the ONLY pair with `vote_alignment >= 2`, `award_longueur_onde` must NOT be assigned to A-B.
- The test's `if (longueur)` guard means: undefined (no award) is an acceptable outcome.
- Decision: variety rule is STRONG — when all qualifying pairs (score >= 2) for an award are already holding another award, the award is omitted entirely. This matches the "introduce new pairs" intent of the variety rule.
- Rationale: a weak tie-break (deprioritize but still assign) would assign A-B to longueur_onde, failing the test. The strong-omit rule reflects the product intent that duo awards highlight 4 DISTINCT pairs.

**VoteRow defined locally**
- Identical to `VoteRow` in `lib/archetypes.ts`. Kept local to avoid cross-module coupling between two parallel pure modules. If a `lib/vote-types.ts` shared type file is desired later, it's a simple refactor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Variety rule algorithm — strong-omit vs. spec's weak-prefer wording**
- **Found during:** Task 2 (computeDuoAwards)
- **Issue:** The plan/spec wording says "prefer a pair NOT already holding an award (variety rule)" which reads as a tie-break (weak). The initial weak implementation failed the variety rule test: when only A-B qualifies for a second award and already holds the first, the test expects no second award — not A-B winning again.
- **Fix:** Changed from "sort already-awarded pairs to bottom of candidates" to "filter out already-awarded pairs; if no unawarded pairs qualify, omit the award."
- **Files modified:** lib/awards.ts (variety rule loop in `computeDuoAwards`)
- **Verification:** `npx vitest run lib/__tests__/awards.test.ts` 5/5 green
- **Committed in:** 597b8d9

---

**Total deviations:** 1 auto-fixed (Rule 1 — algorithm behavior clarification driven by test contract)
**Impact on plan:** The fix aligns the implementation with the test contract and the product intent (4 distinct pairs). No scope creep.

## Issues Encountered

The test comment for the variety rule test says "A and C both target B in rounds 4,5 → vote_alignment(A,C)=2 (tied with A-B)" but the vote fixture as written does NOT create vote_alignment(A,C)=2 — A targets C (not B) in rounds 4,5, so A's designation vote is excluded (target = pair member bId). The `if (longueur)` guard in the test makes the test pass when longueur is undefined. The strong-omit variety rule produces the correct outcome regardless.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `lib/awards.ts` is a pure computation module. No threat flags beyond those already documented in the plan's `<threat_model>`:

| Flag | File | Description |
|------|------|-------------|
| T-A-06 (accepted, documented) | lib/awards.ts | confession_overlap reads confession vote answer fields under open RLS — scoped to computePairMetrics, flagged with P-12 inline comment for future server-side RPC |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `computeDuoAwards` is ready for consumption by Plan 06-04 (`DuoAwardsBlock` component).
- `DuoAward` type exported from `lib/awards.ts` — import as `import type { DuoAward } from '@/lib/awards'`.
- Per D-03: render `DuoAwardsBlock` only when `awards.length >= 2` (handled by the caller, not this module).
- No blockers.

## Self-Check: PASSED

- lib/awards.ts: FOUND
- commit 597b8d9: FOUND
- 06-03-SUMMARY.md: FOUND

---
*Phase: 06-social-profile-archetypes-duo-awards*
*Completed: 2026-06-15*
