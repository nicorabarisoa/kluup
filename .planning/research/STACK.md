# Stack Research — v3.0 Superpowers

**Project:** Kluup v3.0
**Researched:** 2026-06-12
**Scope:** Net-new stack additions required for Social Archetypes, Bipolar Trait Sliders, Duo Awards, Contextual Questions, and Power Cards — layered on the existing v2.0 stack.

---

## New Dependencies Required

**None.**

All five v3.0 features can be implemented with the current dependency set. The table below confirms this by feature:

| Feature | New library needed? | Reason |
|---------|---------------------|--------|
| Social archetypes (trait scoring + 21 archetypes) | No | Pure client-side arithmetic on existing `votes` data. Trait bars are `<div>` width percentages rendered with Tailwind. |
| Bipolar trait sliders on /profile | No | CSS `<input type="range">` or static gradient bars; Tailwind v4 handles all styling. |
| Duo awards (pair metrics + 2-face share card) | No | Pair computation is pure JS array reduction. Card flip is CSS 3D transform — Tailwind v4 includes `perspective`, `rotate-y-*`, `backface-hidden`. `modern-screenshot` (already installed) captures each face independently. |
| Contextual questions (adaptive follow-ups) | No | New DB table + new `GamePhase` enum value + new `GameState` fields. Game-loop integration is pure TypeScript. Template variable substitution (`{pseudo}`, `{question}`) is a string `.replace()`. |
| Power cards (Target & Reveal) | No | Weighted random draw is ~10 lines of vanilla JS. The 5-second host-button lock is `setTimeout` + `useRef` — same pattern already used by `VoteTimer`. New `GameState` fields stored in Supabase JSONB. |

---

## What's Already Covered (no addition needed)

- **Supabase Postgres + Realtime** — all new tables (`contextual_questions`) and new JSONB fields (`game_state.power_cards`, `game_state.used_cards`, `game_state.last_contextual_round`, `game_state.contextual_question`, `user_session_stats.tag_scores`, `questions.tags`) fit the existing Supabase project with SQL migrations only.
- **`@supabase/ssr` + `@supabase/supabase-js`** — client already handles auth sessions, realtime subscriptions, and anonymous game data. No upgrade required. `@supabase/supabase-js@^2.107.0` is current.
- **`modern-screenshot`** — the existing share card library captures the DOM node currently visible. The 2-face duo-awards card is implemented as two DOM states (flip via CSS); capture is called on whichever face is showing. No change to the screenshot workflow.
- **Tailwind v4** — trait progress bars (fixed-width `<div>` with percentage-mapped `style.width`), card flip (3D CSS transform classes), bipolar slider styling. Tailwind v4's JIT covers all of this without new plugins.
- **TypeScript** — new `GamePhase` union values, new `GameState` fields, new archetype/award types added to `lib/types.ts` only. No compiler upgrade.
- **React 19 / Next.js 16 App Router** — all new screens are `'use client'` components consistent with the existing game page architecture. No Server Components needed.
- **i18n system (`lib/i18n.ts`)** — all new user-facing strings (archetype names × 21, award names × 4, contextual headers, power card announce text) are added to the existing FR/EN/ES/DE dictionaries. The `Dict` type enforces exhaustiveness at compile time — no library change.
- **Supabase JSONB** — `game_state` is already JSONB. Adding `power_cards`, `used_cards`, `last_contextual_round`, `contextual_question` to the TypeScript type and writing them via the existing `updateRoomGameState()` path requires zero infrastructure change.
- **Weighted random selection (power card attribution)** — implementable as a ~10-line pure JS function (sum weights, pick threshold, iterate). No library (`lodash.sample`, `chance`, etc.) needed.
- **Host-elected advancer pattern** — already used by `VoteTimer` and ghost pruning. Power card roll attribution reuses the same "smallest `player.id` present" election pattern with no new primitives.

---

## Integration Points with Existing Stack

### Feature 1 — Social Archetypes

**DB:** `ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb;`
Add `tag_scores jsonb` to `user_session_stats` for cross-session accumulation (Phase 5 step only).

