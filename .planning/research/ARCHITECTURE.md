# Architecture Research — v3.0 Superpowers

> **Confidence: HIGH.** Much of the DB groundwork is already done and uncommitted-to-code: `questions.tags` migrated and fully curated, `contextual_questions` table created and seeded (~60 entries), `user_session_stats.tag_scores` declared in `schema.sql`. None is wired to application code yet.

## DB Changes Required

| Table | Change | Status |
|-------|--------|--------|
| `questions` | `tags jsonb` column | **Already done** (`migration_add_tags.sql`) |
| `user_session_stats` | `tag_scores jsonb` field | **Declared, never written** |
| `contextual_questions` | Full table + seed (~60 rows) | **Created and seeded** |
| `contextual_questions` | RLS SELECT policy for anon | **Missing — must add** |
| All others | No changes | — |

**Zero new DB tables required.** Power cards live entirely in `game_state` jsonb. Duo awards have no persistence (pure computation from existing `votes`).

## GameState Changes Required

```typescript
// Feature 4 — Contextual Questions
last_contextual_round: number | null   // prevents back-to-back contextual questions
contextual_question: { template: string; target_player_id: string } | null

// Feature 5 — Power Cards
power_cards: { target: string | null; reveal: string | null }
used_cards: { target: string[]; reveal: string[] }
```

### New GamePhase values
```typescript
'contextual_question'    // between reveal phase and voting_question
'card_target_result'     // all screens see Target card OUI/NON result
'card_reveal_roulette'   // all screens see Reveal card roulette animation
```

## New Components / Files

| File | Feature | Notes |
|------|---------|-------|
| `lib/archetypes.ts` | 1 | `computeTraitScores()`, `computeArchetype()` — pure, no Supabase |
| `lib/awards.ts` | 3 | `computeDuoAwards()` — pure, no Supabase |
| `components/ArchetypeCard.tsx` | 1 | Archetype name + top-3 trait bars |
| `components/BipolarSliders.tsx` | 2 | 6 bipolar axes from cumulative tag_scores |
| `components/DuoAwardsSlide.tsx` | 3 | 4 named awards with player pairs |

Keeping `archetypes.ts` / `awards.ts` out of `lib/game.ts` preserves the engine/UI boundary.

## Modified Components / Files

| File | Change | Features |
|------|--------|----------|
| `lib/types.ts` | Add `Question.tags`, 4 new GameState fields, 3 new GamePhase values | 1, 4, 5 |
| `lib/game.ts` | Update `makeInitialGameState()`, add `triggerContextualQuestion()`, `rollPowerCards()` | 4, 5 |
| `lib/i18n.ts` | 21 archetype names, 6 trait labels, 6 bipolar pole labels, 4 award names, ~10 system strings ×4 langs | 1–5 |
| `app/room/[code]/game/page.tsx` | EndScreen (fetch + compute), onNextRound orchestrator, 3 new screens, PowerCardBadge, b2 5s lock | 1, 3, 4, 5 |
| `app/profile/page.tsx` | Add BipolarSliders, sum tag_scores across sessions | 2 |
| `app/PendingStatsFlusher.tsx` | Compute + write tag_scores (2 extra fetches) | 1 |
| `supabase/schema.sql` | contextual_questions table + RLS SELECT anon | 4 |

## Data Flow Changes

- **EndScreen is the computation hub.** Two queries power archetypes + duo awards + tag_scores write together: `SELECT * FROM votes WHERE room_id = ?` (all votes → duo awards + my votes for archetypes filtered client-side) and `SELECT * FROM questions WHERE id IN (played_question_ids)` (played questions with tags → archetype computation). Cache in state; don't refetch.
- **`onNextRound` becomes a sequential orchestrator** on the elected host device only (existing single-writer pattern): roll power cards → contextual question trigger → DB write → broadcast.
- **Duo awards: computation only, no write path.** Computed fresh each time EndScreen mounts (spec says "no new table").

## Suggested Build Order

1. **Social Archetypes** — no deps, highest standalone value. `lib/archetypes.ts`, `ArchetypeCard.tsx`, `Question.tags` type, EndScreen compute + display, write `tag_scores`, i18n keys. Add `contextual_questions` RLS policy now (prereq for Feature 4).
2. **Duo Awards + 2-Face Share Card** — depends on Phase 1 for Face 2. `lib/awards.ts`, `DuoAwardsSlide.tsx`, refactor share card to flip Face 1 (group + duo) / Face 2 (personal + archetype). Reuse the votes query from archetype computation.
3. **Bipolar Trait Sliders** — depends on Phase 1 having written real `tag_scores`. `BipolarSliders.tsx`, sum tag_scores across sessions on `/profile`, confidence note when < 3 sessions. No DB changes.
4. **Contextual Questions** — first to modify game loop. New GameState fields + `'contextual_question'` phase, `triggerContextualQuestion()`, `onNextRound` modification, `ContextualQuestionScreen`, RLS policy (if not done in Phase 1).
5. **Power Cards** — most complex, touches b2 screen + 2 new phases. `power_cards`/`used_cards` GameState, `rollPowerCards()`, b2 5s host-button lock, `PowerCardBadge`, `onUseTargetCard()`/`onUseRevealCard()`, both result screens.

## Critical Integration Notes for Roadmapper

1. **`makeInitialGameState()` must be backward-safe.** New fields default `null`/`[]`. Null-coalesce any reader (`gs.last_contextual_round ?? null`) so in-flight games started before deploy don't crash.
2. **EndScreen: 2 queries serve all 3 end-of-game features.** Cache; don't refetch.
3. **`PendingStatsFlusher` gets more complex** — 2 extra fetches before writing `tag_scores`; must remain fire-and-forget with error catching.
4. **`onNextRound` orchestration must be atomic-feeling.** Sequence: roll cards → trigger contextual → write → broadcast. Partial failure falls through to normal `voting_question` (try/catch with fallback), never an inconsistent room.
5. **Power card race handled by `used_cards` array, not locks.** 5s host delay is a UX guard; `used_cards` is the durable record. UI checks `power_cards[type] === myId` before rendering the use button — disappears on next state sync.

## Open Questions (flag before relevant phase)
- **Bipolar axis opposite labels** undefined in spec — needed before Phase 3 (e.g., Drôle ↔ Sérieux, Fiable ↔ Spontané, Audacieux ↔ Prudent, Empathique ↔ Détaché, Mystérieux ↔ Transparent, Romantique ↔ Pragmatique).
- **Share card 2-face: tap-to-flip vs scroll conflict** on mobile (longer card) — implementation detail for Phase 2 spec.
- **PendingStatsFlusher stash format** — verify `room_id` + `player_id` are stashed (needed to fetch votes); Phase 1 may need to update stash format.
