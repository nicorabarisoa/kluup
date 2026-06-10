# Intel: Constraints

Extracted from 4 SPEC documents ingested 2026-06-10.
All constraints are technical constraints from approved SPEC documents.

---

## CONSTRAINT-CQ-01: contextual_question template resolution must happen at trigger time in active locale

type: protocol
source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md
scope: contextual_questions, i18n

The contextual question template is resolved (variables substituted, locale selected) at trigger time and stored as a plain string in game_state.contextual_question.template. It must NOT be stored as a raw template with unresolved variables. This ensures all players see the same resolved text regardless of individual locale settings.

Template variables: `{pseudo}` (target player's pseudo), `{question}` (parent question text in active locale).

---

## CONSTRAINT-CQ-02: contextual_questions phase has no timer, no vote, no interaction

type: protocol
source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md
scope: GamePhase, game page

The `contextual_question` phase must never have a VoteTimer mounted. Resolution is purely social (spoken out loud). The only in-app action is the host-only "Continue" button. No auto-advance mechanism.

---

## CONSTRAINT-DA-01: Duo awards algorithm must execute in a single Supabase query

type: api-contract
source: docs/superpowers/specs/2026-06-10-duo-awards-design.md
scope: duo awards, end screen

All 5 metrics for all pairs must be computed from a single `supabase.from('votes').select().eq('room_id', roomId)` call. No additional queries or new tables. The computation is purely client-side from the returned rows.

---

## CONSTRAINT-DA-02: Share card must use modern-screenshot, not html2canvas

type: api-contract
source: docs/superpowers/specs/2026-06-10-duo-awards-design.md
scope: share card

This reinforces the existing locked decision in PROJECT.md. The 2-face share card must continue to use modern-screenshot for capture. Confirmed by duo-awards spec explicitly.

---

## CONSTRAINT-DA-03: Face 2 of share card requires archetype data — duo awards and archetypes must ship together or in sequence

type: protocol
source: docs/superpowers/specs/2026-06-10-duo-awards-design.md
scope: share card, feature dependency

Face 2 of the 2-face share card references archetype data (from REQ-AR-*). The duo awards spec explicitly states these two features must be implemented together or in sequence. Shipping the 2-face card without archetype data is invalid — Face 2 would be incomplete.

---

## CONSTRAINT-PC-01: Power card attribution roll must be executed by the elected host (smallest player_id), not by all clients

type: protocol
source: docs/superpowers/specs/2026-06-10-power-cards-design.md
scope: power_cards, anti-race

To prevent race conditions on simultaneous attribution, only the elected host (client with smallest player_id among currently present players) executes the roll and writes game_state. This mirrors the existing timer advancer anti-race pattern in the codebase.

---

## CONSTRAINT-PC-02: Target card result must be fetched from votes table, not from game_state.revealed_player_ids

type: api-contract
source: docs/superpowers/specs/2026-06-10-power-cards-design.md
scope: power_cards, votes table

When the Target card is used, the holder's confession answer for the current round must be fetched directly from the votes table (WHERE player_id = target AND room_id AND round AND vote_type = 'confession'). Do not infer from game_state — game_state only tracks the roulette-revealed player, not all individual confession answers.

---

## CONSTRAINT-PC-03: Reveal card pool excludes already-revealed players and the roulette-designated player

type: api-contract
source: docs/superpowers/specs/2026-06-10-power-cards-design.md
scope: power_cards, revealed_player_ids

When constructing the candidate pool for the Reveal card: fetch votes WHERE answer='oui' for the current round, then EXCLUDE game_state.revealed_player_ids AND game_state.designated_player_id. If the resulting pool is empty, the Reveal card is disabled for this round.

---

## CONSTRAINT-AR-01: Tags on questions must be loaded alongside candidates for archetype calculation

type: api-contract
source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
scope: questions, pickCandidates, game engine

When pickCandidates fetches questions from Supabase, the `tags` jsonb column must be included in the SELECT. Tags must be available on the question objects throughout the game so the end-screen algorithm can access them from played_question_ids without a separate fetch.

---

## CONSTRAINT-AR-02: Negative trait scores are floored at 0 for display, not discarded from calculation

type: protocol
source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
scope: archetypes, score calculation

Trait scores may go negative during accumulation (negative-point tags). At display time, each trait score is individually floored at 0. The floor happens AFTER full accumulation, not per-question. Only the floored values feed into percentage and archetype calculations.

---

## CONSTRAINT-AR-03: Archetype display on share card is conditional on total points > 0

type: nfr
source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
scope: share card, archetype UI

The archetype block (name + trait bars) must not render if the player's total floored trait points equals 0. In that case the personal face of the share card shows only the existing personal stats without any archetype section.

---

## CONSTRAINT-AR-04: Cross-session archetype (tag_scores on user_session_stats) is a Phase 5 dependency

type: schema
source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
scope: user_session_stats, Phase 5

The `tag_scores jsonb` column on `user_session_stats` must only be added as part of or after Phase 5 (Stats Persistence). Adding it earlier would create a partially populated column with no write path. The ROADMAP.md Phase 5 success criteria already include this column (criterion 6).
