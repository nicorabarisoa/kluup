---
phase: A-social-profile-archetypes-duo-awards
plan: 05
type: execute
wave: 3
depends_on:
  - "A-social-profile-archetypes-duo-awards-04"
files_modified:
  - app/room/[code]/game/page.tsx
autonomous: false
requirements: [REQ-AR-01, REQ-AR-02, REQ-AR-05, REQ-DA-01, REQ-DA-03, REQ-DA-04]
must_haves:
  truths:
    - "At phase 'ended', the client fetches all room votes + played questions (with tags) once and memoizes both"
    - "EndScreen computes the player's archetype (own votes + tags) and the room's duo awards, feeding both into a 2-face ShareCard"
    - "D-01: ShareCard shows Face 1 (group title + duo awards) first; tapping the card flips to Face 2 (personal stats + archetype) via a subtle flip affordance"
    - "Share exports ONLY the currently-visible face via domToBlob; the off-screen capture div renders only the active face"
    - "D-06: tag coverage is audited (empty-tag question count across themes×types) and gaps backfilled — the migration_add_tags.sql tags column is confirmed live on prod (questions have non-empty tags) before relying on it"
  artifacts:
    - path: "app/room/[code]/game/page.tsx"
      provides: "Refactored ShareCard (2-face) + EndScreen (computation hub) wired to ArchetypeBlock/DuoAwardsBlock"
      contains: "activeCard"
  key_links:
    - from: "app/room/[code]/game/page.tsx EndScreen"
      to: "lib/archetypes.ts computeTraitScores/computeArchetype"
      via: "useMemo over fetched votes + played questions"
      pattern: "computeArchetype"
    - from: "app/room/[code]/game/page.tsx EndScreen"
      to: "lib/awards.ts computeDuoAwards"
      via: "useMemo over all room votes + players"
      pattern: "computeDuoAwards"
    - from: "app/room/[code]/game/page.tsx ShareCard"
      to: "components/ArchetypeBlock + components/DuoAwardsBlock"
      via: "Face 2 / Face 1 sub-content render"
      pattern: "ArchetypeBlock|DuoAwardsBlock"
    - from: "app/room/[code]/game/page.tsx EndScreen"
      to: "supabase votes + questions"
      via: "single fetch each at ended, memoized (P-05)"
      pattern: "from\\('votes'\\)|from\\('questions'\\)"
---

<objective>
Refactor `ShareCard` and `EndScreen` in `app/room/[code]/game/page.tsx` into the Phase A computation hub
and 2-face share card. EndScreen fetches all room votes + played questions once, computes the personal
archetype and the room's duo awards, and feeds a refactored ShareCard that shows Face 1 (group + duos) by
default and flips to Face 2 (personal + archetype) on tap. Share exports only the active face.

Purpose: This wires together everything from Plans 01–04 into the user-visible experience (REQ-AR-01/02/05,
REQ-DA-01/03/04). It enforces the capture discipline (active-face-only off-screen render, explicit-px bars
from the components, `document.fonts.ready` before capture) and the determinism/anonymity boundaries.
Scope note: D-08 (background `tag_scores` write) is DEFERRED wholesale with D-07 — the OAuth-redirect
PendingStatsFlusher branch is non-trivial added complexity, which D-08 explicitly says NOT to fold in.
Phase A stays session-only. Do NOT change the `tag_scores: {}` literal in the existing stats-write effect.
Output: a refactored `app/room/[code]/game/page.tsx`.
</objective>

<artifacts_produced>
## Artifacts this phase produces (Plan 05 contributions)

