# Intel: Requirements

Extracted from 4 SPEC documents ingested 2026-06-10.
These requirements belong to a future milestone (v3.0 Superpowers / Premium Features).
They do NOT map to any phase in the active v2.0 roadmap.

ID convention: REQ-{feature-slug}-{nn}

---

## Contextual Questions (REQ-CQ-*)

source: docs/superpowers/specs/2026-06-10-contextual-questions-design.md

REQ-CQ-01
Description: A `contextual_questions` DB table exists with columns (id uuid, parent_question_id uuid FK → questions ON DELETE CASCADE, template jsonb).
Acceptance criteria:
  - Table created via migration SQL
  - `template` stores multilingual text as `{fr, en, es, de}` jsonb
  - Template variables `{pseudo}` and `{question}` are supported
  - Multiple sub-questions per parent question are possible

REQ-CQ-02
Description: GameState includes `last_contextual_round: number | null` and `contextual_question: {template: string, target_player_id: string} | null`.
Acceptance criteria:
  - Both fields present in GameState type definition in lib/types.ts
  - `contextual_question.template` is the already-resolved string (locale substitution done at trigger time)
  - Defaults to null in makeInitialGameState

REQ-CQ-03
Description: The game engine triggers a contextual question between rounds with probability `round === 1 ? 0 : (round - 1) * 0.10`.
Acceptance criteria:
  - Round 1: probability = 0% (never triggers)
  - Round 7: probability = 60%
  - At most one contextual question per round (blocked by last_contextual_round guard)
  - If no played question has associated sub-questions: silent skip, proceed to voting_question

REQ-CQ-04
Description: When a contextual question triggers, the target player is identified from the most recent round result.
Acceptance criteria:
  - Type A: target = designated_player_ids[0]
  - Type B: target = designated_player_id (roulette winner)
  - Type C volunteers: target = volunteer_player_ids[0]
  - Type C roulette: target = designated_player_id
  - If target player has left the room: silent skip

REQ-CQ-05
Description: A new `contextual_question` GamePhase is inserted between a reveal screen and the next voting_question.
Acceptance criteria:
  - All players see the contextual question screen identically
  - Screen shows: header label, resolved template text, target player pseudo highlighted
  - No timer, no vote interaction
  - "Continue" button is host-only and advances to voting_question

REQ-CQ-06
Description: i18n keys `contextual_header` and `contextual_continue` are added to all four locale dictionaries (fr, en, es, de).
Acceptance criteria:
  - Keys present in lib/i18n.ts Dict type
  - FR: "Le jeu reprend la parole" / "Continuer"
  - EN: "The game speaks up" / "Continue"
  - ES and DE translations provided

---

## Duo Awards (REQ-DA-*)

source: docs/superpowers/specs/2026-06-10-duo-awards-design.md

REQ-DA-01
Description: At end of session, the client computes 5 metrics per unique player pair from a single votes table query.
Acceptance criteria:
  - Metrics computed: mutual_designations, vote_alignment, opposition, confession_overlap, co_volunteers
  - Single supabase.from('votes').select().eq('room_id', roomId) call
  - No new DB table or migration required

REQ-DA-02
Description: Four named duo awards are assigned from the metrics: Magnétisme Suspicieux, Même longueur d'onde, Les Ennemis Jurés, Les Complices.
Acceptance criteria:
  - Magnétisme Suspicieux: pair with highest mutual_designations
  - Même longueur d'onde: pair with highest vote_alignment
  - Les Ennemis Jurés: pair with highest opposition
  - Les Complices: pair with highest (confession_overlap + co_volunteers)
  - Minimum score threshold of 2 required for each award
  - If multiple pairs tie: prefer pair without any other award (variety rule)
  - Award not shown if threshold not met

REQ-DA-03
Description: The duo awards slide is omitted from the end screen if fewer than 2 awards qualify.
Acceptance criteria:
  - 0 or 1 award: slide not rendered
  - 2 or more awards: slide rendered with all qualifying awards

REQ-DA-04
Description: The share card becomes 2-faced with tap-to-toggle interaction.
Acceptance criteria:
  - Face 1: group title + duo awards (same content for all players)
  - Face 2: personal stats + archetype data (per player, depends on REQ-AR-*)
  - Tap anywhere on card toggles between faces
  - "Share" button exports the currently visible face via modern-screenshot
  - Face 1 computed once per room; Face 2 computed per player

REQ-DA-05
Description: i18n keys for all 4 award names and the awards section title are added to all four locale dictionaries.
Acceptance criteria:
  - Keys: award_magnetisme, award_longueur_onde, award_ennemis, award_complices, awards_title
  - All keys present in fr, en, es, de dictionaries in lib/i18n.ts

---

## Power Cards (REQ-PC-*)

source: docs/superpowers/specs/2026-06-10-power-cards-design.md

REQ-PC-01
Description: GameState includes power_cards and used_cards fields tracking card holders and consumption.
Acceptance criteria:
  - power_cards: { target: string | null, reveal: string | null }
  - used_cards: { target: string[], reveal: string[] }
  - Both fields present in GameState type in lib/types.ts
  - Initialized to { target: null, reveal: null } and { target: [], reveal: [] } in makeInitialGameState

REQ-PC-02
Description: At the end of each round, a weighted attribution roll assigns power cards to eligible volunteers.
Acceptance criteria:
  - Eligibility: player volunteered at least once AND does not already hold the card AND has not used the card this game
  - Weight = number of volunteering actions in the game
  - Roll executed by elected host (smallest player_id present) — same pattern as timer advancer
  - Attribution written to game_state via updateRoomGameState + broadcast phase_changed

