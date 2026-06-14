# Phase A: Social Profile & Archetypes + Duo Awards - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn in-game behaviour into a **personal archetype** and **named duo awards**, surfaced on a refactored **2-face share card** at the end screen.

- **Face 2 (personal):** existing personal stats + a new archetype block (21 archetypes + fallback), computed from `myId`'s own votes and the played questions' `tags`.
- **Face 1 (group):** group title + duo awards (4 named pair awards), computed from all room `votes`.
- **Entirely client-side at phase `ended`** — no new tables, no new npm deps, and **no new `game_state` fields**. Two pure modules (`lib/archetypes.ts`, `lib/awards.ts`) feed a refactored `ShareCard`/`EndScreen`.

**Session-only** for the visible experience. Cross-session persistence and `/profile` cumulative archetype are out of scope (see D-07 / Deferred).
</domain>

<decisions>
## Implementation Decisions

### Card structure & flip UX
- **D-01:** The share card becomes **2-faced**. **Face 1 (group: group title + duo awards) shows FIRST**; a **tap anywhere on the card** flips to **Face 2 (personal: existing stats + archetype block)**. The group reveal is the "main event"; the personal archetype is the flip payoff. Add a subtle affordance (e.g. "tap to see your archetype →") — exact microcopy/animation is Claude's discretion.
- **D-02:** The **Share button sits BELOW the card**, outside the flip surface, so tap-to-flip never collides with sharing.
- **D-03:** Edge case (spec-locked): if **fewer than 2 duo awards** qualify (score ≥ 2 threshold), Face 1 shows the **group title alone** (no duos block). Face 2 is always present. Archetype block renders only when the player's total points > 0; otherwise the fallback "Une simple personne" is shown.

### Export / sharing
- **D-04:** "Partager" exports **only the currently-visible face** — `modern-screenshot` (`domToBlob`) captures the active face, one image, via Web Share on mobile with download fallback. Chosen to avoid the known iOS Safari / WebKit `backface-visibility` quirks with multi-face capture. Render only the active face in the capture container.

### Trait visualization
- **D-05:** **6 distinct per-trait hues**, harmonized against the dark card (suggested family: drôle=amber, fiable=blue, audacieux=red, empathique=green, mystérieux=violet, romantique=pink — **exact hex finalized at implementation**). Personality-result aesthetic (à la 16personalities). Show the **top 3 traits** with bar + %; archetype name **uppercase, Bricolage Grotesque display font** (spec-locked). Use **explicit pixel widths** for the bars in the capture container, not `%` (PITFALLS).

### Tag coverage & fallback
- **D-06:** **Audit tag coverage** — count `questions` with empty `[]` tags across all 4 themes × types A/B/C — and **backfill the gaps** so a player who was an "actor" almost always accumulates points. "Une simple personne" remains a legitimate outcome only for genuinely balanced/quiet profiles, not a symptom of missing curation.

### Scope
- **D-07:** Phase A is **session-only** for the user-visible experience (archetype + duo awards from this room's votes). The cross-session piece — writing `tag_scores` to `user_session_stats` and a cumulative archetype on `/profile` — is **deferred to the later Bipolar Sliders phase**. Matches spec étape 1 + research build order.
- **D-08:** *Optional, planner's call:* if it lands **cleanly on the existing end-screen stats-save path** (the signed-in player's trait scores are already computed for the card), also write `tag_scores` to `user_session_stats` **in the background (no `/profile` UI)** to start accumulation early — so the later sliders phase isn't launched against empty history. **Fold in only if zero added scope/complexity**; otherwise defer wholesale with D-07. If folded, respect PITFALLS: compute `tag_scores` **before** the upsert (`ignoreDuplicates: true` makes a partial `{}` write permanent), and ensure the `PendingStatsFlusher` stash carries `room_id` + `player_id` so it can refetch votes.

### Claude's Discretion
- Exact trait hex palette and bar styling; flip affordance microcopy + animation; precise 2-face layout.
- **Determinism (technical, per PITFALLS):** sort player pairs by `player.id` before duo-award computation so every client derives the same Face 1; keep Type B archetype points sourced from `myId`'s own votes only (anonymity boundary).
- `never`-type exhaustiveness guard on any `GamePhase` switch touched.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature specs (the locked algorithms)
- `docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md` — archetype data model, point attribution by type, calc algorithm, 21 archetypes + thresholds + i18n keys, share-card block.
- `docs/superpowers/specs/2026-06-10-duo-awards-design.md` — 5 pair metrics, 4 awards + thresholds/variety rule, client algorithm, 2-face card layout, edge cases, i18n keys.
- `docs/superpowers/specs/2026-06-12-ux-patch-lobby-flash-replay-choice.md` — recent end-screen/replay UX patch; check for interactions with the card refacto.

