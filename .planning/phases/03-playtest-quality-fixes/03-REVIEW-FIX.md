---
phase: 03-playtest-quality-fixes
fixed_at: 2026-06-11T10:30:00Z
review_path: .planning/phases/03-playtest-quality-fixes/03-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-11T10:30:00Z
**Source review:** .planning/phases/03-playtest-quality-fixes/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (5 critical, 5 warning)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: Vote resolution is not advancer-gated — every client races with independent `Math.random()` winner selection

**Files modified:** `app/room/[code]/game/page.tsx`
**Commit:** 4c9e131
**Applied fix:** Added `isAdvancerRef` (a ref kept in sync with the derived `isAdvancer` value) so async broadcast closures see the current advancer status. Gated `resolveVotes` in `submitVote` and `resolveTypeCChoice` in `submitChoice` with `&& isAdvancer`. Augmented the `vote_count` broadcast handler to trigger resolution when the advancer receives a broadcast indicating threshold has been reached — this handles the case where the last voter is NOT the advancer. Requires human verification of the logic.

---

### CR-02: `tallyDesignation` receives live `players.length` instead of frozen `vote_round_player_count`

**Files modified:** `app/room/[code]/game/page.tsx`
**Commit:** 735a254
**Applied fix:** Changed `tallyDesignation(votes, players.length)` in the `designation` branch of `resolveVotes` to use `const frozenCount02 = gs.vote_round_player_count || players.length` as the `playerCount` argument, so `tieAll` is calculated against the frozen snapshot taken at round start rather than the live roster.

---

### CR-03: `ChoiceScreen` (Type C) has no `VoteTimer` — 30-second auto-skip never fires on `round_c_choice`

**Files modified:** `app/room/[code]/game/page.tsx`
**Commit:** 86bbe00
**Applied fix:** Added `isAdvancer: boolean` to `ChoiceScreen` props and mounted a `VoteTimer` (keyed by `gs.round`, with elapsed-time compensation from `gs.round_started_at`) in the footer, matching the pattern used by `QuestionSelectionScreen`, `DesignationVoteScreen`, and `ConfessionVoteScreen`. Updated the call site to pass `isAdvancer={isAdvancer}`.

---

### CR-04: `shuffle()` uses a biased sort comparator — non-uniform permutation distribution

**Files modified:** `lib/game.ts`
**Commit:** ee82a59
**Applied fix:** Replaced `[...arr].sort(() => Math.random() - 0.5)` with Fisher-Yates (Knuth) shuffle that produces a uniformly random permutation. Added explanatory comment about why `Array.sort` with a random comparator is biased.

---

### CR-05: `cleanup_dead_rooms` TTL (60 s) is only 2× the presence heartbeat (30 s)

**Files modified:** `supabase/lifecycle.sql`
**Commit:** 0c0dda0
**Applied fix:** Changed the `interval '60 seconds'` WHERE clause to `interval '90 seconds'` (3× the 30 s heartbeat), providing a 60 s safety margin against delayed heartbeats. Updated the Block 3 comment to explain the 3× rationale.

---

### WR-01: `resolveTypeCChoice` uses live `players.length` for `tallyDesignation`

**Files modified:** `app/room/[code]/game/page.tsx`
**Commit:** 735a254
**Applied fix:** Changed `tallyDesignation(desigs, players.length)` in `resolveTypeCChoice` to use `const frozenCountC = gs.vote_round_player_count || players.length`, consistent with the CR-02 fix and the contract of `tallyDesignation`.

---

### WR-02: `lobby/page.tsx:startGame` calls `crypto.randomUUID()` directly — throws on HTTP/LAN

**Files modified:** `app/room/[code]/lobby/page.tsx`
**Commit:** 52b0603
**Applied fix:** Added `genId` to the `@/lib/utils` import in lobby/page.tsx and replaced `crypto.randomUUID()` with `genId()`, which is the project's safe wrapper that falls back to a timestamp-based ID on non-secure contexts.

---

### WR-03: Visitor arriving at `/room/[code]/game` without a player ID gets stuck on `LoadingScreen` forever

**Files modified:** `app/room/[code]/game/page.tsx`
**Commit:** 90c496c
**Applied fix:** Added a `useEffect` that watches `[room, myId]` and redirects to `/join?code=${code}` when `room` is set but `myId` is null. Matches the redirect pattern already used by the lobby page.

---

### WR-04: `B2RouletteScreen` `nobody` check derived from `revealed_player_ids.length` — dual-semantics issue

**Files modified:** `app/room/[code]/game/page.tsx`
**Commit:** ed54b5c
**Applied fix:** Changed `const nobody = yesCount === 0` to `const nobody = pct === 0` and `const allYes = pct === 100 && yesCount > 0` to `const allYes = pct === 100`. `pct` (`yes_percentage`) is the canonical single-source of truth, set once from the frozen vote snapshot at resolution.

---

### WR-05: `onQuit` / host-transfer pattern has a TOCTOU gap — room can be left with no host

**Files modified:** `app/room/[code]/game/page.tsx`, `app/room/[code]/lobby/page.tsx`
**Commit:** cdd172b
**Applied fix:** After the `players.update({ is_host: true })` call, checked the `.select().single()` result. If `updated` is null (the intended next host was deleted before our update landed), re-reads the roster and retries the host transfer with whoever is still present. Applied to both the game page and lobby page `onQuit` implementations.

---

## Skipped Issues

None — all 10 in-scope findings were fixed.

---

_Fixed: 2026-06-11T10:30:00Z_
_Fixer: Claude Sonnet 4.6 (gsd-code-fixer)_
_Iteration: 1_
