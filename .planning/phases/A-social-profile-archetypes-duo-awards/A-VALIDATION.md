---
phase: A
slug: social-profile-archetypes-duo-awards
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase A — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: A-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected (no jest.config.*/vitest.config.*/test script in package.json) — **Wave 0 (Plan A-01) installs Vitest** |
| **Config file** | none — Wave 0 creates `vitest.config.ts` (node environment) |
| **Quick run command** | `npx vitest run` (after Wave 0) |
| **Full suite command** | `npx vitest run` + `next build` (Dict exhaustiveness / type safety) |
| **Estimated runtime** | ~5–15 seconds (pure-function unit tests) |

> Natural fit: unit-test the pure computation modules (`lib/archetypes.ts`, `lib/awards.ts`). No Supabase needed for scoring/archetype/duo logic — fixtures drive the tests.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (or `next build` for type-only tasks until the runner exists)
- **After every plan wave:** Full suite (`npx vitest run` + `next build`)
- **Before `/gsd-verify-work`:** Full suite green + manual end-to-end (play game → end screen → archetype + duo awards → export both card faces)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Concrete task IDs are assigned by the planner; this maps requirements → test type so each plan task can attach an `<automated>` verify or a Wave 0 dependency.

| Requirement | Behavior | Test Type | Automated Command | Plan |
|-------------|----------|-----------|-------------------|------|
| REQ-AR-03 | `computeTraitScores()` correct per question type (A/B/C volunteer/C roulette, negative points) | unit | `npx vitest run` | A-02 |
| REQ-AR-04 | `computeArchetype()` applies simple (>50%) / hybrid (co-dominant, gap<15%, both>25%) / fallback thresholds | unit | `npx vitest run` | A-02 |
| REQ-AR-05 | Trait bars use explicit pixel widths inside capture container | code review | grep for `%` width in capture subtree | A-04 |
| REQ-AR-06 / REQ-DA-05 | All new i18n keys present in fr/en/es/de | TypeScript build | `next build` | A-01 |
| REQ-AR-01/02 | Archetype block renders on end screen + tags live on prod | component / manual | render + Supabase tags-live checkpoint | A-05 |
| REQ-DA-01 | `computeDuoAwards()` computes the metrics per pair correctly | unit | `npx vitest run` | A-03 |
| REQ-DA-02 | Variety rule avoids awarding same pair twice; threshold enforced | unit | `npx vitest run` | A-03 |
| REQ-DA-03 | `DuoAwardsBlock` hidden when awards.length < 2 | component / manual | render guard + manual | A-04 / A-05 |
| REQ-DA-04 | Share card captures **active face only**; flip toggle works | integration / manual | `domToBlob` on device; inspect PNG | A-05 |
| P-04 | Type B points never read `game_state.revealed_player_ids` | code review | grep `revealed_player_ids` in `archetypes.ts` (must be absent) | A-02 |
| P-19 | Pair sort stable, keyed on `player.id` | unit | `npx vitest run` | A-03 |

---

## Wave 0 Requirements (Plan A-01)

- [ ] Install + configure Vitest — no framework currently detected
- [ ] `vitest.config.ts` (node env) + `package.json` `"test": "vitest run"` script
- [ ] `lib/__tests__/archetypes.test.ts` — red stubs for REQ-AR-03/04
- [ ] `lib/__tests__/awards.test.ts` — red stubs for REQ-DA-01/02, P-19

*Runner confirmed ABSENT during planning (package.json has only dev/build/start/lint) — Wave 0 installs Vitest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Plan |
|----------|-------------|------------|-------------------|------|
| Tags column live on prod | REQ-AR-01/02 | Kluup applies SQL manually in Supabase dashboard (CLAUDE.md); P-18 text-match migration can silently no-op | Run the two COUNT queries in Supabase SQL editor; tagged count must dominate | A-05 (checkpoint) |
| Share-card 2-face capture fidelity | REQ-DA-04 | Real-device rendering + PNG export can't be asserted headlessly | On a phone: play a 3-round game → end screen → flip card → export Face 1 (group) and Face 2 (personal); confirm no clipping, correct bar widths | A-05 (checkpoint) |
| Archetype + duo awards appear end-to-end; Face 1 identical across clients | REQ-AR-01/02, REQ-DA-03, P-19 | Requires a real multi-player session | 3-player game, reach end, verify each player's archetype + duo awards block; compare Face 1 across two clients | A-05 (checkpoint) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test runner install — Plan A-01)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (2026-06-14)
