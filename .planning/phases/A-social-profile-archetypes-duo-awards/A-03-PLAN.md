---
phase: A-social-profile-archetypes-duo-awards
plan: 03
type: tdd
wave: 1
depends_on: ["A-social-profile-archetypes-duo-awards-01"]
files_modified:
  - lib/awards.ts
  - lib/__tests__/awards.test.ts
autonomous: true
requirements: [REQ-DA-01, REQ-DA-02]
must_haves:
  truths:
    - "computeDuoAwards computes 5 metrics per unique player pair from a single flat votes array"
    - "Four named awards are assigned with a score >= 2 threshold and a variety rule (prefer un-awarded pairs on ties)"
    - "Award assignment is deterministic across clients: pairs are sorted by player.id before any computation (P-19)"
    - "npx vitest run exits 0 (awards.test.ts green)"
  artifacts:
    - path: "lib/awards.ts"
      provides: "Pure duo-awards engine: computeDuoAwards, pair metric helpers, DuoAward + PairMetrics types, AWARD_DEFS"
      exports: ["computeDuoAwards"]
      contains: "export function computeDuoAwards("
      min_lines: 90
  key_links:
    - from: "lib/awards.ts"
      to: "lib/types.ts"
      via: "import Player type"
      pattern: "from './types'"
    - from: "lib/awards.ts"
      to: "deterministic pair sort"
      via: "players sorted by id.localeCompare before pair construction"
      pattern: "localeCompare"
---

