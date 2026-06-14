---
phase: "06-social-profile-archetypes-duo-awards"
plan: "05"
subsystem: "game-ui"
tags: ["share-card", "end-screen", "archetypes", "duo-awards", "modern-screenshot"]
dependency_graph:
  requires:
    - "06-04"   # ArchetypeBlock + DuoAwardsBlock components
    - "06-02"   # lib/archetypes.ts (computeTraitScores, computeArchetype)
    - "06-03"   # lib/awards.ts (computeDuoAwards)
  provides:
    - "2-face ShareCard wired to archetype + duo awards computation"
    - "EndScreen as computation hub fetching votes + played questions"
  affects:
    - "app/room/[code]/game/page.tsx"
tech_stack:
  added: []
  patterns:
    - "P-05 single-fire fetch at ended phase (useEffect [gs?.phase])"
    - "P-07 conditional face render — never display:none"
    - "P-19 deterministic pair sort (in computeDuoAwards, Plan 03)"
    - "T-A-12 anonymity boundary — own votes only into computeTraitScores"
    - "D-02 flip affordance + Share button outside capture container"
    - "D-03 DuoAwardsBlock omitted when < 2 awards qualify"
key_files:
  modified:
    - "app/room/[code]/game/page.tsx"
decisions:
  - "Combined Task 1 (EndScreen hub) + Task 2 (ShareCard 2-face) into a single commit: both tasks modify the same file and Task 2 directly consumes archetypeResult/duoAwardsResult produced by Task 1 — atomic commit avoids a broken intermediate state"
  - "activeCard reset to 'group' on modal open: ensures Face 1 always shows first on each session share (D-01 spec)"
  - "D-08 tag_scores write deferred: tag_scores: {} literal left exactly as-is in the existing stat-write useEffect, per plan constraint"
metrics:
  duration_seconds: ~360
  completed_date: "2026-06-14"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 06 Plan 05: ShareCard / EndScreen 2-Face Refactor Summary

**One-liner:** 2-face share card (group + duo awards ↔ personal + archetype) wired to single-fire vote fetch in EndScreen, captured face-only via modern-screenshot.

## What Was Built

### Task 1: EndScreen Computation Hub

`app/room/[code]/game/page.tsx` — EndScreen now fetches all room votes + played questions once at `gs.phase === 'ended'` and memoizes the archetype and duo awards results.

Changes:
- Added `useMemo` to React imports.
- Added imports: `computeTraitScores`, `computeArchetype`, `VoteRow`, `ArchetypeResult` from `@/lib/archetypes`; `computeDuoAwards`, `DuoAward` from `@/lib/awards`; `ArchetypeBlock` from `@/components/ArchetypeBlock`; `DuoAwardsBlock` from `@/components/DuoAwardsBlock`.
- Two new `useState` pairs: `allRoomVotes: VoteRow[] | null` and `playedQuestions: Question[] | null`.
- One new `useEffect` gated on `gs?.phase === 'ended'` with dependency array `[gs?.phase]` (P-05 single-fire). Fetches votes with explicit column list `'id, round, player_id, vote_type, target_player_id, answer'` + played questions by ID.
- `archetypeResult` useMemo: filters `allRoomVotes` to `player_id === myId` (T-A-12 anonymity boundary), calls `computeTraitScores` + `computeArchetype`.
- `duoAwardsResult` useMemo: passes all room votes + all players to `computeDuoAwards` (P-19 determinism enforced inside that function).
- `activeCard: 'group' | 'personal'` state added adjacent to `showCard`.
- `tag_scores: {}` literal in the existing stat-write useEffect: **untouched** (D-08 deferred wholesale, per plan).

### Task 2: ShareCard 2-Face Refactor + Flip Interaction

`app/room/[code]/game/page.tsx` — ShareCard refactored into two conditional faces; flip affordance + Share button outside capture container.