REQ-PC-03
Description: Power cards are visible and usable only during round_b2_roulette, in a window after reveal.
Acceptance criteria:
  - Host "Next round" button is blocked for 5 seconds after roulette reveal
  - During the 5-second window: card holders see "Use my card" button on their screen only
  - Other players do not see any card UI
  - After 5 seconds: host button unlocks; cards remain usable until host advances

REQ-PC-04
Description: Target card mechanic: holder selects a specific player; their confession answer is revealed publicly.
Acceptance criteria:
  - Card holder sees a player selection list (excluding themselves)
  - Public announcement shown on all screens with template text
  - Result (yes/no) fetched from votes table and displayed publicly
  - Card consumed: used_cards.target.push(player_id), power_cards.target = null

REQ-PC-05
Description: Reveal card mechanic: holder triggers a second revelation from the pool of unrevealed "oui" voters.
Acceptance criteria:
  - Public announcement shown on all screens
  - Candidate pool: votes WHERE answer='oui' EXCLUDING revealed_player_ids and designated_player_id
  - Animated roulette across all pseudos → stops on new reveal
  - Card consumed; revealed_player_ids updated in game_state

REQ-PC-06
Description: Two new GamePhases are added: card_target_result and card_reveal_roulette.
Acceptance criteria:
  - Both phases added to GamePhase union type in lib/types.ts
  - card_target_result: shows Target card outcome
  - card_reveal_roulette: shows Reveal card roulette animation

REQ-PC-07
Description: Cards are automatically disabled under specific conditions.
Acceptance criteria:
  - Sheep screen (100% oui): both cards disabled
  - Reveal card: disabled if no unrevealed "oui" voters remain (total yes = 1, already shown)
  - Card holder leaves room: card lost (power_cards[type] = null)
  - Game ends without card use: card expires silently

REQ-PC-08
Description: i18n keys for all power card UI strings are added to all four locale dictionaries.
Acceptance criteria:
  - Keys: card_target_name, card_reveal_name, card_use_button, card_target_announce, card_target_yes, card_target_no, card_reveal_announce
  - All keys in fr, en, es, de dictionaries
  - Template variables {pseudo} and {pseudo_cible} supported

---

## Social Profile & Archetypes (REQ-AR-*)

source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md

REQ-AR-01
Description: The `questions` table has a `tags jsonb DEFAULT '[]'::jsonb` column added via migration.
Acceptance criteria:
  - Migration: ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb
  - Existing rows default to empty array
  - Tag format: array of {"tag": string, "points": number} objects
  - Points may be negative
  - 1 to 3 tags per question (by curation convention)

REQ-AR-02
Description: All existing questions are curated with appropriate tags before feature launch.
Acceptance criteria:
  - Every question has 0–3 tag objects (0 = untagged, will contribute 0 points)
  - Tags reflect the trait projected/expressed by in-game behavior for that question type
  - Type A: tags the trait projected onto the designated player
  - Type B: tags the trait the player self-attributes
  - Type C: tags courage/empathy traits for volunteers
  - Points: 1 = mild, 2 = moderate, 3 = strong; negatives allowed

REQ-AR-03
Description: In the ended phase, the client calculates the player's trait scores from their own votes and played question tags.
Acceptance criteria:
  - Single query: votes WHERE player_id = myId AND room_id = roomId
  - For each question in game_state.played_question_ids: determine if player was "actor" by type
  - Actor rules: A = in designated_player_ids; B = answer='oui'; C vol = in volunteer_player_ids; C roulette = designated_player_id
  - Apply tag points for actor rounds only
  - Floor each trait score at 0 (negative total → 0 for display)
  - Sum all floored scores = total

REQ-AR-04
Description: Archetype is determined from trait scores using simple and hybrid threshold rules.
Acceptance criteria:
  - If total = 0: archetype = "Une simple personne" (fallback)
  - Simple: single trait > 50% of total → simple archetype for that trait
  - Hybrid: top 2 traits both > 25% AND their percentages within 15% of each other → hybrid archetype
  - 6 simple archetypes and 15 hybrid archetypes defined per spec table
  - Fallback if no threshold met

REQ-AR-05
Description: The archetype and top 3 traits are displayed on the personal face of the share card.
Acceptance criteria:
  - Archetype name shown in uppercase, Bricolage Grotesque display font
  - Top 3 traits shown with percentage and progress bar
  - Archetype block only rendered if total trait points > 0
  - Colors per trait defined at implementation time

REQ-AR-06
Description: i18n keys for all 22 archetype names (21 named + 1 fallback) and 6 trait names are added to all four locale dictionaries.
Acceptance criteria:
  - Archetype keys: archetype_le_farceur, archetype_lagitateur, etc. (21 named + archetype_simple_personne)
  - Trait keys: trait_drole, trait_fiable, trait_audacieux, trait_empathique, trait_mysterieux, trait_romantique
  - All keys present in fr, en, es, de dictionaries in lib/i18n.ts

REQ-AR-07 (Phase 5, deferred)
Description: When stats persistence ships (Phase 5), a `tag_scores jsonb` column is added to `user_session_stats`.
Acceptance criteria:
  - Column added via migration alongside or after Phase 5 stats write
  - Format: {"drole": N, "fiable": N, "audacieux": N, "empathique": N, "mysterieux": N, "romantique": N}
  - Global archetype on /profile computed as sum of tag_scores across all sessions
  - Anonymous users see a CTA to sign in to track archetype evolution