**Game flow:** Tags must be loaded with question candidates. `pickCandidates` currently returns `Question[]` from Supabase. The `tags` column needs to be included in the select query — update the select in `lib/game.ts` (or wherever candidates are fetched) to include `tags`. Add `tags?: Array<{tag: string, points: number}>` to the `Question` type in `lib/types.ts`.

**Computation:** In the `ended` phase, fetch `votes WHERE player_id = myId AND room_id = roomId`, iterate over `played_question_ids`, determine actor status per round, accumulate tag scores. This is a self-contained function in `lib/game.ts` or a new `lib/archetypes.ts`.

**Share card:** The existing `modern-screenshot` flow captures a DOM node. The archetype block (archetype name + top-3 trait bars) is added to the personal face of the share card as a regular React subtree. No change to screenshot mechanics.

**Critical:** Tag curation (assigning `tags` to existing questions) is a content task, not a code task. It must be completed before archetypes produce meaningful results. Without tagged questions, every player gets "Une simple personne."

### Feature 2 — Bipolar Trait Sliders (/profile)

**DB:** `tag_scores jsonb` field on `user_session_stats` (same migration as archetype cross-session step). Each session write accumulates `{drole, fiable, audacieux, empathique, mysterieux, romantique}` deltas into the cumulative `tag_scores`.

**Rendering:** Bipolar axis (e.g., "Drôle ↔ Sérieux") is a styled `<div>` with a positioned indicator, not an `<input type="range">` — the slider is read-only display, not interactive. Width is computed from the ratio between opposing trait scores. Tailwind handles all positioning.

**Data availability:** Sliders only render meaningfully after ≥3 sessions. Below that threshold, show a "joue encore pour affiner ton profil" placeholder. The accuracy-growth UX is pure conditional rendering.

**Dependency on Feature 1:** The `tag_scores` data populated by Feature 1 (session-level) feeds Feature 2 (cross-session). Implement Feature 1 first; Feature 2's profile page reads the accumulated `user_session_stats.tag_scores`.

### Feature 3 — Duo Awards

**DB:** No new table. Reads from existing `votes` table with `room_id` filter. Single Supabase query at `ended` phase.

**Algorithm:** Pure JS — for each unique player pair, compute 5 metrics from the votes array. O(n × m) where n = players, m = votes. At 10 players × 7 rounds, this is negligible. No performance concern.

**Share card — 2-face flip:** The current single-face card component needs to be wrapped in a flip container. Implementation: outer `<div>` with `style="perspective: 1000px"`, inner container with `transform-style: preserve-3d` and a `rotate-y-180` toggle. Front face = group awards (Face 1, same for everyone). Back face = personal stats + archetype (Face 2, per-player). `modern-screenshot` is called on whichever face is currently visible (the non-rotated face occupies the visible plane).

**Anti-pattern warning:** Do NOT use a third-party card-flip library. The CSS is 10 lines and avoids a dependency that would need maintenance. Tailwind v4's arbitrary value support handles the `perspective` property if needed: `[perspective:1000px]`.

### Feature 4 — Contextual Questions

**DB:**
```sql
CREATE TABLE contextual_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  template jsonb NOT NULL  -- {fr: "...", en: "...", es: "...", de: "..."}
);
```
Enable Realtime on this table only if live authoring is needed — for read-only game use, no Realtime subscription required.

**Game flow integration:** The trigger point is the host pressing "Manche suivante" on a reveal screen. Before writing `voting_question` for round N+1, the host's client runs the probability check. If triggered: fetch `contextual_questions WHERE parent_question_id IN (played_question_ids)`, pick one, resolve the template, write `phase: 'contextual_question'` + new fields to `game_state`, broadcast `phase_changed`. All clients re-render the contextual screen.

**New `GameState` fields** (add to `lib/types.ts`):
```typescript
last_contextual_round: number | null
contextual_question: { template: string; target_player_id: string } | null
```

**New `GamePhase`** (add to union in `lib/types.ts`):
```typescript
| 'contextual_question'
```

