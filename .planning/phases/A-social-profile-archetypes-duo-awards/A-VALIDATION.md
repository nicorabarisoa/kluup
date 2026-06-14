---
phase: A
slug: social-profile-archetypes-duo-awards
status: draft
nyquist_compliant: false
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
| **Framework** | None detected (no jest.config.*/vitest.config.*/test script in package.json) — **Wave 0 installs Vitest** (verify before planning) |
| **Config file** | none — Wave 0 creates `vitest.config.ts` |
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

| Requirement | Behavior | Test Type | Automated Command | Notes |
|-------------|----------|-----------|-------------------|-------|
| REQ-AR-03 | `computeTraitScores()` correct per question type (A/B/C volunteer/C roulette, negative points) | unit | `npx vitest run` | Pure; fixture vote arrays |
| REQ-AR-04 | `computeArchetype()` applies simple (>50%) / hybrid (co-dominant, gap<15%, both>25%) / fallback thresholds | unit | `npx vitest run` | All 22 archetypes via fixture scores |
| REQ-AR-05 | Trait bars use explicit pixel widths inside capture container | code review | grep for `%` width in capture subtree | Capture-sizing pitfall P-07 |
| REQ-AR-06 / REQ-DA-05 | All new i18n keys present in fr/en/es/de | TypeScript build | `next build` | `Dict` type forces exhaustiveness |
| REQ-AR-01/02 | Archetype block renders on end screen + personal card face | component / manual | render test or manual | UI per A-UI-SPEC.md |
| REQ-DA-01 | `computeDuoAwards()` computes the metrics per pair correctly | unit | `npx vitest run` | Pure; fixture votes |
| REQ-DA-02 | Variety rule avoids awarding same pair twice; threshold enforced | unit | `npx vitest run` | Tie/edge-case fixtures |
| REQ-DA-03 | `DuoAwardsBlock` hidden when awards.length < 2 | component / manual | render test | Conditional render |
| REQ-DA-04 | Share card captures **active face only**; flip toggle works | integration / manual | `domToBlob` on device; inspect PNG | Off-screen real-size capture |
| P-04 | Type B points never read `game_state.revealed_player_ids` | code review | grep `revealed_player_ids` in `archetypes.ts` (must be absent) | Anonymity boundary |
| P-19 | Pair sort stable, keyed on `player.id` | unit | `npx vitest run` | Same card across all clients |

---

## Wave 0 Requirements

- [ ] Install + configure a test runner (Vitest recommended) — no framework currently detected
- [ ] `vitest.config.ts` + `package.json` test script
- [ ] `lib/__tests__/archetypes.test.ts` — stubs for REQ-AR-03/04
- [ ] `lib/__tests__/awards.test.ts` — stubs for REQ-DA-01/02, P-19

*If a runner is found during planning, Wave 0 collapses to "write test files against existing infra."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Share-card 2-face capture fidelity | REQ-DA-04 | Real-device rendering + PNG export can't be asserted headlessly | On a phone: play a 3-round game → end screen → flip card → export Face 1 (group) and Face 2 (personal); confirm no clipping, correct bar widths |
| Archetype + duo awards appear end-to-end | REQ-AR-01/02, REQ-DA-03 | Requires a real multi-player session | 3-player game, reach end, verify each player's archetype + duo awards block |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test runner install)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
