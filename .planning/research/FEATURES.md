# Feature Research — v3.0 Superpowers

> All 5 features have approved design specs in `docs/superpowers/specs/`. This cross-references existing game state, vote data model, and social/party game patterns.

## Critical cross-cutting findings

- **Question tagging is the hidden critical path.** Archetypes are blocked by content curation: ~134 questions need manual editorial tagging with 1–3 trait tags each, in 4 languages. Not a code problem — ~2–4h of judgment work that must precede archetype code.
- **Archetypes + Duo Awards are a pair, not siblings.** The 2-faced share card (Face 1 = Duo Awards, Face 2 = Archetype) only makes sense if both ship together. Ship one alone → empty card face or missing card-flip justification.
- **Bipolar Sliders are blocked on cross-session data.** Sliders need `tag_scores` accumulated across multiple sessions in `user_session_stats`. One session's 7 rounds is too noisy. v3.0 delivers the archetype *name* on `/profile` as a preview; full sliders land once cross-session accumulation exists.
- **Power Cards are the highest implementation risk.** 2 new GamePhases, a 5s timed host-button delay, and a race between two card types that must be serialized — all on the B2 roulette, the most emotionally loaded moment. Build last, QA independently.
- **The end screen / share card is the convergence point for 4 of 5 features.** Design the 2-faced card layout as a single unit or rebuild it repeatedly.

---

## Feature 1 — Social Archetypes (6 traits → 21 named archetypes)
### Table stakes
- Algorithm computed from real session behaviour (votes + question tags)
- All 21 archetypes named in i18n (FR/EN/ES/DE)
- Fallback archetype ("Une simple personne") for thin data
- Question tagging migration complete (the blocker)
### Differentiators
- Hybrid archetypes (21 vs 6 makes the system feel specific to you)
- Negative tag points for nuanced profiles
- "Plus tu joues" CTA pointing at the cross-session future
### Anti-features
- Showing archetypes to the whole group (private only)
- Explaining the algorithm to the user
- Forcing a non-fallback archetype on thin data
### Complexity: **High** (content), Low (code)
### Dependencies on existing system
- `questions.tags jsonb` column (new); votes already capture actor behaviour
- End-screen + share card display path

---

## Feature 2 — Bipolar Trait Sliders on /profile
### Table stakes
- 6 sliders with opposite-pole labels (Drôle ↔ Sérieux, etc.)
- Position derived from real `tag_scores`
- "Basé sur N sessions" label; hidden entirely when no data
### Differentiators
- Bipolar framing more engaging than bar charts
- Archetype consistency across /profile and share card
### Anti-features
- Precise % numbers presented as fact (pseudoscientific)
- Public profile / player comparison / leaderboard
- Radar / spider chart
### Complexity: **Low** (UI only), blocked on cross-session `tag_scores`
### Dependencies on existing system
- `user_session_stats.tag_scores jsonb` accumulated across sessions
- `/profile` page (exists)

---

## Feature 3 — Duo Awards (4 named pair awards)
### Table stakes
- 4 awards computed from real vote data (Magnétisme Suspicieux, Même longueur d'onde, Les Ennemis Jurés, Les Complices)
- Minimum threshold (≥2 occurrences) to avoid false positives
- Award slide omitted if < 2 awards qualify
- 2-faced share card with tap-to-flip
### Differentiators
- "Les Ennemis Jurés" — conflict is interesting
- Variété rule: prevents one pair sweeping all awards
- Named awards vs generic labels
### Anti-features
- Ranking all pairs (creates irrelevance)
- Awards visible before the end screen
- A new DB table (pure computation from existing `votes`)
### Complexity: **Medium** (the 2-faced share card refactor is the real work)
### Dependencies on existing system
- `votes` table (exists), share card refactor (shared with Feature 1)

---

## Feature 4 — Contextual Questions (adaptive follow-ups between rounds)
### Table stakes
- Question causally linked to the previous round
- Probability curve (≈0% round 1 → ≈60% round 7)
- Max 1 per round
- Silent skip when no follow-up exists or target player left
- Multilingual templates with `{pseudo}` substitution
- Host-only "Continuer"
### Differentiators
- Multiple sub-questions per parent (prevents memorization)
- "Le jeu reprend la parole" dramatic moment
- Late-game charge (probability rises)
### Anti-features
- Timer on the contextual screen
- Questions every round
- Revealing anonymous vote data in templates
- Player-triggerable questions
- Contextual questions counting as a round
### Complexity: **High** (content curation + new GamePhase + `onNextRound` modification)
### Dependencies on existing system
- New `contextual_questions` table, new `contextual_question` GamePhase
- Round-advance handler, event detection from prior round

---

## Feature 5 — Power Cards (Target & Reveal)
### Table stakes
- Card private to holder only
- 5-second window enforced
- Public announcement on use
- Card consumed after use
- Disabled during "moutons" (100% yes) screen
- Host "Manche suivante" re-enabled after 5s regardless of card use
- Weighted assignment by volunteer count
### Differentiators
- Two distinct card types (Target = spy on a person, Reveal = force a second confession)
- Assignment uncertainty creates anticipation
- Second roulette animation for the Reveal card
### Anti-features
- Cards usable outside `round_b2_roulette`
- Revealing card-holder identity before use
- Auto-resolving the card after 5s
- Blocking all players during the 5s window
### Complexity: **High** (timing mechanics, 2 new GamePhases, anti-race condition)
### Dependencies on existing system
- `game_state.power_cards` jsonb, B2 roulette flow, host advance button

---

## Build Order Recommendation
1. **Archetypes** — unblocks Duo Awards; highest share-card value; start question tagging immediately as a parallel content task
2. **Duo Awards** — design the 2-faced card as a unit with Archetypes; no DB migration
3. **Contextual Questions** — independent of 1/3; content curation is the critical path
4. **Power Cards** — highest risk; ship last; QA independently on the B2 roulette flow
5. **Bipolar Sliders** — blocked on cross-session `tag_scores`; ship archetype name on `/profile` as v3.0 preview, full sliders follow