- Refactored `ShareCard` (forwardRef) gains props `activeCard`, `archetype`, `duoAwards`; splits into Face 1 / Face 2 sub-content
- Refactored `EndScreen`: 2 new fetches (`allRoomVotes`, `playedQuestions`) + 2 useMemo computations (`archetypeResult`, `duoAwardsResult`) + `activeCard` state + flip affordance
- Imports added: `computeTraitScores`, `computeArchetype` (lib/archetypes), `computeDuoAwards` (lib/awards), `ArchetypeBlock`, `DuoAwardsBlock` (components)
- No new exported symbols, no new game_state fields, no new tables (all per A-CONTEXT.md)
</artifacts_produced>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/A-social-profile-archetypes-duo-awards/A-UI-SPEC.md
@.planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md
@.planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md
@CLAUDE.md
@app/room/[code]/game/page.tsx
@lib/archetypes.ts
@lib/awards.ts
@components/ArchetypeBlock.tsx
@components/DuoAwardsBlock.tsx
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <what-built>
    Nothing built yet in this task — this is a BLOCKING prerequisite verification gate (per CLAUDE.md
    §"Gotchas / ops": Kluup applies SQL manually in the Supabase dashboard, NOT via `supabase db push`).
    The archetype feature is dead-on-arrival if the `questions.tags` column is empty on prod. The
    `supabase/migration_add_tags.sql` uses fragile French text-matching UPDATEs (P-18), so it can silently
    leave rows with `tags = '[]'` on an encoding mismatch.
  </what-built>
  <how-to-verify>
    1. Open the Supabase SQL editor for project ref `dmxjspnrrgcixzcthgwf` (the prod project).
    2. Run: `SELECT COUNT(*) FROM questions WHERE tags = '[]'::jsonb;` (empty-tags count)
    3. Run: `SELECT COUNT(*) FROM questions WHERE tags != '[]'::jsonb;` (tagged count)
    4. Expected: the tagged count is the large majority; the empty count is small (< ~10% of rows).
    5. If the empty count is large / the column does not exist: run `supabase/migration_add_tags.sql`
       ONCE in the SQL editor (it is idempotent for the ADD COLUMN; UPDATEs are safe to re-run as they
       overwrite tags). Then re-run steps 2-4. If many rows still empty after running, investigate the
       P-18 smart-apostrophe encoding mismatch before proceeding (otherwise every player gets
       "Une simple personne" regardless of gameplay).
  </how-to-verify>
  <resume-signal>Type "tags live" (with the two counts) once the tagged count dominates, or describe the gap.</resume-signal>
</task>

<task type="auto">
  <name>Task 1: EndScreen computation hub — fetch votes + played questions, compute archetype + awards</name>
  <read_first>
    - app/room/[code]/game/page.tsx (EndScreen ~L1303-1596 — the file/function being modified: existing stat-write useEffect L1318, stats derivation L1346, showCard/cardRef state L1360, exportCard L1364, card modal L1567-1593)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md (EndScreen refactor → votes fetch with single-fire guard, useMemo for archetype + awards, activeCard state, exportCard unchanged)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md (System Architecture Diagram; Pitfall 7 / P-05 single-fetch; open question 3 → explicit votes column list)
    - lib/archetypes.ts (computeTraitScores, computeArchetype signatures) and lib/awards.ts (computeDuoAwards)
    - supabase/schema.sql (votes columns; answer boolean)
  </read_first>
  <action>
    In EndScreen add two `useState` + a single `useEffect` (gated on `gs?.phase === 'ended'`, fires once —
    P-05) that fetches: (a) all room votes via `supabase.from('votes').select('id, round, player_id, vote_type,
    target_player_id, answer').eq('room_id', roomId)` — use an explicit column list per A-RESEARCH.md open
    question 3; derive `roomId` from `players[0]?.room_id` (Player has `room_id` — lib/types.ts L5) or thread it
    in; (b) played questions via `supabase.from('questions').select().in('id', gs.played_question_ids)` (when
    `played_question_ids.length > 0`, else set `[]`). Store both in state, never refetch (P-05 — dependency array
    is `[gs?.phase]`). Add `useMemo` `archetypeResult`: when votes+questions+myId present, compute
    `computeArchetype(computeTraitScores(allRoomVotes.filter(v => v.player_id === myId), playedQuestions, gs))`,
    else `null`. Add `useMemo` `duoAwardsResult`: `computeDuoAwards(allRoomVotes, players)` when votes+players
    present, else `[]`. Import the four symbols from lib/archetypes + lib/awards. Do NOT modify the existing
    stat-write useEffect (L1318) — leave `tag_scores: {}` exactly as is (D-08 deferred per D-07). No fenced code.
  </action>
  <verify>
    <automated>npx vitest run; npx next build</automated>
  </verify>
  <acceptance_criteria>
    - app/room/[code]/game/page.tsx imports `computeTraitScores`, `computeArchetype` from `@/lib/archetypes` (or relative) and `computeDuoAwards` from `@/lib/awards`
    - EndScreen contains a votes fetch with the explicit column list `'id, round, player_id, vote_type, target_player_id, answer'` and a `.eq('room_id', ...)`
    - EndScreen contains `useMemo` producing `archetypeResult` and `duoAwardsResult`
    - The votes/questions fetch effect dependency array is `[gs?.phase]` (single-fire, P-05) — not players-dependent
    - The existing stat-write effect still contains `tag_scores: {}` (D-08 NOT folded — grep confirms `tag_scores: {}` unchanged)
    - `npx vitest run` exits 0 and `npx next build` succeeds
  </acceptance_criteria>
  <done>EndScreen fetches votes + played questions once and memoizes archetype + duo-award results.</done>
