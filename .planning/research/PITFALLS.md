# Pitfalls Research — v3.0 Superpowers

**Domain:** Real-time party game — adding 5 social features to existing Next.js 16 / Supabase system
**Researched:** 2026-06-12
**Scope:** System-specific pitfalls for Social Archetypes, Bipolar Trait Profile, Duo Awards, Contextual Questions, Power Cards

---

## P-01: Power Card Race Condition on Attribution Roll

**Risk level:** High
**Feature affected:** Power Cards
**What goes wrong:** The power card attribution roll is meant to be run by "the elected advancer (smallest player.id present)." But the advancer pattern was designed for timer expiry — a single bounded trigger. Post-round attribution fires at the same moment for every client after `resolveVotes` writes `phase_changed`. If two clients both evaluate "I am the smallest id" before the first write lands in Supabase and broadcasts back, both attempt to write `power_cards` to `game_state`. The second write silently overwrites the first because `updateRoomGameState` is a full jsonb replace (not a partial update). Result: one card attribution is lost.

**Prevention:** Gate the roll behind an atomic DB guard. The advancer writes a sentinel value first (e.g., `power_cards_rolling: true`) using a conditional UPDATE (`WHERE game_state->>'power_cards_rolling' IS DISTINCT FROM 'true'`). Only the client that wins the conditional update proceeds with the full roll and writes the result. Alternatively, move the roll to a Postgres RPC (`SECURITY DEFINER`) so the DB enforces atomicity. The design spec says "same pattern as the timer advancer" — but the timer advancer does not have this multi-write risk because it sets a single new phase; here two card types are computed and written simultaneously in a full-blob replace.

**Which phase to address:** First phase implementing Power Cards, before any card attribution logic is wired.

---

## P-02: `game_state` Shape Break for In-Flight Rooms

**Risk level:** High
**Feature affected:** Contextual Questions, Power Cards (both add new `GameState` fields)
**What goes wrong:** When new fields are added to `GameState` (`last_contextual_round`, `contextual_question`, `power_cards`, `used_cards`, `b2_revealed_at`), existing rooms whose `game_state` was written before the deploy will not have these fields. Any client code that reads these fields without optional-chaining or defaults will throw at runtime: `gs.power_cards.target` crashes if `power_cards` is `undefined`. TypeScript's type system does not protect against missing fields from older DB blobs at runtime. Players mid-game during a Railway deploy will hit this.

**Prevention:**
1. Declare all new `GameState` fields as optional (`field?: Type`), not required.
2. Access them with nullish coalescing everywhere: `gs.power_cards?.target ?? null`.
3. Add a `normalizeGameState(gs: Partial<GameState>): GameState` helper that fills defaults for any missing field. Call it immediately after every Supabase fetch (`applyRoom`, `useEffect` on room data).
4. Do NOT add required fields to `GameState` without a migration path for old blobs.

**Which phase to address:** Before writing any code that reads the new fields. The normalize helper must be the first thing built in each phase that touches `GameState`.

---

## P-03: Contextual Question Trigger Runs Differently on Different Clients

**Risk level:** High
**Feature affected:** Contextual Questions
**What goes wrong:** The trigger logic uses `Math.random() < probability`. If this check runs on every client independently when the host presses "Next Round," each client computes a different random outcome. Clients that roll "no contextual" transition to `voting_question` immediately; the host (who rolled "yes") transitions to `contextual_question`. The room's `game_state.phase` is `contextual_question` (written by the host) but other clients may have already rendered to `voting_question` based on their own roll. They self-correct only after the broadcast refetch. More critically: if the trigger is not exclusively host-gated and two clients both "win" the check, they could write conflicting phases — last write wins, producing a non-deterministic phase.

**Prevention:**
1. The contextual question probability roll MUST happen exclusively inside the host's `onNextRound` handler (already host-only). No other client computes or writes this.
2. Store the resolved template text (with `{pseudo}` already substituted for all 4 locales) in `game_state.contextual_question` — never store the raw template and re-resolve on each client, which would require each client to query `contextual_questions` independently.
3. The DB query to fetch a contextual question template must complete before the `updateRoomGameState` write. Write phase first → fetch after is wrong; fetch first → write is correct.