**Template resolution:** `template[locale].replace('{pseudo}', player.pseudo).replace('{question}', current_question.question[locale])` — no templating library needed.

**Content dependency:** Like tags, contextual questions are a content task. The feature code is complete but produces nothing until `contextual_questions` rows are inserted.

### Feature 5 — Power Cards

**DB:** No new table. Two new fields in `GameState` JSONB (stored in `rooms.game_state`):
```typescript
power_cards: { target: string | null; reveal: string | null }
used_cards: { target: string[]; reveal: string[] }
```
Add to `lib/types.ts`. The `updateRoomGameState()` path already handles arbitrary JSONB merges.

**Attribution roll:** Executed by the host-elected advancer (smallest `player_id` in presence) at the end of each round, after vote resolution and before transitioning to `voting_question`. Weighted random:
```typescript
function weightedPick(players: {id: string, weight: number}[]): string {
  const total = players.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (const p of players) { r -= p.weight; if (r <= 0) return p.id }
  return players[players.length - 1].id
}
```
Volunteer weights come from `game_state.stats.volunteered` (already tracked).

**5-second host lock:** Uses `setTimeout` + `useRef`, identical pattern to the existing `VoteTimer`. No new primitives.

**New `GamePhase` values:**
```typescript
| 'card_target_result'
| 'card_reveal_roulette'
```

**Anti-race for simultaneous card use:** First write wins. The JSONB update sets `power_cards[type] = null` atomically. The second player's fetch finds it already null and shows "déjà utilisé ce round" — no pessimistic lock or transaction needed given the low concurrency (at most 2 card holders per game).

---

## Recommendations

**1. No new npm packages for any of the 5 features.** The existing stack handles everything. Resist the temptation to reach for animation libraries (Framer Motion, react-spring) for the card flip or roulette — the existing roulette animation is already implemented in pure CSS/JS, and the card flip is 10 lines of CSS transform.

**2. Sequence implementation by data dependency:**
- Phase A: Archetypes (tags migration + curation + client computation + share card block)
- Phase B: Duo awards (pair algorithm + 2-face card refactor) — shares the Face 2 share card with archetypes, implement together or immediately after
- Phase C: Contextual questions (new table + new GamePhase + trigger logic)
- Phase D: Power cards (new GameState fields + attribution roll + usage mechanics)
- Phase E: Bipolar sliders on /profile — depends on Phase A having accumulated `tag_scores` across sessions

**3. Content tasks are the critical path, not code.** Tag curation (questions → traits) and contextual question authoring (30-50% of questions need follow-ups, in 4 languages) will take longer than the code. Start content work in parallel with Phase A/C code work.

**4. The 2-face share card is the highest UI complexity item.** `modern-screenshot` captures DOM as rendered. The flip state must be CSS-only (no JS-triggered layout recalculation mid-capture). Test on iOS Safari — CSS 3D transforms with `backface-visibility: hidden` have historically had rendering bugs on WebKit. Verify with a real device before shipping.

**5. Do NOT add `framer-motion` or `@radix-ui/react-slider` for the bipolar sliders.** The sliders are display-only (read-only). A `<div>` with computed width percentage is sufficient and keeps the bundle lean.

**6. Supabase query for duo awards fetches ALL votes for the room.** At 10 players × 7 rounds × 3-4 votes per round, that's ~280 rows — trivial. No pagination or streaming needed. A single `supabase.from('votes').select().eq('room_id', roomId)` at the `ended` phase is correct.

---

## Current Dependencies (unchanged)

| Package | Version | Role |
|---------|---------|------|
| `next` | 16.2.7 | App Router framework |
| `react` / `react-dom` | 19.2.4 | UI |
| `typescript` | ^5 | Types |
| `tailwindcss` | ^4 | Styling (JIT, includes 3D transform utilities) |
| `@supabase/supabase-js` | ^2.107.0 | Supabase client |
| `@supabase/ssr` | ^0.12.0 | Auth session management (cookie-based) |
| `modern-screenshot` | ^4.7.0 | Share card image capture |

**No version upgrades required.** All packages are current as of 2026-06-12.