</task>

<task type="auto">
  <name>Task 2: ShareCard 2-face refactor + flip + active-face capture wiring</name>
  <read_first>
    - app/room/[code]/game/page.tsx (ShareCard ~L1187-1299 forwardRef + 540×540 container; card modal usage L1567-1593 with off-screen capture div + scaled preview; exportCard L1364)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-UI-SPEC.md (§ Card Architecture — 2-Face Contract; § Flip Interaction Contract; § Capture Container Contract; Face 1 / Face 2 layouts + edge cases D-03)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md (ShareCard refactor → forwardRef prop additions, face swap conditional render not display:none, flip affordance outside capture, off-screen + scaled-preview instances)
    - components/ArchetypeBlock.tsx + components/DuoAwardsBlock.tsx (the blocks to slot into Face 2 / Face 1)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md (Pattern 3; Pitfall 5 / P-07 — never render both faces with display:none)
  </read_first>
  <action>
    Extend the `ShareCard` forwardRef prop type with `activeCard: 'group' | 'personal'`,
    `archetype: ArchetypeResult | null`, `duoAwards: DuoAward[]` (import the types from lib/archetypes / lib/awards).
    Inside the 540×540 container, after the 6px color bar + theme/logo header, CONDITIONALLY RENDER one face
    (`activeCard === 'group' ? <Face1…> : <Face2…>`) — NEVER both, NEVER `display:none` (P-07 / Pitfall 5). Extract
    the shared bottom (player pills + footer) so both faces reuse it. Face 1 (group, default): existing
    `fr.end.group_title_label` + 42px group title, then `<DuoAwardsBlock awards={duoAwards} themeColor={meta.color} />`
    ONLY when `duoAwards.length >= 2` (D-03 / REQ-DA-03 — fewer than 2 → group title alone, no placeholder), then
    spacer + pills + footer. Face 2 (personal): existing "Moment fort" block + existing personal stats pills
    (unchanged), then `<ArchetypeBlock archetypeKey={archetype.archetypeKey} topTraits={archetype.topTraits}
    themeColor={meta.color} />` ONLY when `archetype` is non-null (REQ-AR-05 — total points > 0 yields a non-null
    result; fallback archetype still renders its name per A-UI-SPEC.md edge case), then spacer + pills + footer.
    In EndScreen's card modal: add `const [activeCard, setActiveCard] = useState<'group'|'personal'>('group')`;
    pass `activeCard`, `archetype={archetypeResult}`, `duoAwards={duoAwardsResult}` to BOTH ShareCard instances
    (the off-screen `ref={cardRef}` capture div AND the scaled preview). Add tap-to-flip: the scaled-preview
    wrapper `onClick` toggles `activeCard` (150ms opacity fade, no 3D rotateY — A-UI-SPEC.md Flip Interaction).
    Render the flip affordance (`fr.card.flip_to_personal` / `fr.card.flip_to_group`) and the Share button OUTSIDE
    both ShareCard instances, in the modal chrome only (D-02 — Share below the card; never inside the capture
    container). `exportCard()` is UNCHANGED — it reads `cardRef.current`, which now renders only the active face,
    so `domToBlob` captures the active face (REQ-DA-04 / D-04). Keep `await document.fonts.ready` before capture.
    No fenced code in this action — copy structure/identifiers from A-PATTERNS.md ShareCard refactor section.
  </action>
  <verify>
    <automated>npx next build</automated>
  </verify>
  <acceptance_criteria>
    - ShareCard prop type includes `activeCard`, `archetype`, `duoAwards`
    - The face render is conditional (`activeCard === 'group' ?`) with NO `display: none` on a second face (grep `display: 'none'` / `display:none` absent in the ShareCard subtree)
    - `<DuoAwardsBlock` is rendered only under a `duoAwards.length >= 2` (or `>= 2`) guard (D-03)
    - `<ArchetypeBlock` is rendered only under an `archetype` non-null guard
    - EndScreen has `activeCard` state defaulting to `'group'`; both ShareCard instances receive `activeCard`
    - The flip affordance + Share button are NOT inside the `ref={cardRef}` off-screen div
    - exportCard still calls `domToBlob(cardRef.current, { width: 540, height: 540, scale: 2, ... })` and awaits `document.fonts.ready`
    - `npx next build` succeeds
  </acceptance_criteria>
  <done>ShareCard is 2-faced (group default, tap to personal), renders the blocks under their guards, and Share exports the active face only.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking-human">
  <what-built>
    The full Phase A end-to-end experience: at the end of a game, Face 1 shows the group title + duo awards,
    tapping flips to Face 2 (personal stats + archetype with top-3 colored trait bars), and Share exports the
    currently-visible face as a PNG. This requires a real multi-player session and a real device because the
    modern-screenshot capture fidelity (bar widths, no clipping, emoji rendering) cannot be asserted headlessly
    (A-VALIDATION.md § Manual-Only Verifications; REQ-DA-04).
  </what-built>
  <how-to-verify>
    1. Play a real 3-player (or 3 browser tabs) game to the end screen — enough rounds to accumulate tags
       across Type A / B / C (aim for >= 3 rounds).
    2. On the end screen, tap "Partager la soirée" to open the card. Confirm Face 1 (group) shows first with
       the group title and (if >= 2 awards qualify) the duo awards block (emoji + award name + "Pseudo1 & Pseudo2").
    3. Tap the card. Confirm it flips to Face 2: personal stats pills (unchanged) + the archetype block with the
       archetype name UPPERCASE and 1–3 colored trait bars with percentages.
    4. With Face 1 visible, tap Share → confirm the exported PNG is the GROUP face (no clipping, bars/emoji
       render correctly). Flip to Face 2, Share again → confirm the exported PNG is the PERSONAL face.
    5. Compare Face 1 across two players' screens — the duo awards must be IDENTICAL (P-19 determinism).
    6. Confirm a player with no qualifying gameplay sees the fallback archetype ("Une simple personne") and that
       a room with < 2 qualifying awards shows the group title alone (no duos block, no placeholder text).
  </how-to-verify>
  <resume-signal>Type "verified" once both faces export cleanly and Face 1 matches across clients, or describe the issues.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→Supabase (votes/questions read) | EndScreen fetches all room votes (incl. confession answers) and played questions at 'ended' |