**Which phase to address:** Core of the Contextual Questions phase. Treat it as a host-exclusive write path from day one, not something that can be added "to all clients" later.

---

## P-04: Archetype Computation Anonymity Leak via Type B Votes

**Risk level:** High
**Feature affected:** Social Archetypes
**What goes wrong:** For Type B, the design spec says "the player who voted 'oui' receives the points — read from their own votes." The computation fetches `votes WHERE player_id = myId AND answer = true`. This is intentionally private. However, `game_state.revealed_player_ids` and `game_state.designated_player_id` (for B roulette winner) are public fields shared to all clients via the room row. If the archetype code instead reads from these public fields to determine "who confessed" for trait scoring, it exposes which players voted "oui" to all clients — breaking the fundamental "confession roulette only reveals one name" guarantee. This is an easy mistake to make because `game_state.designated_player_id` is already in scope when the end screen renders.

**Prevention:**
1. For Type B archetype points: always use a per-player vote fetch (`votes WHERE player_id = myId AND room_id = roomId AND vote_type = 'confession' AND answer = true`). Never use `game_state.revealed_player_ids`, `game_state.designated_player_id`, or `game_state.stats.confessed` as the source for self-attribution of B points.
2. Add a code comment: `// PRIVACY: Type B points are self-reported from own votes only. Do NOT use game_state fields here.`
3. During code review, flag any read of `game_state.confessed` or `revealed_player_ids` inside the archetype computation module as a privacy bug.

**Which phase to address:** During Social Archetypes implementation, before the archetype calculation is wired to the end screen.

---

## P-05: Duo Awards Fetch Re-Fires on Every EndScreen Re-render

**Risk level:** High
**Feature affected:** Duo Awards
**What goes wrong:** The design says "fetch all votes for the room: `supabase.from('votes').select().eq('room_id', roomId)`." A 7-round game with 8 players produces approximately 110 vote rows. Small — but this fetch is called by every player at the end screen. If the end screen re-renders due to presence updates, roster changes, or other realtime events while players are on it, the fetch re-fires per client on every re-render cycle. At 8 players, that is potentially 8 × N fetches where N = number of re-renders. The awards are also recomputed on every render if not memoized.

**Prevention:**
1. Fetch votes exactly once via a `useEffect` with `[roomId]` as dependency (or `session_uuid`), store in local state. Never re-fetch on re-renders from other causes.
2. Memoize the award computation with `useMemo` keyed on the fetched votes array.
3. Verify via React DevTools that `EndScreen` does not unmount/remount when players join or leave (presence updates hit the roster, which may trigger re-renders of the parent but should not remount `EndScreen` if it is keyed correctly).

**Which phase to address:** During Duo Awards implementation. Verify fetch lifecycle before shipping.

---

## P-06: Power Card 5-Second Window Desync Between Clients

**Risk level:** High
**Feature affected:** Power Cards
**What goes wrong:** The 5-second host button block is implemented client-side as a timer started when `b2_revealed` flips to true. Each client starts the timer independently from the moment they receive the `phase_changed` broadcast and refetch. Network latency means Client A may receive the broadcast 800ms later than Client B. Client B's 5s window expires first; the card holder (on Client B) sees their button disappear. The host (on Client A) still has their "Next Round" locked. Meanwhile, a card use write and the host's eventual "Next Round" write race in a full-blob `game_state` replace — last writer wins, dropping the earlier write silently.

**Prevention:**
1. Do not use client-side `setTimeout` for the 5-second window. Add a `b2_revealed_at` ISO timestamp to `game_state`, written when `b2_revealed` is set. Each client computes remaining time as `Math.max(0, 5000 - (Date.now() - new Date(gs.b2_revealed_at).getTime()))`. This is the exact same pattern as `round_started_at` which already solves timer desync for votes.
2. The host button unlock and the card use window must both derive from this server-written timestamp, not from independent local timers.
3. Guard the "Next Round" handler: if `game_state.power_cards_pending` is true (a card was used but its result phase has not been shown yet), do not allow phase transition.

**Which phase to address:** First implementation of Power Cards. The `b2_revealed_at` field addition and the 5s window logic must be in the same commit.

