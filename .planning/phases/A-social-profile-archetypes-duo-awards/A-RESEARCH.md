# Phase A: Social Profile & Archetypes + Duo Awards — Research

**Researched:** 2026-06-14
**Domain:** Client-side social-graph computation + 2-face share card refactor (Next.js 16 / Supabase / modern-screenshot)
**Confidence:** HIGH — all findings grounded in existing codebase; no new external dependencies

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Share card is 2-faced. Face 1 (group: group title + duo awards) shows FIRST; tap anywhere on the card flips to Face 2 (personal: existing stats + archetype block). Subtle flip affordance is Claude's discretion.
- **D-02:** Share button sits BELOW the card, outside the flip surface — tap-to-flip never collides with sharing.
- **D-03:** Fewer than 2 qualifying duo awards → Face 1 shows group title alone (no duos block). Archetype block renders only when total points > 0; otherwise `archetype_fallback`.
- **D-04:** "Partager" exports only the currently-visible face. `domToBlob` captures the active face — no multi-face capture (avoids iOS Safari backface-visibility quirks).
- **D-05:** 6 distinct per-trait hues (drôle=amber, fiable=blue, audacieux=red, empathique=green, mystérieux=violet, romantique=pink — exact hex in UI-SPEC). Archetype name UPPERCASE, Bricolage Grotesque 800. Top 3 traits with bar + %. Explicit pixel widths (not %) in capture container.
- **D-06:** Audit tag coverage across all 4 themes × types A/B/C and backfill gaps. "Une simple personne" is a valid outcome only for balanced profiles, not a curation defect.
- **D-07:** Phase A is session-only. No cross-session `/profile` archetype display. `user_session_stats.tag_scores` persistence deferred to Bipolar Sliders phase.
- **D-08:** Optional planner fold-in: if it lands cleanly on the existing stats-save path, also write `tag_scores` to `user_session_stats` in the background (no UI). Fold in only if zero added scope/complexity. Compute `tag_scores` BEFORE the upsert (`ignoreDuplicates: true` makes a partial `{}` write permanent). If folded, `PendingStatsFlusher` stash must carry `room_id` + `player_id` to refetch votes.

### Claude's Discretion
- Exact trait hex palette and bar styling — hex values confirmed in A-UI-SPEC.md.
- Flip affordance microcopy and animation (opacity fade 150ms — no 3D rotateY).
- Precise 2-face layout.
- Determinism: sort player pairs by `player.id` before duo-award computation so every client derives the same Face 1.
- Type B archetype points sourced from `myId`'s own votes only (anonymity boundary).
- `never`-type exhaustiveness guard on any `GamePhase` switch touched.

### Deferred Ideas (OUT OF SCOPE)
- Cross-session archetype on `/profile` + `tag_scores` accumulation display + bipolar trait sliders → Bipolar Sliders phase.
- Contextual questions → Phase B.
- Power cards → Phase C.
- Multi-image/stacked-image export, swipe-to-flip.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-AR-01 | `questions` table gets `tags jsonb DEFAULT '[]'` via idempotent migration | SQL pattern confirmed — `migration_add_tags.sql` already authored; `ALTER TABLE questions ADD COLUMN IF NOT EXISTS` is the correct form |
| REQ-AR-02 | All questions curated with 0–3 tag objects per question type semantics | `migration_add_tags.sql` already contains UPDATE statements for all 4 themes × 3 types; validation query provided |
| REQ-AR-03 | Client-side trait score computation from own votes + played question tags | `fetchVotes` pattern confirmed; `played_question_ids` in `GameState`; `Question` type needs `tags` field |
| REQ-AR-04 | Archetype determined by simple (>50%) / hybrid (both >25%, gap <15%) thresholds | Algorithm fully documented; pure function in `lib/archetypes.ts` |
| REQ-AR-05 | Archetype + top 3 traits displayed on Face 2 of share card | `ArchetypeBlock` component; explicit pixel bar widths per PITFALLS (P-07); capture-safe |
| REQ-AR-06 | 22 archetype i18n keys (21 named + fallback) + 6 trait keys in all 4 locales | Confirmed EXISTING in `lib/i18n.ts` — all keys present in fr/en/es/de |
| REQ-DA-01 | 5 metrics per unique pair from single votes query | Algorithm pattern confirmed; pure computation from `votes` rows |
| REQ-DA-02 | 4 named duo awards with score ≥ 2 threshold + variety rule | Confirmed; deterministic with stable pair sort (P-19) |
| REQ-DA-03 | Duo awards slide omitted if fewer than 2 awards qualify | Edge case from D-03 — planner must verify in `DuoAwardsBlock` render condition |
| REQ-DA-04 | Share card 2-faced with tap-to-toggle, Share exports active face | `modern-screenshot` `domToBlob` pattern reused; `activeCard` state; P-07 prevention |
| REQ-DA-05 | i18n keys for 4 award names + awards section title in all 4 locales | Confirmed EXISTING in `lib/i18n.ts` — `duo_awards.*` keys present fr/en/es/de |
</phase_requirements>

---

## Summary

Phase A adds two mutually-reinforcing social features to the Kluup end screen, both computed purely client-side from data already in the room's `votes` table and `game_state.played_question_ids`. The archetype engine reads a player's own votes and the tags on played questions to derive a trait profile and one of 22 named archetypes. The duo awards engine scans all room votes to identify 4 notable player pairs. Both features feed a refactored share card that gains a second face and a tap-to-flip interaction.

The database groundwork is already complete: `questions.tags` column exists (migrated via `migration_add_tags.sql`), all questions have been tagged, `user_session_stats.tag_scores` is already declared in `schema.sql`, and all i18n keys are present in `lib/i18n.ts`. The application code is the only remaining work — two new pure modules (`lib/archetypes.ts`, `lib/awards.ts`), two new components (`ArchetypeBlock`, `DuoAwardsBlock`), and a refactor of `ShareCard` / `EndScreen` in `app/room/[code]/game/page.tsx`.

The critical risks are: (1) iOS-safe capture discipline — explicit pixel widths for trait bars, active-face-only rendering in the off-screen capture div; (2) anonymity boundary — Type B archetype points must come from `myId`'s own DB votes, never from `game_state` fields; (3) cross-client determinism for duo awards — stable pair sort by `player.id` before any computation; and (4) tag coverage — the `migration_add_tags.sql` UPDATE statements use French text matching, which silently misses questions on text encoding mismatches.

**Primary recommendation:** Implement archetypes computation first (pure function, easy to test), then duo awards, then wire both into the share card refactor. Keep new computation outside `lib/game.ts` per the established engine/UI boundary.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Archetype score computation | Browser / Client | — | Pure function over own votes + question tags; no server cost, matches existing group-title pattern |
| Duo awards computation | Browser / Client | — | Pure function over all room votes; deterministic given stable sort |
| Tags data model | Database / Storage | — | `questions.tags jsonb` column; already migrated |
| Share card capture | Browser / Client | — | `modern-screenshot` `domToBlob` is the existing pattern; no server render |
| i18n strings | Browser / Client | — | `useT()` pattern already established; all archetype/award keys already in `lib/i18n.ts` |
| Optional `tag_scores` write (D-08) | Browser / Client → Supabase | — | Same path as existing `user_session_stats` upsert; no new endpoint |