<objective>
Implement `lib/awards.ts` — the pure, Supabase-free duo-awards engine — driven by the red tests from
Plan 01 (TDD: make them green). It scans all room votes, computes 5 metrics per unique player pair, and
assigns up to 4 named awards (Magnétisme Suspicieux, Même longueur d'onde, Les Ennemis Jurés, Les Complices)
with a score-≥-2 threshold and a variety rule.

Purpose: This is the data brain behind Face 1 of the share card (REQ-DA-01, REQ-DA-02). Determinism is
non-negotiable: every client must derive the SAME Face 1, so players sorted by `player.id` (localeCompare)
before pair construction (P-19). This module runs parallel to Plan 02 (no shared files).
Output: `lib/awards.ts` with all exports green against `lib/__tests__/awards.test.ts`.
</objective>

<artifacts_produced>
## Artifacts this phase produces (Plan 03 contributions)

- New module: `lib/awards.ts`
- New function: `computeDuoAwards(allVotes, players)`
- Internal helper: `computePairMetrics(allVotes, aId, bId)` (may be exported for testing)
- New types: `DuoAward`, `PairMetrics` (exported from `lib/awards.ts`, NOT lib/types.ts)
- New constant: `AWARD_DEFS` (canonical-order award definitions with emoji + score selector)
</artifacts_produced>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md
@.planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md
@docs/superpowers/specs/2026-06-10-duo-awards-design.md
@CLAUDE.md
@lib/game.ts
@lib/types.ts
@lib/__tests__/awards.test.ts
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: PairMetrics + computePairMetrics (5 metrics from flat votes)</name>
  <read_first>
    - lib/__tests__/awards.test.ts (the red metric tests this task must turn green)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md (§ Duo Awards Computation Details → 5 Pair Metrics table; PRIVACY NOTE on confession_overlap; Pattern 2)
    - docs/superpowers/specs/2026-06-10-duo-awards-design.md (canonical metric definitions)
    - supabase/schema.sql (votes columns: round, player_id, vote_type, target_player_id, answer boolean)
    - lib/game.ts (tallyDesignation — Record/reduce counting pattern, no-random-comparator comment)
  </read_first>
  <behavior>
    computePairMetrics(allVotes, aId, bId) returns { mutual_designations, vote_alignment, opposition, confession_overlap, co_volunteers }:
    - mutual_designations: count of rounds where (player_id=a, target=b designation) AND (player_id=b, target=a designation)
    - vote_alignment: count of rounds where a and b both cast designation votes with the same target c, where c !== a and c !== b
    - opposition: count of rounds where exactly one of (a→b, b→a) designation exists (asymmetric), not both
    - confession_overlap: count of rounds where both a and b have a confession vote with answer===true
    - co_volunteers: count of rounds where both a and b have a vote_type='volunteer' vote
    - All metrics are per-round (grouped by votes.round); a round contributes at most 1 to each metric.
  </behavior>
  <action>
    RED→GREEN. Define `interface PairMetrics { mutual_designations: number; vote_alignment: number;
    opposition: number; confession_overlap: number; co_volunteers: number }`. Implement
    `computePairMetrics(allVotes: VoteRow[], aId: string, bId: string): PairMetrics` per <behavior>. Define
    the local `VoteRow` shape `{ id: string; round: number; player_id: string; vote_type: string;
    target_player_id: string | null; answer: boolean | null }`. Group vote rows by `round` once, then evaluate
    each metric per round. Confession overlap uses `answer === true` (boolean — DB column is `answer boolean`).
    PRIVACY (P-12): `confession_overlap` reads other players' confession answers — this is a known MVP gap under
    open RLS. Keep raw vote rows SCOPED to this function; never return or expose `answer` values to callers.
    Add an inline comment flagging confession_overlap as a known MVP privacy gap to move to a server-side RPC
    before premium launch. No fenced code in the action — copy identifiers from A-RESEARCH.md Pattern 2.
  </action>
  <verify>
    <automated>npx vitest run lib/__tests__/awards.test.ts -t "metric"</automated>
  </verify>
  <acceptance_criteria>
    - lib/awards.ts contains `computePairMetrics` returning all 5 named metric fields
    - confession_overlap branch references `answer === true`
    - An inline comment flags confession_overlap as a known MVP privacy gap (P-12)
    - The metric tests in awards.test.ts pass
  </acceptance_criteria>
  <done>computePairMetrics computes all 5 per-pair metrics per round from a flat votes array.</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: computeDuoAwards (deterministic pair sort + threshold + variety rule)</name>
  <read_first>
    - lib/__tests__/awards.test.ts (the computeDuoAwards / determinism / variety red tests)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md (§ Duo Awards Computation Details → Award Assignment Algorithm; Pattern 2; Pitfall 3 / P-19)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md (lib/awards.ts → Deterministic pair sort, Variety-rule award loop, No random comparator)
    - lib/types.ts (Player type)
  </read_first>
  <behavior>
    - Sort players by player.id (localeCompare) BEFORE building unique pairs (P-19 determinism).
    - Build every unique pair; compute PairMetrics for each.
    - AWARD_DEFS in canonical order: award_magnetisme (🧲, mutual_designations), award_longueur_onde (🧠, vote_alignment), award_ennemis (⚔️, opposition), award_complices (🔥, confession_overlap + co_volunteers).
    - For each award def: filter pairs with score >= 2; sort by score desc, then prefer a pair NOT already holding an award (variety rule); assign top candidate; mark its pair key awarded.
    - Award omitted when no pair meets the threshold.
    - Same players in different input order → identical DuoAward[] (keys, winners, scores).
    - Each DuoAward: { awardKey, emoji, playerA, playerB, score }.
  </behavior>
  <action>
    RED→GREEN. Define `interface DuoAward { awardKey: string; emoji: string; playerA: Player; playerB: Player;
    score: number }`. Implement `computeDuoAwards(allVotes: VoteRow[], players: Player[]): DuoAward[]` per
    <behavior>. Start with `const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id))` (P-19 — do NOT
    use a random comparator; lib/game.ts documents the V8 TimSort bias). Build the pair list from `sorted`,
    compute metrics into a Map keyed `${a.id}:${b.id}`, then walk `AWARD_DEFS` in canonical order applying the
    threshold (>= 2) and the variety tie-break (`awardedPairKeys.has(key) ? 1 : 0`, prefer 0). Emojis:
    🧲 / 🧠 / ⚔️ / 🔥 exactly. Return 0–4 awards. The < 2-awards omission of the WHOLE block is a render
    decision handled in Plan 05 (EndScreen) — this function just returns however many qualify. No fenced code.
  </action>
  <verify>
    <automated>npx vitest run lib/__tests__/awards.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - lib/awards.ts contains `export function computeDuoAwards(`
    - lib/awards.ts contains `localeCompare` applied to player ids before pair construction (P-19)
    - lib/awards.ts contains the variety-rule tie-break referencing an `awardedPairKeys` set
    - The determinism test (same players, two orders → identical output) passes
    - All tests in lib/__tests__/awards.test.ts pass: `npx vitest run lib/__tests__/awards.test.ts` exits 0
  </acceptance_criteria>
  <done>computeDuoAwards deterministically assigns up to 4 threshold-gated awards with the variety rule; awards suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client reads all room votes | computeDuoAwards receives every room vote row including confession answers |
| cross-client agreement | Face 1 must be identical on every player's screen — non-deterministic ordering breaks the shared card |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-A-06 | Information disclosure | confession_overlap reads all confession answers (P-12) | accept (documented) | Known MVP privacy gap under open RLS. Mitigation in code: raw `answer` values stay scoped to `computePairMetrics`; never returned to callers or rendered. Flagged in-code + in SUMMARY for a future server-side RPC before premium launch. No new exposure beyond the existing open-RLS posture. |
| T-A-07 | Tampering | cross-client divergence of awards (P-19) | mitigate | Deterministic pair sort by `player.id` (localeCompare) before any computation; no `Math.random()` tie-break. Determinism unit test enforces same-output-across-orders. |
| T-A-08 | Repudiation | none | accept | Pure function, no persistence. |
</threat_model>

<verification>
- `npx vitest run lib/__tests__/awards.test.ts` exits 0 (metrics + assignment + determinism + variety tests green)
- Grep `localeCompare` in lib/awards.ts returns a match (P-19 stable sort present)
- Grep `Math.random` in lib/awards.ts returns NO match (no non-deterministic tie-break)
- `lib/awards.ts` has no Supabase or React import (pure-module boundary)
</verification>

<success_criteria>
- `computePairMetrics` computes all 5 metrics per round; confession_overlap scoped + flagged (P-12)
- `computeDuoAwards` deterministically assigns ≤ 4 awards with threshold ≥ 2 and variety rule
- Pairs sorted by player.id before computation; no random comparator (P-19)
- `lib/awards.ts` exports computeDuoAwards, DuoAward, PairMetrics
- Full awards test suite green
</success_criteria>

<output>
Create `.planning/phases/A-social-profile-archetypes-duo-awards/A-03-SUMMARY.md` when done
</output>