---

## P-07: Share Card DOM Capture Breaks with New Archetype Block and 2-Face Card

**Risk level:** High
**Feature affected:** Social Archetypes, Duo Awards (2-face card)
**What goes wrong:** The share card uses `modern-screenshot` / `domToBlob` on a 540×540 off-screen `div` with `position: relative` and explicit pixel dimensions. This works because all existing content uses fixed inline styles. Adding the archetype block introduces:
- Trait bar elements with percentage-based widths (`width: X%`) that may compute to 0 in the off-screen capture context if the container has no rendered width at capture time.
- The 2-face card (Face 1 group / Face 2 personal) may use `display: none` or `visibility: hidden` to hide the inactive face. `modern-screenshot` can include hidden elements in layout calculations or produce visual artifacts.
- Emoji glyphs in award names (🧲 ⚔️ 💥 🔥) may render as boxes on some Android WebViews using the system emoji font. The existing card already uses text-only content.

**Prevention:**
1. Use explicit pixel widths for trait bars: compute `barWidthPx = Math.round((traitPercent / 100) * MAX_BAR_PX)` and apply as `style={{ width: barWidthPx }}` where `MAX_BAR_PX` is a fixed constant.
2. For the 2-face card: do NOT render both faces simultaneously with one hidden. Render only the active face in the capture container. Maintain a separate state variable for `activeCard: 'group' | 'personal'` and conditionally render one face.
3. Validate `domToBlob` on the new card shape in a dev build before shipping. Use the existing `getBoundingClientRect()` check pattern from CLAUDE.md gotchas.
4. Replace emoji in card text with SVG icons or plain text alternatives. Do not rely on emoji rendering for card-critical visual elements.

**Which phase to address:** During Duo Awards (2-face card) and Social Archetypes (archetype block). Card capture validation must be a done-definition item for both phases.

---

## P-08: Anonymous Players' `tag_scores` Lost Through OAuth Flow

**Risk level:** Medium
**Feature affected:** Social Archetypes (cross-session), Bipolar Trait Profile
**What goes wrong:** The `user_session_stats` upsert is gated on `user?.id` — correct. For anonymous players, the end screen computes a session archetype correctly (client-side only). The pitfall: if the end screen CTA says "sign in to save your archetype" and the player signs in via Google OAuth (which redirects away from the page), the `PendingStatsFlusher` mechanism carries the existing stats fields when the player returns. But if `tag_scores` is not included in the `setPendingStats` payload, the `PendingStatsFlusher` upsert writes `tag_scores: {}` permanently. With `ignoreDuplicates: true`, a subsequent write with the real `tag_scores` is silently ignored — the row keeps `tag_scores = {}` forever.

**Prevention:**
1. Compute `tag_scores` synchronously on the end screen (before any OAuth redirect), then include it in the `setPendingStats` payload alongside existing stats fields.
2. Update `PendingStatsFlusher` to include `tag_scores` in its upsert call.
3. Add a null-guard: if `tag_scores` is absent from a pending stats object (old format stashed before v3.0), default to `{}` — do not crash on outdated stash format.

**Which phase to address:** When wiring `tag_scores` into `user_session_stats`. Check `PendingStatsFlusher` before writing the stats upsert.

---

## P-09: `contextual_questions` Table Missing RLS Policy — Silent Empty Results

**Risk level:** Medium
**Feature affected:** Contextual Questions
**What goes wrong:** The `contextual_questions` table is created in `seed_contextual_questions.sql` with `CREATE TABLE IF NOT EXISTS` but there is no RLS policy for it in `schema.sql`. Without `ALTER TABLE contextual_questions ENABLE ROW LEVEL SECURITY` and a SELECT policy for `anon`, the host client will get an empty result set (0 rows, no PostgREST error) when querying `contextual_questions`. The game silently skips all contextual questions. This is the exact same root cause as the "Room introuvable" bug documented in CLAUDE.md gotcha #1 — RLS enabled without an open anon SELECT policy.

**Prevention:**
1. Add to `schema.sql` (or a dedicated migration):
   ```sql
   ALTER TABLE contextual_questions ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "contextual_questions_read" ON contextual_questions FOR SELECT USING (true);
   ```