---

## Standard Stack

### Core (all pre-existing, no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | Component model, `useState`/`useMemo`/`useEffect`/`forwardRef`/`useRef` | Already the app framework |
| Supabase JS client | existing | `votes` query + optional `user_session_stats` upsert | Already used for all data access |
| `modern-screenshot` | existing | `domToBlob` for PNG capture of share card | Already used; `html2canvas` is BANNED (see CLAUDE.md) |
| TypeScript | existing | Type safety for archetype/award computation | Already the language |
| Tailwind v4 | existing | Live-DOM chrome outside the capture container | Already the styling tool |

**No new npm packages.** [VERIFIED: codebase scan] Phase A explicitly prohibits new deps (D-07, A-CONTEXT.md).

### New Files (pure modules, no Supabase inside)
| File | Purpose |
|------|---------|
| `lib/archetypes.ts` | `computeTraitScores()`, `computeArchetype()`, `TRAIT_COLORS` constant |
| `lib/awards.ts` | `computeDuoAwards()`, pair metrics |
| `components/ArchetypeBlock.tsx` | Archetype name + top-3 trait bars; capture-safe (explicit px) |
| `components/DuoAwardsBlock.tsx` | 4 named award rows; capture-safe |

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies are pre-existing. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
EndScreen mounts (phase === 'ended')
  │
  ├── Query 1: supabase.from('votes').select().eq('room_id', roomId)
  │     → All room votes (for duo awards + self-filtering for archetypes)
  │     Stored in useState, never refetched (P-05 prevention)
  │
  ├── Query 2: supabase.from('questions').select().in('id', played_question_ids)
  │     → Played questions WITH tags (tags column now present)
  │     Stored in useState, never refetched
  │
  ├── computeTraitScores(allVotes.filter(v => v.player_id === myId), playedQuestions, gs)
  │     → traitScores: Record<string, number>    [lib/archetypes.ts]
  │
  ├── computeArchetype(traitScores)
  │     → { key: string; topTraits: TraitEntry[] }  [lib/archetypes.ts]
  │
  ├── computeDuoAwards(allVotes, players)
  │     → DuoAward[]  (0–4 items)  [lib/awards.ts]
  │
  └── ShareCard (refactored)
        activeCard: 'group' | 'personal'   (React state, default: 'group')
        │
        ├── tap → toggles activeCard
        ├── [off-screen capture div] ← domToBlob captures this on export
        │     Renders ONLY active face (no display:none — swap subtrees)
        │     Face 1: group title + DuoAwardsBlock (when ≥ 2 awards)
        │     Face 2: existing stats + ArchetypeBlock
        │
        └── Share button → exportCard() → domToBlob(captureRef.current, {width:540,height:540,scale:2})
```

### Recommended File Structure

```
lib/
├── archetypes.ts      # NEW: computeTraitScores(), computeArchetype(), TRAIT_COLORS, ARCHETYPES_TABLE
├── awards.ts          # NEW: computeDuoAwards(), pair metric helpers
├── game.ts            # unchanged — computation stays OUT of here
├── types.ts           # ADD: Question.tags field; no GameState changes needed for Phase A
└── i18n.ts            # ADD: card.flip_to_personal, card.flip_to_group (2 new keys × 4 locales)

components/
├── ArchetypeBlock.tsx # NEW: capture-safe, explicit px widths, receives traitScores + archetype
└── DuoAwardsBlock.tsx # NEW: capture-safe, receives DuoAward[]

app/room/[code]/game/page.tsx
  ShareCard (~L1187)   # REFACTOR: 2-face, activeCard state, flip affordance, separate captureRef
  EndScreen (~L1303)   # REFACTOR: add 2 queries, compute archetypes + awards, feed into ShareCard

supabase/
└── migration_add_tags.sql  # ALREADY EXISTS — verify it ran; run only if column missing
```

### Pattern 1: Pure Archetype Computation

```typescript
// Source: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md + lib/game.ts conventions

export type TraitKey = 'drole' | 'fiable' | 'audacieux' | 'empathique' | 'mysterieux' | 'romantique'

export interface TraitEntry { key: TraitKey; pct: number }

export interface ArchetypeResult {
  archetypeKey: string      // e.g. 'archetype_farceur' — key into fr.archetypes.*
  topTraits: TraitEntry[]   // top 3 with points > 0, sorted desc by pct
}

// Determines if the player was the "actor" for a given round, by question type.
// PRIVACY: Type B is determined from own votes only (own answer='oui'), NOT from
// game_state.revealed_player_ids or game_state.stats.confessed. (P-04)
function wasActor(
  gs: GameState,
  questionId: string,
  myVotes: VoteRow[],   // votes WHERE player_id = myId AND room_id = roomId
): boolean {
  const q = gs.current_question  // Not right at end-of-game — see "round by round" note below
  // … (see Pattern 4 for the correct per-round reconstruction approach)
}

export function computeTraitScores(
  myVotes: VoteRow[],           // fetched from DB: votes WHERE player_id = myId AND room_id = roomId
  playedQuestions: QuestionWithTags[],  // fetched from DB: questions WHERE id IN played_question_ids
  gs: GameState,
): Record<TraitKey, number> {
  const scores: Record<TraitKey, number> = {
    drole: 0, fiable: 0, audacieux: 0, empathique: 0, mysterieux: 0, romantique: 0,
  }
  // NOTE: game_state only has the LAST round's current_question and designation state.
  // For per-question actor determination, reconstruct from game_state.stats + votes.
  // See Pattern 4 for the correct reconstruction approach.
  for (const q of playedQuestions) {
    const tags = (q as any).tags as Array<{tag: string; points: number}> ?? []
    if (tags.length === 0) continue
    const roundVotes = myVotes.filter(v => v.question_index /* see Pattern 4 */)
    // Apply points when this player was the actor
    for (const {tag, points} of tags) {
      if (tag in scores) scores[tag as TraitKey] += points
    }
  }
  // Floor at 0
  for (const k of Object.keys(scores) as TraitKey[]) {
    scores[k] = Math.max(0, scores[k])
  }
  return scores
}

