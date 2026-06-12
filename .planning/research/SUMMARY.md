# Research Summary — v3.0 Superpowers

**Project:** Kluup v3.0 — Superpowers milestone
**Domain:** Social-identity layer on an existing real-time party game (Next.js 16 / Supabase)
**Researched:** 2026-06-12
**Confidence:** HIGH

---

## The One-Paragraph Picture

v3.0 adds five social features — **Social Archetypes**, **Bipolar Trait Sliders**, **Duo Awards**, **Contextual Questions**, **Power Cards** — that turn raw game behaviour into personal identity. The big surprise: **the database groundwork is already staged**. `questions.tags` is migrated and curated, the `contextual_questions` table is created and seeded (~60 rows), and `user_session_stats.tag_scores` is declared — none of it wired to code. So this milestone is overwhelmingly **application code + content polish, not schema work**. Zero new npm packages and zero new DB tables are required.

---

## Stack — Watch Out For

- **No new dependencies.** Everything (weighted random, CSS transforms, string templating, arithmetic) is covered by the current stack.
- **Content is the critical path, not code.** Tag curation (already largely done) and contextual-question authoring across 4 languages take longer than the code.
- **The 2-face share card is the highest-risk UI item.** CSS flip + `modern-screenshot` capture needs real-device testing on iOS Safari (WebKit backface-visibility quirks). Render only the active face in the capture container; use explicit pixel widths for trait bars, not `%`.

## Features — Table Stakes vs Differentiators

- **Archetypes + Duo Awards are a pair** (shared 2-face card) — ship together or create throwaway work.
- **Bipolar Sliders are blocked on cross-session `tag_scores`** — ship the archetype *name* on `/profile` as a v3.0 preview; full sliders follow once accumulation exists.
- **Power Cards = highest risk** (B2 roulette is the game's most loaded moment) — build last, QA independently.
- **Anti-features to honour:** archetypes/awards are private (never shown to the group), no leaderboards, no precise pseudoscientific %, no timer on contextual screen, cards usable only during `round_b2_roulette`.

## Architecture — Integration Shape

- **2 new pure modules:** `lib/archetypes.ts`, `lib/awards.ts` (keep out of `lib/game.ts`).
- **EndScreen is the computation hub:** 2 queries (all room votes + played questions with tags) feed archetypes, duo awards, and the `tag_scores` write together — fetch once, memoize.
- **`onNextRound` becomes a host-only orchestrator:** roll power cards → trigger contextual → write → broadcast, with try/catch fallback to normal `voting_question`.
- **New GameState fields** (all optional, backward-safe): `last_contextual_round`, `contextual_question`, `power_cards`, `used_cards`, `b2_revealed_at`.
- **New GamePhases:** `contextual_question`, `card_target_result`, `card_reveal_roulette`.

## Pitfalls — Top 10 Preventions

1. **`normalizeGameState()` before reading any new field** — defaults for old in-flight room blobs; prevents deploy-time crashes.
2. **Power-card attribution needs an atomic DB guard** (conditional UPDATE / RPC) — full-blob `game_state` replaces drop concurrent writes.
3. **Contextual probability roll is host-exclusive**, template fully resolved for all 4 locales before write.
4. **Type B archetype points fetch `myId`'s own votes** — never read public `game_state` reveal fields (anonymity boundary).
5. **Power-card 5s window uses `b2_revealed_at` server timestamp**, not client `setTimeout` (same fix as vote timers).
6. **Share-card trait bars use explicit pixel widths**; validate `domToBlob` on the new card shape before shipping.
7. **`tag_scores` computed before the upsert** — `ignoreDuplicates: true` makes a partial `{}` write permanent.
8. **Add RLS `SELECT USING (true)` for `contextual_questions`** — missing policy = silent 0 rows (the "Room introuvable" root cause again).
9. **Sort pairs by `player.id` before Duo Awards computation** — deterministic awards across all clients.
10. **`never` type guard on every `GamePhase` switch** — catches unhandled new phases at compile time so rooms can't get stuck.

---

## Recommended Build Order (→ roadmap phases, continuing from Phase 5)

| # | Feature | Why here | Complexity |
|---|---------|----------|------------|
| 6 | **Social Archetypes** | No deps, highest standalone value, unblocks Duo Awards; add `contextual_questions` RLS now | High content / Low code |
| 7 | **Duo Awards + 2-face share card** | Shares Face 2 with archetypes; reuse votes query | Medium |
| 8 | **Contextual Questions** | Independent; content + new phase; first game-loop change | High |
| 9 | **Power Cards** | Highest risk; touches B2 roulette; QA independently | High |
| 10 | **Bipolar Trait Sliders on /profile** | Gated on accumulated cross-session `tag_scores` from Phase 6 | Low |

> Note: Bipolar Sliders depend on Phase 6 having written real `tag_scores` across several sessions. They are a finishing phase, not an opener.

## Open Questions to Resolve During Planning
- Bipolar axis **opposite-pole labels** (6 pairs) — content decision before the sliders phase.
- Share card **tap-to-flip vs scroll** gesture conflict on mobile.
- `PendingStatsFlusher` stash format — confirm `room_id` + `player_id` are stashed so it can fetch votes to compute `tag_scores`.