2. Note: `contextual_questions` does NOT need to be added to `supabase_realtime` — it is queried on-demand, not subscribed to.
3. Add a diagnostic log in the contextual fetch: if the query returns 0 rows for a `parent_question_id` that definitely has sub-questions (known from the seed), log the PostgREST error. `{ data: [], error: null }` with 0 rows = silent RLS rejection.

**Which phase to address:** In the same migration/schema update that creates the `contextual_questions` table. Run before any end-to-end contextual question test.

---

## P-10: `played_question_ids` / Contextual FK Mismatch from Duplicate Seeds

**Risk level:** Medium
**Feature affected:** Contextual Questions
**What goes wrong:** The contextual trigger algorithm queries `contextual_questions WHERE parent_question_id IN (game_state.played_question_ids)`. This works only if the UUIDs in `played_question_ids` match the UUIDs stored in `contextual_questions.parent_question_id`. The `seed_contextual_questions.sql` inserts rows using `(SELECT id FROM questions WHERE question->>'fr' = '...' LIMIT 1)`. If `seed.sql` or `seed_themes.sql` was run more than once (documented CLAUDE.md gotcha: "ré-exécution = doublons"), multiple question rows exist for the same text. `LIMIT 1` picks one UUID arbitrarily; the game may pick the other UUID when recording `played_question_ids`. The contextual lookup returns 0 results silently.

**Prevention:**
1. Never re-run `seed.sql`, `seed_themes.sql`, or `seed_cut.sql` on a production database that already has question rows.
2. In development, if resetting the DB, drop and recreate tables before re-seeding.
3. Validate after running `seed_contextual_questions.sql`: `SELECT COUNT(*) FROM contextual_questions WHERE parent_question_id IS NULL` — a non-zero count means the FK lookup failed (parent question not found), indicating duplicate question rows.

**Which phase to address:** During DB setup for the Contextual Questions phase. Document in the migration runbook as a pre-condition check.

---

## P-11: Power Card Attribution Write Does Not Trigger Visible Phase Change

**Risk level:** Medium
**Feature affected:** Power Cards
**What goes wrong:** The power card roll writes new `game_state.power_cards` values after each round. The existing convergence model: write `game_state` → broadcast `phase_changed` → all clients refetch. But `phase` does not change during the card roll (it stays `voting_question` for the next round). Some client code may shortcut re-rendering if the phase value did not change — particularly if local state is compared against the refetched phase. If the card holder's client does not fully re-render after the roll, it never sees `power_cards.target = myId` and does not know it holds a card.

**Prevention:**
1. Always broadcast `phase_changed` after writing `power_cards`, even though the phase value did not change — the broadcast is the convergence mechanism, not a "phase diff" mechanism.
2. Read `power_cards` directly from the refetched `game_state` object in the component. Do not cache a "I have a card" boolean in local state separately from `game_state`.
3. Add a `power_cards_seq` integer to `game_state` that increments with each roll. Clients compare `power_cards_seq` (not `phase`) to detect card state changes.

**Which phase to address:** During Power Cards implementation, in the advancer roll logic.

---

## P-12: Duo Awards Confession Overlap Metric Breaches Type B Anonymity

**Risk level:** Medium
**Feature affected:** Duo Awards
**What goes wrong:** The `confession_overlap` metric (for "Les Complices" award) counts rounds where both players A and B voted "oui" on the same Type B question. Computing this requires reading `votes WHERE vote_type = 'confession' AND answer = true` for all players. Current RLS is fully open (anon can SELECT all votes including `answer` fields). This means every client can read every player's confession votes — including who voted "oui" on which question. The Duo Awards computation makes this cross-player reading unavoidable for the Complices score. Even if the award UI only shows "Nico & Sarah are Complices," a developer tool inspection of the fetched vote data exposes individual confession answers to any player.

**Prevention:**
1. For v3.0 with open RLS: scope the computation output to pair-level scores only — do not expose raw vote rows in any component prop or rendered content. The intermediate vote data is used only in the computation function scope and discarded.
2. Add a comment in the computation: `// PRIVACY NOTE: This fetch exposes all confession answers. Open RLS is a known MVP gap. Move to server-side RPC before premium launch.`
3. Long term: move Duo Awards computation to a Postgres RPC that returns only aggregate pair scores, not raw `answer` fields.