export function computeArchetype(scores: Record<TraitKey, number>): ArchetypeResult {
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  if (total === 0) return { archetypeKey: 'archetype_fallback', topTraits: [] }

  const entries = (Object.entries(scores) as [TraitKey, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  const topTraits: TraitEntry[] = entries.slice(0, 3).map(([key, val]) => ({
    key, pct: Math.round((val / total) * 100),
  }))

  const pcts = entries.map(([key, val]) => ({ key, pct: (val / total) * 100 }))

  // Simple: one trait > 50%
  if (pcts[0] && pcts[0].pct > 50) {
    return { archetypeKey: SIMPLE_ARCHETYPES[pcts[0].key], topTraits }
  }

  // Hybrid: top 2 both > 25% AND gap < 15%
  if (pcts.length >= 2 && pcts[0].pct > 25 && pcts[1].pct > 25 &&
      (pcts[0].pct - pcts[1].pct) < 15) {
    const pair: [TraitKey, TraitKey] = [pcts[0].key, pcts[1].key]
    const key = HYBRID_ARCHETYPES[pair.sort().join('+')] ?? 'archetype_fallback'
    return { archetypeKey: key, topTraits }
  }

  return { archetypeKey: 'archetype_fallback', topTraits }
}
```

[ASSUMED] — exact hybrid pair sort direction (ascending by key string) needs code verification; both orderings must map to the same hybrid archetype key.

### Pattern 2: Duo Awards Computation

```typescript
// Source: docs/superpowers/specs/2026-06-10-duo-awards-design.md

interface PairMetrics {
  mutual_designations: number   // rounds where A designated B AND B designated A
  vote_alignment: number        // rounds where A and B designated the same third player
  opposition: number            // rounds where A designated B but not vice versa (or vice versa)
  confession_overlap: number    // Type B rounds where both voted answer=true
  co_volunteers: number         // Type C rounds where both voted vote_type='volunteer'
}

interface DuoAward {
  awardKey: string   // e.g. 'award_magnetisme'
  emoji: string
  playerA: Player
  playerB: Player
  score: number
}

export function computeDuoAwards(allVotes: VoteRow[], players: Player[]): DuoAward[] {
  // DETERMINISM: Sort pairs by player.id before any computation (P-19)
  const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id))
  const pairs: [Player, Player][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push([sorted[i], sorted[j]])
    }
  }

  // Compute per-pair metrics from allVotes
  const metrics = new Map<string, PairMetrics>()
  for (const [a, b] of pairs) {
    metrics.set(`${a.id}:${b.id}`, computePairMetrics(allVotes, a.id, b.id))
  }

  // Award assignment with variety rule (prefer pair without another award)
  const awards: DuoAward[] = []
  const awardedPairKeys = new Set<string>()

  const AWARD_DEFS = [
    { key: 'award_magnetisme', emoji: '🧲', score: (m: PairMetrics) => m.mutual_designations },
    { key: 'award_longueur_onde', emoji: '🧠', score: (m: PairMetrics) => m.vote_alignment },
    { key: 'award_ennemis', emoji: '⚔️', score: (m: PairMetrics) => m.opposition },
    { key: 'award_complices', emoji: '🔥', score: (m: PairMetrics) => m.confession_overlap + m.co_volunteers },
  ]

  for (const def of AWARD_DEFS) {
    const candidates = [...pairs]
      .map(([a, b]) => {
        const key = `${a.id}:${b.id}`
        return { a, b, key, score: def.score(metrics.get(key)!) }
      })
      .filter(c => c.score >= 2)    // minimum threshold
      .sort((x, y) => {
        if (y.score !== x.score) return y.score - x.score
        // Variety: prefer pair not yet awarded
        const xAwarded = awardedPairKeys.has(x.key) ? 1 : 0
        const yAwarded = awardedPairKeys.has(y.key) ? 1 : 0
        return xAwarded - yAwarded
      })
    if (candidates[0]) {
      awards.push({ awardKey: def.key, emoji: def.emoji, playerA: candidates[0].a, playerB: candidates[0].b, score: candidates[0].score })
      awardedPairKeys.add(candidates[0].key)
    }
  }

  return awards
}
```

### Pattern 3: 2-Face Card with modern-screenshot Capture

The existing capture pattern in `EndScreen.exportCard()` [VERIFIED: codebase scan — ~L1364] uses two separate `<div>` nodes:
1. An **off-screen capture div** at `position: 'fixed', top: 0, left: -10000` — this is what `domToBlob` measures.
2. A **scaled-down visual preview** using `transform: scale(0.58)` for display.

The critical discipline: `domToBlob(captureRef.current, { width: 540, height: 540, scale: 2 })` reads the off-screen div's real layout, not the scaled preview. For the 2-face card:

```typescript
// activeCard state lives in EndScreen, passed down to ShareCard
const [activeCard, setActiveCard] = useState<'group' | 'personal'>('group')