Changes:
- New helper `CardFooter`: shared player pills + footer used by both faces.
- New `Face1GroupContent`: group title (42px Bricolage 800) + `<DuoAwardsBlock>` guarded by `duoAwards.length >= 2` (D-03 / REQ-DA-03).
- New `Face2PersonalContent`: existing Moment fort block + existing personal stats pills + `<ArchetypeBlock>` guarded by `archetype !== null` (REQ-AR-05). Both blocks are unchanged from the pre-Phase-6 design.
- `ShareCard` forwardRef: extended props with `activeCard: 'group' | 'personal'`, `archetype: ArchetypeResult | null`, `duoAwards: DuoAward[]`. Inside the 540×540 container, replaced all previous content with `activeCard === 'group' ? <Face1GroupContent> : <Face2PersonalContent>` — conditional render, never `display:none` (P-07).
- Card modal: off-screen capture div (`ref={cardRef}`) passes `activeCard` + `archetype` + `duoAwards`; scaled visual preview also receives the same props and wraps an `onClick` toggling `activeCard`.
- Flip affordance `<p>` is rendered below the scaled preview, outside both ShareCard instances (D-02, never captured in PNG).
- Share / Close buttons remain in modal chrome outside both ShareCard instances (D-02).
- `exportCard()` is unchanged: still calls `domToBlob(cardRef.current, { width: 540, height: 540, scale: 2, backgroundColor: C.bg })` after `await document.fonts.ready`; the off-screen div now renders only the active face (REQ-DA-04).
- Share CTA button resets `activeCard` to `'group'` before opening the modal (Face 1 always shown first per D-01).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The two tasks were implemented in a single atomic commit because they share the same file and Task 2 consumes state produced by Task 1.

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Imports `computeTraitScores`, `computeArchetype` from `@/lib/archetypes` | PASS |
| Imports `computeDuoAwards` from `@/lib/awards` | PASS |
| Votes fetch with explicit column list `'id, round, player_id, vote_type, target_player_id, answer'` + `.eq('room_id', ...)` | PASS |
| `archetypeResult` useMemo present | PASS |
| `duoAwardsResult` useMemo present | PASS |
| Votes/questions fetch effect dep array is `[gs?.phase]` (P-05) | PASS |
| `tag_scores: {}` unchanged (D-08 not folded — grep confirmed) | PASS |
| ShareCard prop type includes `activeCard`, `archetype`, `duoAwards` | PASS |
| Face render is conditional (`activeCard === 'group' ?`) with NO `display:none` on second face | PASS |
| `<DuoAwardsBlock>` guarded by `duoAwards.length >= 2` | PASS |
| `<ArchetypeBlock>` guarded by `archetype !== null` | PASS |
| EndScreen has `activeCard` state defaulting to `'group'` | PASS |
| Both ShareCard instances receive `activeCard` | PASS |
| Flip affordance + Share button NOT inside `ref={cardRef}` div | PASS |
| `exportCard` calls `domToBlob(cardRef.current, {...})` and awaits `document.fonts.ready` | PASS |
| `npx vitest run` exits 0 (12/12 green) | PASS |
| `npx next build` succeeds | PASS |

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The existing T-A-13 (confession_overlap raw votes client-readable) is a known MVP gap documented in `lib/awards.ts` — no regression vs. current posture.

## Known Stubs

None — all data sources are live (Supabase votes + questions fetches, `gs.played_question_ids`). The archetype result may be null (fallback) if the tags migration hasn't run on prod — this is handled gracefully (ArchetypeBlock is conditionally rendered only when `archetype !== null`).

## Manual Checkpoints Remaining (for the user)

These two `checkpoint:human-verify` gates from the plan require manual action. The code is safe to ship before them — if prod tags are empty, archetypes come back null (no crash); the card still shows Face 1 (group) cleanly.

---

### Checkpoint 1: Tags Column Live on Prod

**Gate:** `blocking-human`

**How to verify:**
1. Open the Supabase SQL editor for project ref `dmxjspnrrgcixzcthgwf` (the prod project).
2. Run: `SELECT COUNT(*) FROM questions WHERE tags = '[]'::jsonb;` (empty-tags count)
3. Run: `SELECT COUNT(*) FROM questions WHERE tags != '[]'::jsonb;` (tagged count)
4. Expected: the tagged count is the large majority; the empty count is small (< ~10% of rows).
5. If the empty count is large / the column does not exist: run `supabase/migration_add_tags.sql` ONCE in the SQL editor (it is idempotent for the ADD COLUMN; UPDATEs are safe to re-run as they overwrite tags). Then re-run steps 2-4. If many rows still empty after running, investigate the P-18 smart-apostrophe encoding mismatch before proceeding (otherwise every player gets "Une simple personne" regardless of gameplay).

**Resume signal:** "tags live" (with the two counts) once the tagged count dominates, or describe the gap.

---

### Checkpoint 2: End-to-End Device Test

**Gate:** `blocking-human` (visual/functional — requires real multi-player session + real device)

**How to verify:**
1. Play a real 3-player (or 3 browser tabs) game to the end screen — enough rounds to accumulate tags across Type A / B / C (aim for >= 3 rounds).
2. On the end screen, tap "Partager la soirée" to open the card. Confirm Face 1 (group) shows first with the group title and (if >= 2 awards qualify) the duo awards block (emoji + award name + "Pseudo1 & Pseudo2").
3. Tap the card. Confirm it flips to Face 2: personal stats pills (unchanged) + the archetype block with the archetype name UPPERCASE and 1–3 colored trait bars with percentages.
4. With Face 1 visible, tap Share → confirm the exported PNG is the GROUP face (no clipping, bars/emoji render correctly). Flip to Face 2, Share again → confirm the exported PNG is the PERSONAL face.
5. Compare Face 1 across two players' screens — the duo awards must be IDENTICAL (P-19 determinism).
6. Confirm a player with no qualifying gameplay sees the fallback archetype ("Une simple personne") and that a room with < 2 qualifying awards shows the group title alone (no duos block, no placeholder text).

**Resume signal:** "verified" once both faces export cleanly and Face 1 matches across clients, or describe the issues.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 + Task 2 (combined) | b3eca84 | feat(06-05): EndScreen computation hub + ShareCard 2-face refactor |

## Self-Check

- [x] `app/room/[code]/game/page.tsx` exists and was modified
- [x] Commit b3eca84 is present in git log
- [x] `npx vitest run` — 12/12 tests pass
- [x] `npx next build` — succeeds
- [x] `tag_scores: {}` literal untouched (grep confirmed at line 1431)
- [x] No `display: none` on second card face (grep confirmed — only comments reference it)
- [x] Flip affordance and Share button outside `ref={cardRef}` capture div (code review confirmed)