| shared card PNG | The exported image is shared off-app; it must not leak who-confessed-what |
| cross-client agreement | Face 1 must be identical on every client (duo awards determinism) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-A-12 | Information disclosure | Type B archetype points in EndScreen wiring (P-04) | mitigate | EndScreen passes `allRoomVotes.filter(v => v.player_id === myId)` into computeTraitScores — only the player's OWN votes reach the archetype path. The anonymity enforcement itself lives in lib/archetypes.ts (Plan 02, grep-gated). EndScreen never derives Type B actor status from `gs.revealed_player_ids`. |
| T-A-13 | Information disclosure | confession_overlap raw votes fetched client-side (P-12) | accept (documented) | Known MVP gap under open RLS — all room votes are already client-readable in the existing game flow. Raw `answer` values feed only the pure metric function and are never rendered (DuoAwardsBlock shows pseudos + award names only). Flag in SUMMARY for a future server-side RPC before premium launch. No regression vs. current posture. |
| T-A-14 | Tampering | Face 1 cross-client divergence (P-19) | mitigate | computeDuoAwards (Plan 03) sorts by player.id; verified deterministic in unit tests + the manual cross-client check in this plan (checkpoint step 5). |
| T-A-15 | Tampering | capture rendering (P-07, both faces / % widths) | mitigate | Off-screen capture div renders ONLY the active face (conditional, no display:none — grep-gated); trait bars use explicit px (enforced in Plan 04). `await document.fonts.ready` retained before domToBlob. |
| T-A-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs in this plan (Vitest installed in Plan 01; no `[ASSUMED]`/`[SUS]` packages anywhere in Phase A). No install checkpoint required here. |
</threat_model>

<verification>
- `npx vitest run` exits 0 (pure-module suites still green after wiring) and `npx next build` succeeds
- Grep in the ShareCard subtree: conditional face render present, `display: none` second-face absent (P-07)
- Grep: `tag_scores: {}` in the existing stat-write effect is unchanged (D-08 deferred)
- Manual checkpoint: both faces export cleanly on a real device; Face 1 identical across two clients (P-19)
- Manual checkpoint: tags column confirmed live on prod before relying on archetype output (P-18)
</verification>

<success_criteria>
- EndScreen fetches votes + played questions once (P-05), memoizes archetype + duo awards
- ShareCard: Face 1 (group + duos, default) ↔ tap ↔ Face 2 (personal + archetype); only active face in capture
- DuoAwardsBlock rendered only when >= 2 awards qualify (D-03); ArchetypeBlock only when archetype present
- Share exports the active face via domToBlob (REQ-DA-04); fonts.ready awaited
- D-08 deferred: `tag_scores: {}` literal untouched; no new game_state fields / tables / deps
- Manual end-to-end + cross-client Face 1 verification passed
</success_criteria>

<output>
Create `.planning/phases/A-social-profile-archetypes-duo-awards/A-05-SUMMARY.md` when done
</output>