// Off-screen capture div renders ONLY the active face (no hidden element)
// P-07: Do NOT render both faces with display:none — swap subtrees entirely
<div style={{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none' }} aria-hidden>
  <ShareCard
    ref={captureRef}
    {...sharedProps}
    activeCard={activeCard}
    // ArchetypeBlock and DuoAwardsBlock are passed as pre-computed data
    archetype={archetypeResult}
    duoAwards={duoAwardsResult}
  />
</div>

// Visual preview (display only) — use same ShareCard, NOT captureRef
<div style={{ width: 313, height: 313, overflow: 'hidden', borderRadius: 16 }}
     onClick={() => setActiveCard(c => c === 'group' ? 'personal' : 'group')}>
  <div style={{ transform: 'scale(0.58)', transformOrigin: 'top left', width: 540, height: 540 }}>
    <ShareCard {...sharedProps} activeCard={activeCard} archetype={archetypeResult} duoAwards={duoAwardsResult} />
  </div>
</div>
```

### Pattern 4: Actor Determination — The Key Complexity

`game_state` stores only the **last round's** designation state. At `phase === 'ended'`, `gs.designated_player_ids`, `gs.volunteer_player_ids`, etc. contain data from the final round only. For archetype computation across all 7 rounds, we cannot use `gs` fields directly.

**Correct approach** [VERIFIED: codebase scan — accumulateStats pattern]:
- `gs.stats.designated` is a map of `player_id → number of times designated` (accumulated across all rounds).
- `gs.stats.volunteered` is a map of `player_id → number of times volunteered`.
- `gs.stats.confessed` is a map of `player_id → number of times confessed via roulette` (roulette winner only, not all "oui" voters).

For archetypes, actor determination needs round-level granularity. The votes table IS the source of truth. The vote rows include `round` number. The algorithm must cross-reference:
- **Type A actor**: player was in `designated_player_ids` for that round → check `votes WHERE player_id = myId AND vote_type = 'designation'` but note that casting a designation vote does NOT make you the actor; being designated does. For being designated: the `stats.designated[myId]` count from `gs.stats` gives total designations received, but not per-question breakdown.

**Pragmatic solution** (avoiding complex round-by-round reconstruction):

All room votes are already fetched for duo awards. From that dataset, actor status can be determined per-round using the `game_state.stats` accumulated maps alongside the per-question vote data:

- **Type A**: `gs.stats.designated[myId] > 0` indicates I was designated at least once. For per-question granularity, cross-reference `votes WHERE vote_type='designation' AND target_player_id = myId` grouped by round with `played_question_ids` order.
- **Type B**: Self-query `votes WHERE player_id = myId AND vote_type = 'confession' AND answer = true` — player voted 'oui' for themselves. This is the ONLY correct source for B points (P-04 privacy rule).
- **Type C volunteer**: `votes WHERE player_id = myId AND vote_type = 'volunteer'` grouped by round.
- **Type C roulette**: `votes WHERE vote_type = 'designation' AND target_player_id = myId` for rounds where `round_c_roulette` was the outcome — but this is indistinguishable from Type A designations in the vote data alone.

**Recommended simplified approach for Phase A** [ASSUMED — confirm with planner]:
Use `gs.stats.*` maps for a single-value "total" attribution instead of per-round/per-question attribution. The trait score for a player becomes: sum of points across all played questions where the player's stats suggest they were an actor, weighted by how many times they were an actor in total. This is less granular but avoids complex reconstruction and produces stable results.

Alternatively — the **votes table has `round` numbers**. `played_question_ids` is ordered (appended in round order in `accumulateStats`). Map round number → question id by index, then determine actor status per-round from vote rows. This is the precise approach, matching the spec exactly.

### Pattern 5: Trait Bar Width — Capture-Safe

```typescript
// Source: A-UI-SPEC.md (P-07 prevention)
// NEVER use percentage widths inside the capture container
const MAX_BAR_PX = 160
const barWidthPx = Math.round((pct / 100) * MAX_BAR_PX)

// In JSX:
<div style={{
  height: 8,
  width: barWidthPx,  // explicit pixels — not `${pct}%`
  background: TRAIT_COLORS[trait.key],
  borderRadius: 4,
}} />
```

### Anti-Patterns to Avoid

- **Using `gs.revealed_player_ids` or `gs.stats.confessed` for Type B archetype points** — this exposes who voted 'oui' to all clients. Breach of anonymity contract (P-04).
- **Rendering both card faces with `display: none`** — `modern-screenshot` may include hidden element layouts; off-screen capture becomes unreliable (P-07).
- **`%`-based widths for trait bars in the capture container** — computed as 0 in the off-screen context (P-07).
- **Using `Math.random()` in pair tie-breaking** — cross-client divergence; Face 1 (group card) shows different award winners on different players' screens (P-19).
- **Putting archetype/award computation inside `lib/game.ts`** — violates engine/UI boundary established by `computeGroupTitle`, `momentStat` etc.; pure engine vs. end-screen display functions.
- **Using `Array.sort` with a random comparator for shuffles** — V8 TimSort bias; use Fisher-Yates if any shuffle is needed (already in `lib/game.ts` as reference).
- **Re-running seed files on the prod DB** — no unique key on question text → duplicates (CLAUDE.md gotcha, P-10).

---

## Tags Data Model

### Column Shape [VERIFIED: codebase scan — migration_add_tags.sql + schema.sql]

```sql
-- Already applied to prod via migration_add_tags.sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Tag format: `[{"tag": "drole", "points": 2}, {"tag": "fiable", "points": -1}]`
- Tag keys match the 6 trait keys exactly: `drole`, `fiable`, `audacieux`, `empathique`, `mysterieux`, `romantique`
- Points: 1 = mild, 2 = moderate, 3 = strong; negatives allowed
- 1–3 tags per question (0 = untagged, contributes 0 points — valid after migration)

### TypeScript Type Addition Required

```typescript
// lib/types.ts — add to Question type
export type Question = {
  id: string
  theme: string
  type: 'A' | 'B' | 'C'
  intensity: number
  question: { fr: string; en: string; es: string; de: string }
  tags?: Array<{ tag: string; points: number }>  // optional for backward compat with old pickCandidates results
}
```

The `tags` field should be `optional` because `pickCandidates` in `lib/game.ts` fetches questions via `supabase.from('questions').select()` — without `select('*, tags')` this is fine since `select()` (no args) already returns all columns including the new `tags` column. Confirm the Supabase JS client behavior: `select()` with no args returns all columns. [ASSUMED — verify that the existing `select()` call in `pickCandidates` returns the `tags` field post-migration.]

### Schema.sql Idempotency [VERIFIED: codebase scan — schema.sql pattern]

`schema.sql` already uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for additive changes. The tags migration follows the same convention. Schema.sql does NOT need to include the full UPDATE tag-curation statements — those belong in `migration_add_tags.sql` (run-once). Schema.sql only needs the `ADD COLUMN IF NOT EXISTS` DDL for the column.

### Seed Duplication Gotcha [VERIFIED: CLAUDE.md + P-10 + migration_add_tags.sql]

`migration_add_tags.sql` uses `UPDATE questions SET tags = '...' WHERE question->>'fr' = '...'` — text-matching approach. Risks:
1. **Text encoding mismatch**: smart apostrophes (`'` vs `'`) silently produce 0-row UPDATE. Validate after migration: `SELECT COUNT(*) FROM questions WHERE tags = '[]'::jsonb` — if > ~10% of rows, the migration partially failed.
2. **Duplicate seed rows**: `seed.sql` etc. have no unique constraint on question text. If re-run, multiple rows per question exist with different UUIDs; UPDATE tags all matching rows. This is actually safe for tags curation (updates all copies). The risk is `played_question_ids` storing one UUID while `contextual_questions` references another — not a Phase A concern.

For Phase A: **do not re-run seed files**. Verify `migration_add_tags.sql` ran successfully using the validation query.

---

## Archetype Computation Details

### The 21 Named Archetypes [VERIFIED: codebase scan — i18n.ts, social-profile-archetypes-design.md]

All 22 keys (21 named + fallback) are already present in `lib/i18n.ts` for fr/en/es/de.

**Simple archetypes (one trait > 50%):**
```typescript
// lib/archetypes.ts
export const SIMPLE_ARCHETYPES: Record<string, string> = {
  drole:       'archetype_farceur',
  fiable:      'archetype_confident',
  audacieux:   'archetype_leader',
  empathique:  'archetype_diplomate',
  mysterieux:  'archetype_mysterieux',
  romantique:  'archetype_romantique',
}
```

**Hybrid archetypes (15 pairs, both traits > 25%, gap < 15%):**
```typescript
// Keys are sorted pair strings: "drole+fiable" (alphabetical sort of the two trait keys)
export const HYBRID_ARCHETYPES: Record<string, string> = {
  'audacieux+drole':       'archetype_agitateur',
  'drole+empathique':      'archetype_ame_fete',
  'drole+mysterieux':      'archetype_joker',
  'drole+fiable':          'archetype_clown_fidele',
  'drole+romantique':      'archetype_seducteur_maladroit',
  'empathique+fiable':     'archetype_pilier',
  'audacieux+fiable':      'archetype_capitaine',
  'fiable+romantique':     'archetype_amoureux_loyal',
  'audacieux+mysterieux':  'archetype_loup_solitaire',
  'audacieux+romantique':  'archetype_seducteur',
  'audacieux+empathique':  'archetype_protecteur',
  'empathique+romantique': 'archetype_reveur',
  'empathique+mysterieux': 'archetype_ombre_bienveillante',
  'mysterieux+romantique': 'archetype_inaccessible',
  'fiable+mysterieux':     'archetype_gardien',
}
```

**Fallback**: `archetype_fallback` — "Une simple personne" — when total = 0 OR neither simple nor hybrid threshold met.

**Hybrid threshold algorithm** [VERIFIED: design spec]:
1. Sort trait entries by descending score
2. Check simple: `top[0].pct > 50`
3. Check hybrid: `top[0].pct > 25 AND top[1].pct > 25 AND (top[0].pct - top[1].pct) < 15`
4. Build pair key: `[top[0].key, top[1].key].sort().join('+')`
5. Look up in `HYBRID_ARCHETYPES`; if not found → fallback

### Actor Determination Per Question Type

| Question Type | Player is Actor if… | Vote Table Source |
|---------------|---------------------|-------------------|
| A | `target_player_id = myId` in designation votes for that round | `votes WHERE vote_type='designation' AND target_player_id=myId` |
| B | `player_id = myId AND vote_type='confession' AND answer=true` | `votes WHERE player_id=myId AND vote_type='confession'` |
| C volunteer | `player_id = myId AND vote_type='volunteer'` | `votes WHERE player_id=myId AND vote_type='volunteer'` |
| C roulette | `target_player_id = myId` in designation votes for a C round | Need to distinguish from Type A — use played question type |

The **round-to-question mapping**: `played_question_ids[roundIndex]` gives the question ID for round `roundIndex+1`. Round numbers in the `votes` table are 1-based. Played questions are also accumulated in round order (verified in `accumulateStats` — `played_question_ids.push(q.id)` happens sequentially).

Cross-reference: for round `r`, the question is `playedQuestions.find(q => q.id === gs.played_question_ids[r-1])`. The question's `.type` tells us whether a designation vote for `target_player_id=myId` in round `r` means a Type A designation or a Type C roulette outcome.

**PRIVACY NOTE on Type B**: Use `votes WHERE player_id = myId AND vote_type = 'confession' AND answer = true`. Never use `gs.stats.confessed[myId]` (this only counts roulette-revealed confessions, not all "oui" self-votes) and never use `gs.revealed_player_ids` (public field, breaks anonymity for OTHER players). [VERIFIED: PITFALLS.md P-04]

---

## Duo Awards Computation Details

### 5 Pair Metrics [VERIFIED: design spec]

From `allVotes` (all room votes, single query):

| Metric | Computation |
|--------|-------------|
| `mutual_designations` | Rounds where A voted for B (designation vote where `player_id=A.id AND target_player_id=B.id`) AND B voted for A (same round, `player_id=B.id AND target_player_id=A.id`) |
| `vote_alignment` | Rounds where A and B both cast designation votes targeting the same third player C (same round, same `target_player_id`, neither is A or B) |
| `opposition` | Rounds where A → B or B → A but NOT both (asymmetric designation) |
| `confession_overlap` | Type B rounds where A answered `oui` AND B answered `oui` (both `answer=true`, same round, `vote_type='confession'`) |
| `co_volunteers` | Type C rounds where A volunteered AND B volunteered (both `vote_type='volunteer'`, same round) |

**PRIVACY NOTE on `confession_overlap`**: Open RLS means every client can fetch all vote rows including `answer` fields. The intermediate computation reveals who voted "oui" on what. Scope: only use within the computation function; do not expose raw vote rows to React props or rendered output. Document as known MVP privacy gap (P-12).

### Award Assignment Algorithm [VERIFIED: design spec + P-19]

```
1. Sort players by player.id (stable, lexicographic) — P-19
2. Build all unique pairs from sorted players
3. Compute 5 metrics per pair
4. For each of the 4 award defs (in canonical order: magnetisme, longueur_onde, ennemis, complices):
   a. Filter pairs with score ≥ 2
   b. Sort by: score desc, then prefer pair NOT already holding an award (variety rule)
   c. If top candidate exists: assign award, mark pair key as "awarded"
5. Return awards array (0–4 items)
6. In EndScreen: if awards.length < 2 → don't render DuoAwardsBlock (D-03)
```

---

## Share Card Refactor Details

### Current Structure [VERIFIED: codebase scan — game/page.tsx ~L1187]

Existing `ShareCard` is a `forwardRef` component that:
- Renders a 540×540 `<div>` with explicit inline styles
- Has a separate off-screen capture instance (at `left: -10000`) and a scaled visual preview (`scale(0.58)`)
- Uses `domToBlob(cardRef.current, { width: 540, height: 540, scale: 2, backgroundColor: C.bg })`
- The capture fires on click of `fr.card.download` (currently "Télécharger l'image")

### Changes Required

1. **`activeCard` state** in `EndScreen`: `const [activeCard, setActiveCard] = useState<'group' | 'personal'>('group')`
2. **Separate `captureRef`** from the visual card — the existing pattern already does this. Keep `captureRef` pointing to the off-screen div; the visible card uses no ref.
3. **`ShareCard` receives** `activeCard`, `archetype: ArchetypeResult | null`, `duoAwards: DuoAward[]`
4. **Inside the 540×540 capture container**, conditionally render either `<Face1 ... />` or `<Face2 ... />` — never both.
5. **Flip affordance** is rendered OUTSIDE the capture container (in the modal chrome only).
6. **`exportCard()`** reads `captureRef.current` (existing pattern), but now `domToBlob` captures whichever face is currently active — no change to the capture call itself.

### The 2-Face Layout

**Face 1 (group, default)**:
- 6px top color bar (existing)
- Theme name + Kluup logo (existing)
- "Ce soir vous étiez…" label + group title 42px (existing)
- **NEW**: DuoAwardsBlock (if ≥ 2 awards qualify)
- Spacer + player pills + footer (existing)

**Face 2 (personal)**:
- 6px top color bar (existing)
- Theme name + Kluup logo (existing)
- **EXISTING**: Moment fort block (unchanged)
- **EXISTING**: Personal stats pills (unchanged)
- **NEW**: ArchetypeBlock (if total points > 0)
- Spacer + player pills + footer (existing)

### `ArchetypeBlock` Component Spec [VERIFIED: A-UI-SPEC.md]

```
Container: background: C.surface (#1A1A1A), borderRadius: 18, padding: '16px 16px',
           borderLeft: '4px solid ${meta.color}'
Section label: 13px, muted, uppercase, letterSpacing: '0.06em', marginBottom: 8px
Archetype name: 28px, Bricolage Grotesque 800, C.text, textTransform: 'uppercase', marginTop: 8px
Divider: 1px C.border, marginBottom: 8px
Trait rows (top 3 only, pct > 0):
  - Trait label: 13px, TRAIT_COLORS[key], width: 88px, flexShrink: 0
  - Bar track: height: 8px, flex: 1, background: C.border, borderRadius: 4
  - Bar fill: height: 8px, background: TRAIT_COLORS[key], width: barWidthPx (EXPLICIT PX), borderRadius: 4
  - Pct: 13px, C.muted, width: 36px, textAlign: 'right'
```

TRAIT_COLORS [VERIFIED: A-UI-SPEC.md]:
```typescript
export const TRAIT_COLORS: Record<string, string> = {
  drole:       '#F59E0B',  // amber
  fiable:      '#3B82F6',  // blue
  audacieux:   '#EF4444',  // red
  empathique:  '#22C55E',  // green
  mysterieux:  '#A855F7',  // violet
  romantique:  '#EC4899',  // pink
}
```

### `DuoAwardsBlock` Component Spec [VERIFIED: A-UI-SPEC.md]

```
Container: same as ArchetypeBlock style (background: C.surface, borderRadius: 18, padding: '16px 16px',
           borderLeft: '4px solid ${meta.color}')
Section label: 13px muted uppercase letterSpacing 0.06em, marginBottom: 8px
Award rows (gap: 8px between rows):
  - Emoji cell: width: 32px, flexShrink: 0, fontSize: 18px
  - Right column:
      Award name: 16px, C.text, fontWeight: 400
      Player names: 13px, C.muted — format: "{Pseudo1} & {Pseudo2}" (after ·)
```

---

## i18n Surface

### Keys Already Existing [VERIFIED: codebase scan — lib/i18n.ts]

All archetype, trait, and award keys confirmed present in fr/en/es/de:
- `archetypes.trait_*` (6 keys) — ✓ present in all 4 locales
- `archetypes.archetype_*` (22 keys including fallback) — ✓ present in all 4 locales
- `archetypes.card_title` — ✓ present
- `duo_awards.title`, `duo_awards.award_*` (4 keys) — ✓ present in all 4 locales

### New Keys Required [VERIFIED: A-UI-SPEC.md]

Only 2 new keys needed (flip affordance):

```typescript
// Add to card: {} section in Dict type (lib/i18n.ts)
card: {
  // ... existing keys (moment, generating, download, close, footer, tonight, stat: {...}) ...
  flip_to_personal: string  // "↻ voir ton archétype" (FR)
  flip_to_group:    string  // "↻ voir le groupe" (FR)
}
```

All 4 locales:
```
FR: flip_to_personal: "↻ voir ton archétype" / flip_to_group: "↻ voir le groupe"
EN: flip_to_personal: "↻ see your archetype" / flip_to_group: "↻ see the group"
ES: flip_to_personal: "↻ ver tu arquetipo" / flip_to_group: "↻ ver el grupo"
DE: flip_to_personal: "↻ Archetyp ansehen" / flip_to_group: "↻ Gruppe ansehen"
```

**Dict type**: Adding these to the `card` section extends the `Dict` type. TypeScript will enforce exhaustiveness across all 4 locale objects — ES and DE must also include these keys or the build fails.

### Theme Name Localization for Card Header [VERIFIED: codebase scan]

The existing `ShareCard` uses `THEME_META[theme].name` for the card header — a hardcoded English name. CLAUDE.md notes theme names are localized in `fr.lobby.themes`. For Phase A this is out of scope (existing behavior unchanged). The planner may note this as a cleanup opportunity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG export from DOM | canvas-drawing code | `modern-screenshot` `domToBlob` | Already installed; `html2canvas` is banned (CLAUDE.md) |
| Fisher-Yates shuffle | `Array.sort(random)` | Copy the pattern from `lib/game.ts` (lines 10–17) | V8 TimSort bias documented in codebase comment |
| Pair sort stability | JS sort with no key | `.sort((a,b) => a.id.localeCompare(b.id))` | Lexicographic on UUID strings is stable and deterministic |
| Font loading for capture | manual font wait | `await document.fonts.ready` (existing pattern ~L1372) | Already in `exportCard()` — do not remove |

---

## Common Pitfalls

### Pitfall 1: Type B Anonymity Leak (P-04)
**What goes wrong:** Reading `gs.stats.confessed[myId]` or `gs.revealed_player_ids` for Type B archetype points exposes who voted "oui" to all clients.
**Why it happens:** `game_state` fields are public and temptingly in-scope when `EndScreen` renders.
**How to avoid:** For Type B, fetch `votes WHERE player_id = myId AND vote_type = 'confession' AND answer = true`. Add the privacy comment in code.
**Warning signs:** Code review flag — any read of `gs.stats.confessed` or `gs.revealed_player_ids` inside archetype computation is a bug.

### Pitfall 2: Explicit Pixel Widths for Trait Bars (P-07)
**What goes wrong:** `width: '${pct}%'` in the off-screen capture container computes as 0 if the container has no intrinsic width at capture time.
**Why it happens:** Off-screen `<div>` at `left: -10000` is not in the visible layout flow.
**How to avoid:** `width: Math.round(pct / 100 * 160)` as an integer px value, applied as `style={{ width: barWidthPx }}`.
**Warning signs:** Trait bars appear as empty tracks in exported PNG.

### Pitfall 3: Duo Awards Cross-Client Divergence (P-19)
**What goes wrong:** Without a stable pair sort, two clients may assign the same award to different pairs — Face 1 is different for different players.
**Why it happens:** Object iteration order is not guaranteed; tie-breaking without stable sort is non-deterministic.
**How to avoid:** `const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id))` before building pairs.
**Warning signs:** Players comparing their Face 1 cards see different award winners.

### Pitfall 4: Tag Migration Text Mismatch (P-18)
**What goes wrong:** `migration_add_tags.sql` uses `WHERE question->>'fr' = '...'` text matching. Any encoding difference (smart apostrophe, trailing space) silently updates 0 rows. Questions keep `tags = []`.
**Why it happens:** No unique constraint on question text; text matching is fragile.
**How to avoid:** After running migration, execute `SELECT COUNT(*) FROM questions WHERE tags = '[]'::jsonb`. If > ~10%, investigate encoding.
**Warning signs:** All players get "Une simple personne" archetype regardless of gameplay.

### Pitfall 5: Both Card Faces Rendered Simultaneously (P-07)
**What goes wrong:** Rendering Face 1 + Face 2 simultaneously (one with `display: none`) causes `modern-screenshot` layout artifacts.
**Why it happens:** `domToBlob` captures the full DOM subtree including hidden elements.
**How to avoid:** Swap the full child subtree based on `activeCard` — conditional rendering, not `display: none`.
**Warning signs:** Card PNG contains overlapping content or corrupted layout.

### Pitfall 6: `ignoreDuplicates: true` Makes Partial `tag_scores` Permanent (P-13, D-08 only)
**What goes wrong:** If the stats upsert writes `tag_scores: {}` before archetype computation completes, the duplicate-ignoring behavior means the real scores are never written.
**Why it happens:** The existing upsert uses `{ onConflict: 'user_id,session_id', ignoreDuplicates: true }`.
**How to avoid:** If D-08 is folded in, compute `tag_scores` completely (await async Type B vote fetch) before the upsert. Do not split compute and write.
**Warning signs:** `user_session_stats.tag_scores` always shows `{}`.

### Pitfall 7: End-Screen Votes Fetch Re-Fires on Every Re-render (P-05)
**What goes wrong:** `EndScreen` re-renders when presence updates change the players roster. Without memoization, the votes fetch fires repeatedly.
**Why it happens:** No `useEffect` dependency guard.
**How to avoid:** `useEffect(..., [roomId])` for the fetch; `useMemo` for award and archetype computation.
**Warning signs:** Network tab shows multiple `votes` queries during the end screen.

### Pitfall 8: `played_question_ids` Order vs. Round Number Mapping
**What goes wrong:** Assuming `played_question_ids[i]` maps to round `i` is correct for standard runs but may be off-by-one in edge cases (replay clears votes but appends IDs starting at round 1 again).
**Why it happens:** `accumulateStats` pushes question IDs in order, and replay resets `round` to 1.
**How to avoid:** Cross-reference by both round number (from `votes.round`) and question ID. Confirm `played_question_ids` accumulation is reset in `makeInitialGameState` (it is — initialized to `[]`).

---

## Runtime State Inventory

This phase adds no OS-registered state, no new environment variables, no new services, and no new build artifacts. This section is not applicable to Phase A (greenfield computation features on top of existing tables).

**Tags column:** Already migrated to the Supabase prod DB via `migration_add_tags.sql`. Not a runtime state item — it is a DB schema change that is already complete. Verify with `SELECT COUNT(*) FROM questions WHERE tags != '[]'::jsonb` on prod.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (no jest.config.*, no vitest.config.*, no test scripts in package.json detected) [ASSUMED — verify before planning] |
| Config file | None found |
| Quick run command | N/A until framework added |
| Full suite command | N/A |

**Wave 0 gap:** No test infrastructure exists. The natural fit for Phase A is unit testing the pure computation functions (`lib/archetypes.ts`, `lib/awards.ts`). The planner should add a Wave 0 task to install a test runner (Jest or Vitest) if one is not present.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| REQ-AR-03 | `computeTraitScores()` returns correct trait scores per question type | Unit | Pure function — fully testable without Supabase |
| REQ-AR-04 | `computeArchetype()` correctly applies simple/hybrid/fallback thresholds | Unit | Pure function — all 22 archetypes testable with fixture scores |
| REQ-DA-01 | `computeDuoAwards()` computes correct 5 metrics per pair | Unit | Pure function with fixture vote arrays |
| REQ-DA-02 | Variety rule correctly avoids awarding same pair twice; threshold ≥ 2 enforced | Unit | Edge case fixture: pairs tied in score |
| REQ-DA-03 | `DuoAwardsBlock` not rendered when awards.length < 2 | Component | Render test or manual verification |
| REQ-DA-04 | Share card captures active face only; flip toggle works | Integration / Manual | `domToBlob` on real device; check PNG output |
| REQ-AR-05 | Trait bars use explicit pixel widths | Code review | Grep for `%` inside capture container |
| REQ-AR-06 / REQ-DA-05 | All i18n keys present in all 4 locales | TypeScript build | `Dict` type enforcement — compile-time |
| P-04 | Type B points never use `gs.revealed_player_ids` | Code review | Grep for `revealed_player_ids` in `archetypes.ts` |
| P-19 | Pair sort is stable and uses `player.id` | Unit | Test with fixed player array in different orders |

### Key Unit Test Fixtures

```typescript
// computeArchetype test cases (pure — no Supabase)
test('simple archetype: drole dominant', () => {
  const scores = { drole: 10, fiable: 3, audacieux: 2, empathique: 1, mysterieux: 1, romantique: 0 }
  // total=17, drole=58.8% > 50% → simple
  expect(computeArchetype(scores).archetypeKey).toBe('archetype_farceur')
})

test('hybrid archetype: drole+empathique', () => {
  const scores = { drole: 5, empathique: 4, fiable: 0, audacieux: 0, mysterieux: 0, romantique: 0 }
  // total=9, drole=55.6% > 50% → actually simple! (adjust fixture)
  // For hybrid: drole=5, empathique=4, fiable=1 → total=10, drole=50%, empathique=40% → neither >50%, both >25%, gap=10% < 15%
  const h = { drole: 5, empathique: 4, fiable: 1, audacieux: 0, mysterieux: 0, romantique: 0 }
  expect(computeArchetype(h).archetypeKey).toBe('archetype_ame_fete')
})

test('fallback: total = 0', () => {
  const scores = { drole: 0, fiable: 0, audacieux: 0, empathique: 0, mysterieux: 0, romantique: 0 }
  expect(computeArchetype(scores).archetypeKey).toBe('archetype_fallback')
})

test('duo awards variety rule', () => {
  // Player A, B, C: A-B have high mutual_designations AND high vote_alignment
  // Award 1 goes to A-B for magnetisme; award 2 should prefer A-C or B-C over A-B for longueur_onde
})
```

### Sampling Rate
- **Per commit:** TypeScript build (`next build`) — enforces `Dict` exhaustiveness and type safety
- **Per wave merge:** Manual end-to-end test: play a 3-round game, reach end screen, verify archetype and duo awards appear, export Face 1 and Face 2 PNG
- **Phase gate:** All REQ-AR-* and REQ-DA-* behaviors verified before `/gsd-verify-work`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change in Phase A |
| V3 Session Management | no | No session change |
| V4 Access Control | partial | Open RLS is a known MVP gap; `confession_overlap` metric reads all confession votes (P-12) |
| V5 Input Validation | no | No new user input |
| V6 Cryptography | no | No cryptography |

### Anonymity Boundary (Phase-A-specific)

The project's anonymity contract (Type B confession anonymity) extends to archetype computation. The boundary is enforced by code, not by RLS (open RLS is the current MVP posture). The privacy boundary is:
- **Type B archetype points**: computed from `votes WHERE player_id = myId` only — never from public `game_state` fields.
- **`confession_overlap` (duo awards)**: fetches all confession votes (including `answer` fields) as an unavoidable side effect. Raw vote data stays scoped to the computation function; no exposure via React props.

Document in code comments. Flag in Phase A implementation notes that `confession_overlap` is a known MVP privacy gap and should move to a server-side RPC before premium launch (P-12).

---

## Environment Availability

This phase adds no new external dependencies. The existing environment supports everything required:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (dmxjspnrrgcixzcthgwf) | Votes query, questions query | ✓ | Prod | — |
| `modern-screenshot` | Share card PNG export | ✓ | Installed | — |
| Next.js 16 + React 19 | All components | ✓ | Installed | — |
| TypeScript | Type safety | ✓ | Installed | — |
| Tailwind v4 | Live DOM chrome | ✓ | Installed | — |

**No missing dependencies.** Environment is fully ready for Phase A.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-face share card | 2-face card (group + personal) | Phase A | Enables group reveal + personal archetype |
| Group title only on end screen | Group title + duo awards (Face 1) | Phase A | Social graph visibility |
| No archetype | 22 named archetypes from gameplay behavior | Phase A | Personal identity layer |
| `html2canvas` for card export | `modern-screenshot` `domToBlob` | Already implemented pre-Phase A | Font fidelity; html2canvas is banned |

**Already deprecated by prior sessions:**
- `html2canvas` — explicitly banned in CLAUDE.md (font deformation). Do not reference.
- B1/B2 confession sub-modes — removed in playtest #3. `b_subtype` stays `'B2'` for stats continuity but B1 is never triggered.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.from('questions').select()` (no column list) returns `tags` field after migration | Tags Data Model | If Supabase JS client requires explicit column to return new columns, `pickCandidates` candidates won't have tags; archetype computation returns all zeros |
| A2 | No Jest/Vitest test runner is currently configured | Validation Architecture | If a test runner does exist, Wave 0 test infrastructure task is unnecessary |
| A3 | `played_question_ids` entries are in round-ascending order (index 0 = round 1) | Archetype Computation / Pattern 4 | If order is not guaranteed, round-to-question mapping breaks; actor determination is wrong |
| A4 | Hybrid archetype pair key sort is alphabetical on trait key strings | Archetype Computation | If the intended sort differs, some hybrid archetypes are unreachable; test with fixture cases |
| A5 | The planner will choose "precise per-round approach" for actor determination | Pattern 4 | If simplified "total counts" approach is chosen instead, players active across many rounds get different scores than spec intends |

---

## Open Questions (RESOLVED)

> All three resolved during planning: (1) D-08 deferred wholesale in A-05; (2) precise per-round actor mapping chosen, encoded in A-02; (3) explicit votes column list adopted in A-05.

1. **D-08 fold-in decision (tag_scores background write)** — RESOLVED: deferred wholesale (A-05).
   - What we know: The existing upsert in `EndScreen` uses `ignoreDuplicates: true`; `tag_scores` is already declared in `schema.sql`; `PendingStatsFlusher` exists for OAuth redirect path.
   - What's unclear: Whether the planner has appetite for the added complexity (2 extra fetches in `PendingStatsFlusher`, stash format update).
   - Recommendation: Planner decides based on complexity assessment. If folded in, enforce: compute `tag_scores` before ANY upsert call; update `PendingStatsFlusher` stash to include `room_id` + `player_id` + pre-computed `tag_scores`.

2. **Actor determination granularity (Pattern 4)**
   - What we know: `game_state.stats.designated[myId]` gives total designation count across all rounds; `votes` table has `round` numbers.
   - What's unclear: Whether the precise per-question attribution (round-to-question mapping) is required, or whether total-count attribution is acceptable.
   - Recommendation: Use precise per-round mapping — it matches the spec exactly and the data is available in the fetched vote rows. The mapping is: `played_question_ids[round - 1]` → question ID; question type determines actor rule.

3. **`select()` vs `select('*')` or explicit columns for votes fetch**
   - What we know: Supabase JS client `select()` with no args typically returns all columns.
   - What's unclear: Whether the Supabase JS client version in use has any quirk around column selection.
   - Recommendation: Use `select('id, round, player_id, vote_type, target_player_id, answer')` for the votes fetch to be explicit and future-proof.

---

## Sources

### Primary (HIGH confidence — codebase verification)
- `app/room/[code]/game/page.tsx` — `ShareCard` (~L1187), `EndScreen` (~L1303), `exportCard` (~L1364), design tokens `C` object (~L28)
- `lib/game.ts` — `accumulateStats`, `fetchVotes`, `pickCandidates`, `tallyDesignation` patterns
- `lib/types.ts` — `GameState`, `Question`, `Player`, `GamePhase` types
- `lib/i18n.ts` — `archetypes.*`, `duo_awards.*`, `card.*` key presence confirmed in all 4 locales
- `supabase/schema.sql` — `questions` table structure, `user_session_stats.tag_scores` declaration
- `supabase/migration_add_tags.sql` — tags column + full curation UPDATE statements

### Primary (HIGH confidence — spec documents)
- `docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md` — archetype algorithm, thresholds, 21 archetypes table
- `docs/superpowers/specs/2026-06-10-duo-awards-design.md` — 5 pair metrics, 4 awards, variety rule, edge cases
- `.planning/phases/A-social-profile-archetypes-duo-awards/A-CONTEXT.md` — locked decisions D-01 through D-08
- `.planning/phases/A-social-profile-archetypes-duo-awards/A-UI-SPEC.md` — exact hex values, spacing, typography, component specs
- `.planning/research/PITFALLS.md` — P-04, P-05, P-07, P-12, P-13, P-18, P-19 (all directly applicable to Phase A)
- `.planning/research/ARCHITECTURE.md` — build order, module boundaries, EndScreen as computation hub
- `.planning/intel/requirements.md` — REQ-AR-01 through REQ-AR-06, REQ-DA-01 through REQ-DA-05

### Secondary (MEDIUM confidence — design discussions)
- `.planning/phases/A-social-profile-archetypes-duo-awards/A-DISCUSSION-LOG.md` — rationale for D-01 through D-08

---

## Project Constraints (from CLAUDE.md)

All applicable directives for Phase A:

| Directive | Implication for Phase A |
|-----------|------------------------|
| Zero hardcoded text — everything via i18n system | All archetype names, trait names, award names, flip affordance text must use `useT()` / `fr.*` keys |
| Mobile-first, centered max-width columns | Share card modal already mobile-optimized; new live-DOM chrome follows same Tailwind patterns |
| `modern-screenshot` for card export — NOT `html2canvas` | `domToBlob` is the capture API; html2canvas is banned regardless of argument |
| Real-size off-screen capture, scaled visual preview | Two-div pattern must be preserved; `getBoundingClientRect()` check note for sizing |
| Explicit pixel widths in capture context | Trait bars: `Math.round(pct/100*160)px` — no `%` |
| Supabase Realtime for sync | No new Realtime channels needed for Phase A (all computation is at `ended` phase, no live sync) |
| No new npm deps | Confirmed — Phase A uses only pre-existing libraries |
| `host_id NOT NULL` on room insert | Not relevant to Phase A (no room creation) |
| Replay must purge votes | Not relevant to Phase A (votes are read-only for computation) |
| Do not revisit B1/`pickBSubtype` | `accumulateStats` reads `gs.b_subtype === 'B2'` — archetype computation for Type B must NOT use `b_subtype` to filter |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all pre-existing
- Architecture: HIGH — grounded in existing codebase patterns (game.ts, EndScreen, ShareCard)
- Archetype algorithm: HIGH — verified against spec + existing i18n keys
- Duo awards algorithm: HIGH — verified against spec + pitfalls research
- Pitfalls: HIGH — sourced from existing PITFALLS.md plus codebase verification
- Actor determination (Pattern 4): MEDIUM — round-to-question mapping relies on `played_question_ids` ordering assumption (A3)

**Research date:** 2026-06-14
**Valid until:** 2026-09-14 (stable — all deps are pre-existing; only risk is Supabase JS client API changes)