**Which phase to address:** During Duo Awards design review. Flag as a known privacy gap in the phase documentation.

---

## P-13: `tag_scores` Upsert Uses `ignoreDuplicates: true` — Partial Write Becomes Permanent

**Risk level:** Medium
**Feature affected:** Social Archetypes (cross-session), Bipolar Trait Profile
**What goes wrong:** The existing `user_session_stats` upsert uses `{ onConflict: 'user_id,session_id', ignoreDuplicates: true }`. This is intentional for idempotency. But if `tag_scores` is written as `{}` on the first write (before archetype computation completes) and the computation fires in a later effect, `ignoreDuplicates: true` means the second write with the real `tag_scores` is silently ignored. The row permanently keeps `tag_scores = {}`. This bug is invisible — no error, no warning, just wrong data.

**Prevention:**
1. Compute `tag_scores` synchronously before the upsert. Await any async vote fetch for Type B self-votes inside the same effect that performs the write. Do not split computation and write into separate effects.
2. Do not write a partial row first and plan to update `tag_scores` later. If the computation requires async work, delay the entire upsert until the computation is complete.
3. If an update path is needed (e.g., for retries), use an explicit UPDATE query targeting only `tag_scores`, not another upsert with `ignoreDuplicates`.

**Which phase to address:** During Social Archetypes stats persistence. Determine write order before implementing.

---

## P-14: Contextual Question Template Stored in Host's Locale Only

**Risk level:** Medium
**Feature affected:** Contextual Questions
**What goes wrong:** The design spec says the template is "resolved in the locale active at trigger time" — meaning the host substitutes `{pseudo}` into the FR/EN/ES/DE template based on the host's current locale, and stores the resolved string. If the host is in FR and a player has EN set, that player sees a French contextual question despite their EN preference. The "store resolved template" approach is correct for preventing multi-client resolution divergence, but it bakes in the host's locale for all players.

**Prevention:**
1. Store the full multilingue object in `game_state.contextual_question` with `{pseudo}` already substituted for each language key:
   ```ts
   contextual_question: {
     fr: "Thomas, vu que...",
     en: "Thomas, since...",
     es: "Thomas, ya que...",
     de: "Thomas, da..."
   } | null
   ```
2. Each client renders `gs.contextual_question[locale]`. No randomness is involved in rendering — pure locale lookup.
3. This requires the host to fetch and substitute all 4 locale variants before writing, not just the active locale.

**Which phase to address:** During Contextual Questions implementation, before the `game_state` schema is finalized for this feature.

---

## P-15: Bipolar Trait Profile Uses `select('*')` as User Session Count Grows

**Risk level:** Medium
**Feature affected:** Bipolar Trait Profile
**What goes wrong:** The `/profile` page currently fetches all `user_session_stats` rows with `select('*')`. Adding `tag_scores` jsonb to each row means each fetched row is larger. For a user with 50 sessions, this is still small. The pitfall is establishing the pattern of `select('*')` with no row limit — future column additions accumulate without bounds, and the cumulative archetype computation (sum of `tag_scores` across all rows) runs synchronously on mount without memoization, recomputing on every re-render triggered by any parent state change.

**Prevention:**
1. Use an explicit column select: `select('session_id, tag_scores, played_at, group_title, theme, rounds_played, designated_count, confessed_count, volunteered_count')` — not `select('*')`.
2. Memoize the cumulative `tag_scores` sum with `useMemo` keyed on the fetched rows array.
3. If cross-session archetype computation becomes a bottleneck at scale, move it to a materialized view or a dedicated `user_cumulative_scores` table updated at end-of-session.

**Which phase to address:** During Bipolar Trait Profile implementation. The explicit column select is a day-one practice.

---

## P-16: Power Card Simultaneous Use Race — Full-Blob Write Drops Earlier Effect