### Research (v3.0)
- `.planning/research/SUMMARY.md` — build order, integration shape, top-10 pitfalls.
- `.planning/research/ARCHITECTURE.md` — `lib/archetypes.ts` + `lib/awards.ts` module boundaries, EndScreen as computation hub.
- `.planning/research/PITFALLS.md` — iOS Safari capture quirks, explicit-pixel bars, tag_scores upsert ordering, determinism, anonymity boundary.
- `.planning/research/FEATURES.md`, `.planning/research/STACK.md` — table-stakes vs differentiators, no-new-deps confirmation.

### DB / curation (already staged — verify on prod, do not recreate)
- `supabase/migration_add_tags.sql` — `ALTER TABLE questions ADD COLUMN tags` + per-question UPDATEs (curation). **Run-once** on the existing prod base.
- `supabase/seed.sql`, `supabase/seed_themes.sql`, `supabase/seed_cut.sql` — questions now include `tags` for fresh bases.
- `supabase/schema.sql` — source of truth; `user_session_stats.tag_scores` already declared (used only if D-08 folded).

### i18n (already staged)
- `lib/i18n.ts` — `archetype_*` (21 + `archetype_fallback`), `award_*` (4), `awards_title`, `trait_*` (6) keys present in **fr/en/es/de**.

### Existing code to refactor
- `app/room/[code]/game/page.tsx` — `ShareCard` (~L1187), `EndScreen` (~L1303), `domToBlob` capture (~L1371), card usage (~L1577). `game_state.played_question_ids` already tracked.
- `app/PendingStatsFlusher.tsx`, `app/profile/page.tsx` — stats-save path (relevant only if D-08 folded).
- `lib/game.ts`, `lib/types.ts` — keep new computation OUT of `game.ts`; add `GameState`/types as needed (none required for the visible scope).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ShareCard` / `EndScreen`** already render the group title + personal stats and capture to PNG via `modern-screenshot` `domToBlob` with Web Share + download fallback — reuse the capture path, split the markup into 2 faces.
- **`votes` table** already holds everything needed: Type A designations, Type B `answer='oui'`, Type C `vote_type='volunteer'`, designations — one `select().eq('room_id', roomId)` powers all duo metrics; `player_id = myId` powers archetype points.
- **`game_state.played_question_ids`** already lists the played questions to fetch tags for.
- **`lib/i18n.ts` `useT()`** convention (`const fr = useT()`) for all archetype/award/trait strings (keys already exist).

### Established Patterns
- Pure engine modules separate from UI (`lib/game.ts` style) → add `lib/archetypes.ts`, `lib/awards.ts` as pure functions.
- Client-side, zero-API computation at `ended` (same model as group titles / personal stats — "zéro appel API, zéro coût").
- Deterministic cross-client computation (sort by `player.id`) so all clients render identical Face 1.

### Integration Points
- **EndScreen is the computation hub:** 2 queries (all room votes + played questions with tags), **memoize once**, feed both `lib/archetypes.ts` (Face 2) and `lib/awards.ts` (Face 1).
- No new `game_state` fields, no new tables, no new deps for the visible scope.
</code_context>

<specifics>
## Specific Ideas

- "Group reveal is the main event" → Face 1 (group + duo awards) is the **default** face; personal archetype is the **flip payoff**.
- Trait bars should feel like a **personality-result** (à la 16personalities) — distinct per-trait colors, not a monochrome brand wash.
- Keep the iOS-safe capture discipline from v2.0 (modern-screenshot, real-size off-screen copy, explicit pixel widths).
</specifics>

<deferred>
## Deferred Ideas

- **Cross-session archetype on `/profile`** + `tag_scores` accumulation display + **bipolar trait sliders** (MBTI-style, accuracy grows with sessions) → **Bipolar Sliders phase** (final v3.0 phase). D-08 may seed the `tag_scores` *write* early, but the UI stays deferred.
- **Contextual questions** → Phase B. **Power cards** → Phase C. (Both out of scope here; no `game_state`/loop changes in Phase A.)
- Multi-image / stacked-image export, swipe-to-flip — considered and rejected (D-04 / D-01) for iOS reliability and back-swipe conflict; revisit only if the visible-face export underdelivers.

None of the above are blockers — discussion stayed within phase scope.
</deferred>

---

*Phase: A-social-profile-archetypes-duo-awards*
*Context gathered: 2026-06-14*
