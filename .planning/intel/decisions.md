# Intel: Decisions

Extracted from 4 SPEC documents ingested 2026-06-10.
All decisions are proposed (no locked: true flags in this ingest set).
These are future-milestone decisions, not yet integrated into the active v2.0 roadmap.

---

## DEC-CQ-01: Contextual questions use a separate table with FK to parent question

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md
status: proposed
scope: contextual_questions, Supabase schema

Decision: Store contextual follow-up questions in a dedicated `contextual_questions` table (id, parent_question_id FK → questions.id ON DELETE CASCADE, template jsonb). Do NOT embed follow-up text in the `questions` table itself.

Rationale: Approach B chosen (separate table with FK) — allows multiple follow-up sub-questions per parent, clean cascade delete, and keeps the questions table schema unchanged.

---

## DEC-CQ-02: Contextual question trigger probability is round-dependent, capped at one per round

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md
status: proposed
scope: GameState, game trigger logic

Decision: Trigger formula is `round === 1 ? 0 : (round - 1) * 0.10`. A new `last_contextual_round` field in GameState prevents two contextual questions back-to-back. Trigger fires when the host presses "Next round" on a reveal screen.

---

## DEC-CQ-03: Contextual questions insert a new GamePhase between reveal and voting_question

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md
status: proposed
scope: GamePhase enum

Decision: Add `'contextual_question'` to the GamePhase union type. This phase is purely informational (no vote, no timer). The host-only "Continue" button advances to `voting_question` of the next round.

---

## DEC-CQ-04: Contextual question resolution is session-only, no account dependency

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md
status: proposed
scope: contextual_questions

Decision: The contextual questions feature has zero dependency on user accounts. It works for anonymous sessions entirely through GameState fields.

---

## DEC-DA-01: Duo awards calculated client-side from existing votes table, no new DB table

source: docs/superpowers/specs/2026-06-10-duo-awards-design.md
status: proposed
scope: duo awards, Supabase schema

Decision: Approach B chosen (multi-metric awards). A single Supabase query fetches all room votes at the end screen. Five metrics are computed per pair from that data. No migration required.

---

## DEC-DA-02: Awards are only displayed if minimum score threshold of 2 is met

source: docs/superpowers/specs/2026-06-10-duo-awards-design.md
status: proposed
scope: duo awards, end screen

Decision: Each award requires a minimum score of 2 to be granted. The duo awards slide is omitted entirely if fewer than 2 awards qualify. This prevents false positives on short games.

---

## DEC-DA-03: Share card becomes 2-faced (group face + personal face), toggled by tap

source: docs/superpowers/specs/2026-06-10-duo-awards-design.md
status: proposed
scope: share card, end screen UI

Decision: The existing single-face share card is refactored to 2 faces. Face 1 shows group title + duo awards (same for all players). Face 2 shows personal stats + archetype (per player). Tap anywhere on the card toggles between faces. `modern-screenshot` captures the currently visible face.

Note: This decision has a hard dependency on the archetypes feature (DEC-AR-*). The two features must be implemented together or in sequence — Face 2 references archetype data.

---

## DEC-PC-01: Power cards attributed via weighted draw by the elected host (smallest player_id present)

source: docs/superpowers/specs/2026-06-10-power-cards-design.md
status: proposed
scope: power_cards, GameState, anti-race

Decision: Attribution roll runs at the end of each round. The elected host (smallest player_id present) executes the roll and writes to game_state via updateRoomGameState, then broadcasts `phase_changed`. This mirrors the existing timer advancer pattern to avoid race conditions.

---

## DEC-PC-02: Power cards are usable only during round_b2_roulette, within a 5-second window after reveal

source: docs/superpowers/specs/2026-06-10-power-cards-design.md
status: proposed
scope: power_cards, GamePhase, round_b2_roulette

Decision: The host's "Next round" button is blocked for 5 seconds after roulette reveal. During this window, card holders see a "Use my card" button on their screen only. After 5 seconds the host button unlocks; cards remain usable until the host advances.

---

## DEC-PC-03: Power cards introduce two new GamePhases: card_target_result and card_reveal_roulette

source: docs/superpowers/specs/2026-06-10-power-cards-design.md
status: proposed
scope: GamePhase enum

Decision: Add `'card_target_result'` and `'card_reveal_roulette'` to the GamePhase union. These are transient phases triggered by card use, resolving back to the post-reveal state.

---

## DEC-PC-04: Power cards are per-player per-game, single-use, and visible only to the holder

source: docs/superpowers/specs/2026-06-10-power-cards-design.md
status: proposed
scope: power_cards, game_state

Decision: Each card type (target, reveal) is held by at most one player at a time (stored as player_id or null in game_state.power_cards). Used cards are tracked in game_state.used_cards arrays. A card is never shown on other players' screens.

---

## DEC-AR-01: Archetype system uses a tags jsonb column on the questions table

source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
status: proposed
scope: questions table, Supabase schema

Decision: Approach C chosen (2-phase delivery). Phase 1: add `tags jsonb DEFAULT '[]'::jsonb` to `questions`. Tags are arrays of `{"tag": string, "points": number}` objects. Points may be negative.

---

## DEC-AR-02: Archetype calculation is purely client-side in the ended phase

source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
status: proposed
scope: archetypes, game end screen

Decision: In phase `ended`, client fetches `votes WHERE player_id = myId AND room_id = roomId`. For each played question where the player was an "actor", the tag points are accumulated. Floor at 0 per trait. No server-side calculation in Phase 1.

---

## DEC-AR-03: Cross-session archetype deferred to Phase 5 via tag_scores jsonb on user_session_stats

source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
status: proposed
scope: user_session_stats, Phase 5

Decision: Cross-session archetype accumulation is deliberately deferred. When Phase 5 (stats persistence) ships, a `tag_scores jsonb` column is added to `user_session_stats`. The global archetype = sum of tag_scores across all sessions for the account.

---

## DEC-AR-04: 21 named archetypes + 1 fallback determined by simple and hybrid trait thresholds

source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md
status: proposed
scope: archetypes

Decision: Simple archetype: one trait > 50% of total. Hybrid archetype: top 2 traits within 15% of each other AND both > 25%. Fallback: "Une simple personne" when total points = 0 or no threshold met. 6 simple archetypes + 15 hybrid archetypes defined in spec.