**Risk level:** Medium
**Feature affected:** Power Cards
**What goes wrong:** Two card holders (one with Target, one with Reveal) could both tap "Use my card" within the same broadcast window, before either has seen the other's action via a refetch. Both see `used_cards = { target: [], reveal: [] }` and proceed. Both `updateRoomGameState` calls are full-blob replaces. Even though they write different fields (`power_cards.target` vs `power_cards.reveal`), both writes include the full `game_state` object. The second write overwrites the first write's entire blob — the first card's result is lost from `game_state`.

**Prevention:**
1. Use phase transitions as a serialization mechanism: Target card use writes a new phase `card_target_result`; Reveal card use writes `card_reveal_roulette`. Since both transitions try to set `game_state.phase` via a full-blob replace, only one can be the final value — the client that writes second will see the phase has changed on the next refetch and abort.
2. If both card types could be used in the same round simultaneously, the spec must clarify priority. "First arrived, first served" requires DB-level atomicity (RPC with conditional write) to be reliable.
3. For v3.0, the simpler safe approach: only one card type can be used per Type B round. Make Target and Reveal mutually exclusive in the same reveal cycle.

**Which phase to address:** During Power Cards implementation. Decide on phase-transition vs RPC serialization approach before coding.

---

## P-17: New `GamePhase` Values Have No UI Handler — Rooms Get Stuck

**Risk level:** Low
**Feature affected:** Contextual Questions (`contextual_question`), Power Cards (`card_target_result`, `card_reveal_roulette`)
**What goes wrong:** The game page has a main render conditional over `GamePhase` values. Adding 3 new phases without handling them in every conditional causes the game to render nothing (or the wrong component) for any client on those phases. TypeScript catches exhaustive union errors only if the switch uses a `never` type guard — if any branch uses `default: return null`, TypeScript is silent. A room stuck in `card_target_result` with no client handler is unrecoverable without a direct DB UPDATE on the room's `game_state`.

**Prevention:**
1. Update the `GamePhase` union type in `lib/types.ts` first. For every switch over `GamePhase`, replace `default: return null` with:
   ```ts
   default: {
     const _exhaustiveCheck: never = gs.phase;
     return null;
   }
   ```
   This produces a compile-time error for unhandled phases.
2. Build new phase handler components before deploying any `game_state` writes that produce those phases. Deploy order: UI handler first, `game_state` write second.
3. Add a `phase === 'unknown_phase_fallback'` safety net at the bottom of the render: if an unrecognized phase string arrives (from a newer server than the client), show a "Reconnecting..." spinner rather than a blank screen.

**Which phase to address:** Immediately when adding any new `GamePhase` to `lib/types.ts`. The `never` guard is a one-line TypeScript change with outsized protection.

---

## P-18: Archetype Tags Migration Silently Misses Questions Due to Text Mismatch

**Risk level:** Low
**Feature affected:** Social Archetypes
**What goes wrong:** `migration_add_tags.sql` adds `tags jsonb NOT NULL DEFAULT '[]'` and runs UPDATE statements keyed on `question->>'fr'` text matches. If any question text in the DB has a slightly different wording (trailing space, smart apostrophe `'` vs straight `'`), the UPDATE silently matches 0 rows and that question keeps `tags = []`. When the archetype computation runs, questions with empty tags contribute 0 points for everyone. If a significant portion of played questions have no tags, all players fall into the "Une simple personne" fallback, making the archetype feature appear broken with no error surfaced.

**Prevention:**
1. After running the tags migration, validate:
   ```sql
   SELECT COUNT(*) FROM questions WHERE tags = '[]'::jsonb;
   ```
   If the count exceeds ~10% of total questions, the text-match updates failed. Investigate encoding differences.
2. Use `migration_add_tags.sql` is already authored (file exists in the repo) — verify it ran and matched before v3.0 deploy.
3. Add a minimum-coverage warning in the archetype computation: if fewer than 3 played questions contributed any tag points, display "Not enough data yet" rather than the "Une simple personne" fallback archetype, so players understand it is a data gap not a personality result.

**Which phase to address:** During DB migration validation for Social Archetypes. Run the validation query before deploying the feature.

---

## P-19: Duo Award Tie-Break Produces Different Winners on Different Clients

