# Intel: Context

Synthesized from 4 SPEC documents ingested 2026-06-10.
This file captures cross-cutting context, design rationale, and notes for downstream planning.

---

## Topic: Superpowers Feature Set — Overview

source: all 4 specs (docs/superpowers/specs/)

The four ingested specs form a coherent "Superpowers" feature set intended for a future premium milestone (v3.0+). They are designed to layer on top of the existing game loop without requiring changes to the core anonymous game flow. All four features:

- Work in session-only mode (no account dependency for Phase 1 delivery)
- Are additive — they extend GameState/GamePhase rather than replacing existing logic
- Share the end screen / share card as the primary display surface
- Have zero impact on v2.0 milestone phases (02-auth, 03-playtest-fixes, 04-sign-in, 05-stats)

The features were approved on 2026-06-10 and are ready for implementation planning. They should not be routed into v2.0 phases.

---

## Topic: Feature Dependencies Within the Superpowers Set

source: docs/superpowers/specs/2026-06-10-duo-awards-design.md, docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md

Hard dependency: Duo Awards and Social Profile & Archetypes share the 2-face share card's Face 2. They must be planned in the same milestone or implemented sequentially within it. Duo Awards cannot ship the 2-face card refactor without archetype data for Face 2.

Soft dependency: Power Cards depend on the `round_b2_roulette` phase, which already exists. No new phase ordering changes are needed beyond adding `card_target_result` and `card_reveal_roulette` as post-roulette transient phases.

Contextual Questions are independent — no dependency on the other three features.

Recommended sequencing within a v3.0 milestone:
1. Social Profile & Archetypes (establishes tags schema and archetype calculation)
2. Duo Awards (completes 2-face card refactor using archetype data)
3. Contextual Questions (independent, can be done in parallel or after)
4. Power Cards (requires round_b2_roulette — independent otherwise)

---

## Topic: Schema Changes Required Across All Four Features

source: all 4 specs

Migrations needed (none exist yet):
1. `ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb` — archetypes
2. `CREATE TABLE contextual_questions (...)` — contextual questions
3. (Phase 5 only, deferred) `ALTER TABLE user_session_stats ADD COLUMN tag_scores jsonb` — archetypes cross-session

No new tables needed for duo awards (uses existing votes table).
No schema changes needed for power cards (new fields in game_state jsonb only).

---

## Topic: GameState Extensions Required

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md, docs/superpowers/specs/2026-06-10-power-cards-design.md

New GameState fields to add in lib/types.ts:

From contextual questions spec:
- last_contextual_round: number | null
- contextual_question: { template: string, target_player_id: string } | null

From power cards spec:
- power_cards: { target: string | null, reveal: string | null }
- used_cards: { target: string[], reveal: string[] }

---

## Topic: GamePhase Extensions Required

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md, docs/superpowers/specs/2026-06-10-power-cards-design.md

New GamePhase values to add to the union type in lib/types.ts:
- 'contextual_question' — between reveal and voting_question
- 'card_target_result' — transient, after Target card use
- 'card_reveal_roulette' — transient, after Reveal card use

---

## Topic: i18n Key Volume

source: all 4 specs

Total new i18n keys across all four features (approximate):
- Contextual questions: 2 keys
- Duo awards: 5 keys
- Power cards: 7 keys
- Archetypes: 22 archetype name keys + 6 trait name keys = 28 keys

Total: ~42 new keys, each required in 4 locales (fr, en, es, de) = ~168 string additions to lib/i18n.ts.

---

## Topic: Existing Locked Decisions Confirmed by Specs

source: PROJECT.md (existing), docs/superpowers/specs/2026-06-10-duo-awards-design.md

The duo awards spec explicitly confirms two existing locked decisions:
1. modern-screenshot (not html2canvas) for share card capture
2. Client-side calculation from votes table (no server-side computation)

These are consistent with existing PROJECT.md locked decisions. No conflict.

---

## Topic: Anonymous Game Flow Not Affected

source: all 4 specs

All four features explicitly confirm session-only operation with no account dependency for Phase 1 delivery. The archetypes spec notes that cross-session accumulation is deferred to Phase 5. The contextual questions spec states "Fonctionne en session uniquement — aucune dépendance sur les comptes."

This is consistent with the v2.0 milestone goal of keeping the anonymous game flow unchanged (AUTH-04 requirement).

---

## Topic: Phase 5 Integration Points

source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md

The ROADMAP.md Phase 5 success criterion 6 already states: "user_session_stats includes a tag_scores jsonb field." The archetypes spec (DEC-AR-03) confirms this is the correct integration point. The archetypes feature effectively defines the write path for that field. Phase 5 implementation should reference the archetypes spec for the exact tag_scores schema.