**Risk level:** Low
**Feature affected:** Duo Awards
**What goes wrong:** The "variété préférée" tie-breaking rule ("prefer the pair that does not yet have an award") requires iterating award candidates in a specific order. If two clients sort their pair list differently before applying this rule, they may assign the same award to different pairs. Since Duo Awards is computed purely client-side with no canonical source, different clients would show different award winners on the Face 1 (group) card — the card that is meant to be identical for the whole group.

**Prevention:**
1. Sort pairs by a stable key before award computation: `[...pairs].sort((a, b) => a[0].id.localeCompare(b[0].id) || a[1].id.localeCompare(b[1].id))`. This ensures every client operates on the same ordered list.
2. Sort the award types in a fixed canonical order (e.g., `['magnetisme', 'longueur_onde', 'ennemis', 'complices']`) before applying the variété rule.
3. The computation is fully deterministic given sorted inputs — no randomness involved, so cross-client consistency is achievable with sorting alone.

**Which phase to address:** During Duo Awards implementation. Add the stable sort as a prerequisite to the award computation function.

---

## P-20: `MAX_ROUNDS` Hardcode Interacts with Contextual Phase Round Count

**Risk level:** Low
**Feature affected:** Contextual Questions
**What goes wrong:** `MAX_ROUNDS = 7` is a hardcoded constant in `game/page.tsx`. The end-condition check is `gs.round >= MAX_ROUNDS` evaluated somewhere in the round-end flow. Contextual questions do not count as rounds (correct per spec). But if the round increment happens inside a shared handler that also handles `contextual_question` → `voting_question` transitions, the round may increment at the wrong moment. The spec says "round increments only when contextual_question transitions to voting_question" — if this increment fires twice (once at contextual trigger, once at contextual dismiss), a 7-round game ends at round 6.

**Prevention:**
1. Round increment must happen only in `onNextRound` when transitioning from a reveal phase to `voting_question`. It must NOT increment when inserting `contextual_question` (reveal → contextual) or when dismissing it (contextual → voting_question).
2. Add explicit guards at the top of any round-count handler: `if (gs.phase === 'contextual_question') return // context is not a round`.
3. The `last_contextual_round` field prevents back-to-back contextuals within the same round — verify this guard also prevents any double-counting of the round number.

**Which phase to address:** During Contextual Questions implementation, specifically in the round-end and round-start handlers.

---

## Quick-Reference Prevention Checklist

1. **Add `normalizeGameState()` before reading any new field** — fill defaults for all new optional `GameState` fields on every DB fetch. Prevents runtime crashes on in-flight rooms with old state shapes.

2. **Power card attribution uses an atomic DB guard** — conditional UPDATE or RPC, not the bare advancer pattern. Full-blob `game_state` replaces from two clients drop whichever wrote first.

3. **Contextual question probability roll is host-exclusive** — runs only inside `onNextRound` (host-only handler). Template fully resolved (all 4 locales, `{pseudo}` substituted) before the `updateRoomGameState` write.

4. **Type B archetype points fetch `myId` votes from DB** — never read from `game_state.revealed_player_ids` or `confessed` maps for self-attribution. This is a privacy boundary, not a performance choice.

5. **Power card 5-second window uses `b2_revealed_at` server timestamp** — same pattern as `round_started_at`. Client-side `setTimeout` desync is the same failure mode already solved for vote timers.

6. **Share card trait bars use explicit pixel widths** — not percentage widths in the off-screen capture container. Test `domToBlob` on the new card shape before shipping archetype block or 2-face card.

7. **`tag_scores` computed before the upsert, not after** — async Type B vote fetch must complete inside the same effect that writes `user_session_stats`. `ignoreDuplicates: true` makes partial rows with `{}` permanent.

8. **Add RLS policy for `contextual_questions`** — `SELECT USING (true)` for anon in `schema.sql`. Missing policy = silent 0 rows, identical to the "Room introuvable" root cause.

9. **Sort pairs by `player.id` before Duo Awards computation** — lexicographic stable sort ensures every client produces the same award assignments from the same vote data.

10. **Add `never` type guard to every `GamePhase` switch** — catches unhandled new phases (`contextual_question`, `card_target_result`, `card_reveal_roulette`) at compile time, before a room can get stuck in a phase with no UI handler.
