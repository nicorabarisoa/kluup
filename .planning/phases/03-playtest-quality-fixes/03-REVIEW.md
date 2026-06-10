---
phase: 03-playtest-quality-fixes
reviewed: 2026-06-10T00:00:00Z
updated: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/join/page.tsx
  - app/room/[code]/game/page.tsx
  - app/room/[code]/lobby/page.tsx
  - lib/game.ts
  - lib/i18n.ts
  - lib/types.ts
  - lib/usePresence.ts
  - lib/utils.ts
  - supabase/lifecycle.sql
  - supabase/migrations/003-pseudo-unique.sql
  - supabase/schema.sql
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: issues_found
resolved:
  - CR-01 (fixed in 4f077d8)
  - WR-01 (fixed in 4f077d8)
---

# Phase 3: Code Review Report (updated — gap-closure plans 03-06/07/08)

**Reviewed:** 2026-06-10 (original) / 2026-06-11 (gap-closure addendum)
**Depth:** standard
**Files Reviewed:** 13 (original 11 + `lib/utils.ts` + `supabase/lifecycle.sql`)
**Status:** issues_found

---

## Summary

**Original review (2026-06-10):** Per-room pseudo uniqueness, player-joined toast, timer resynchronisation (`round_started_at`/`initialSecs`), frozen vote-count snapshot (`vote_round_player_count`). Headlines: broadcast side-effect inside setState updater (CR-01, resolved); five additional warnings around the mid-round-joiner model, timer drift, grace-period mismatch, and error visibility.

**Gap-closure addendum (2026-06-11):** Plans 03-06, 03-07, and 03-08 added:
- SC-8: frozen denominator in ChoiceScreen VoteProgress + HostSkipBtn
- 5b: VoteTimer removed from Type C choice phase (locked design decision)
- SC-5: lazy-stamp `round_started_at` for pre-Phase-3 in-flight rows
- SC-4: `setLastPseudo`/`getLastPseudo` helpers + join-page pre-fill
- SC-3: `cleanup_dead_rooms()` threshold 30 min → 60 s + pg_cron every-minute schedule

The gap-closure work is generally sound. Two warnings were found in the new code: a thin heartbeat safety margin at the new 60 s sweep threshold and a silent user-input overwrite on the reconnect pre-fill path. One info item flags a stale `round_c_choice` inclusion in the lazy-stamp timer-phase list after the choice-phase timer was removed.

---

## Critical Issues

### CR-01: `player_joined` broadcast is a side effect inside a `setState` updater and fans out to every client

> **RESOLVED** (commit `4f077d8`): broadcast moved out of the `setPlayers` updater; single-sender election (smallest id present, via `getPlayerId(code)`) added.

**File:** `app/room/[code]/game/page.tsx:1599-1612`
**Issue:** The realtime broadcast `voteChannelRef.current?.send(...)` was executed *inside* the `setPlayers((prev) => { ... })` updater — a pure-function violation that double-fires in React StrictMode/concurrent mode, and fans out to every connected client (K broadcasts per join).
**Fix:** (resolved — see commit)

---

## Warnings

### WR-01: Confession percentage divides by current roster, not the round snapshot

> **RESOLVED** (commit `4f077d8`): `%` now divides by `gs.vote_round_player_count || players.length` with a zero-denominator guard.

**File:** `app/room/[code]/game/page.tsx:1776`
**Issue:** `const pct = Math.round((yesVotes.length / players.length) * 100)` used the live roster instead of the frozen participant count.
**Fix:** (resolved — see commit)

---

### WR-02: Mid-round joiner can vote and overshoot a threshold that excludes them

**File:** `app/room/[code]/game/page.tsx:1690-1712`, `:1598-1612`
**Issue:** The threshold (`vote_round_player_count`) deliberately excludes mid-round joiners (D-09). But the join-during-game flow still routes the new player straight into `/room/[code]/game`, where they render the active vote phase and can call `submitVote`. Their vote inserts a row and is counted, so `count` can exceed the frozen threshold. The vote silently participates in `tallyDesignation`/confession `%` for a round they were excluded from in the count — an inconsistency between "who counts toward the threshold" and "whose votes are tallied." It can also let a designation land on a player nobody present at round start actually targeted.
**Fix:** Either (a) gate the vote UI for players not present at round start (compare against a snapshot list, not just a count), or (b) accept joiners fully and recompute the threshold. Pick one model; the current half-snapshot is internally inconsistent.

---

### WR-03: `initialSecs` timer derivation re-runs every render but cannot correct drift

**File:** `app/room/[code]/game/page.tsx:480-484, 512-516, 719-723`
**Issue:** The inline IIFE recomputes `initialSecs = max(0, 30 - elapsed)` on every render, but `VoteTimer` only consumes `initialSecs` via `useState(initialSecs)` at mount, and the element `key` is `vt-${gs.round}` (stable within a round). After the first mount all later recomputations are discarded. A tab backgrounded (interval throttled) and not remounted will keep a stale countdown. The derivation gives a false sense of self-correction. Also, identical 4-line IIFE blocks are duplicated across three screens (formerly four; one removed by 03-06).
**Fix:** Extract the derivation into a helper (`initialSecsFor(gs)`); if drift-correction is actually desired, have `VoteTimer` recompute from `round_started_at` on an interval rather than counting down from a one-time initial value.

---

### WR-04: `useRoomPresence` grace period constant is 15 s; CLAUDE.md documents 60 s

**File:** `lib/usePresence.ts:8`
**Issue:** `GRACE_MS = 15_000`. CLAUDE.md (source of truth) documents a **60 s** grace period explicitly to survive phone-lock ("après 60 s de grâce (anti phone-lock)"). 15 s is well under a typical lock-and-return interval, so legitimately-present players whose phone locked will be pruned as ghosts mid-game, shrinking the roster and (via `resolveOnShrinkRef`) potentially auto-advancing a round they were still in.
**Fix:** Restore `GRACE_MS = 60_000` (or reconcile with the documented value and update CLAUDE.md if 15 s is intentional).

---

### WR-05: Async pseudo pre-fill silently overwrites user edits (gap-closure addition)

**File:** `app/join/page.tsx:39-45`
**Issue:** The reconnect-path Supabase fetch (added/extended in plan 03-07) calls `setPseudo(data.pseudo)` unconditionally when it resolves, regardless of whether the user has started editing the field. On slow connections (weak mobile signal), this silently overwrites in-progress user input — the user types something, the fetch resolves, and their characters disappear. No error is destructured either: transient PostgREST errors are dropped with zero logging, inconsistent with the diagnostic `console.log` at line 61.

```ts
// Current — overwrites user edits, drops errors:
supabase.from('players').select('pseudo').eq('id', pid).maybeSingle()
  .then(({ data }) => {
    if (data?.pseudo) {
      setStoredPseudo(data.pseudo)
      setPseudo(data.pseudo)      // ← clobbers user input
    }
  })

// Fix — guard against user edits; log errors:
supabase.from('players').select('pseudo').eq('id', pid).maybeSingle()
  .then(({ data, error }) => {
    if (error) console.warn('[join] pseudo prefetch:', error.message)
    if (data?.pseudo) {
      setStoredPseudo(data.pseudo)
      // Only pre-fill if the user hasn't started typing yet.
      setPseudo((current) => current ? current : data.pseudo)
    }
  })
```

---

### WR-06: Stored-pseudo prefetch error channel is silently dropped (gap-closure addition)

**File:** `app/join/page.tsx:39-45`
**Issue:** (Overlaps WR-05 but distinct.) The `.then(({ data }) => ...)` on the pseudo prefetch destructures only `data`, discarding the `error` field entirely. A transient PostgREST error (DB timeout, rate limit, RLS policy) is swallowed silently. This is inconsistent with the diagnostic `console.log('[join] lookup:', ...)` that this same file uses for the room lookup. No user-facing feedback is needed for a pre-fill failure, but the absence of even a `console.warn` makes diagnosing reconnect failures harder.
**Fix:** Destructure and log the error: `.then(({ data, error }) => { if (error) console.warn('[join] pseudo prefetch:', error.message); ... })`.

---

### WR-07: Heartbeat safety margin is razor-thin at the new 60 s sweep threshold (gap-closure addition)

**File:** `supabase/lifecycle.sql:59`, `lib/usePresence.ts:11`
**Issue:** `cleanup_dead_rooms()` now deletes rooms where `last_activity < now() - interval '60 seconds'`. The heartbeat fires every `HEARTBEAT_MS = 30_000 ms` with the update silently swallowed on failure (`try { await supabase.from('rooms').update(...) } catch { /* ignore */ }`). Two consecutive heartbeat failures over any 30 s window (network blip, Supabase rate-limit, Railway cold start) would leave `last_activity` > 60 s old — and the next pg_cron sweep (which runs every 60 s) would delete an active session mid-game.

The previous threshold of 30 minutes provided a 1,800× safety margin over the heartbeat interval. The new 60 s threshold provides only a 2× margin. Game state updates (via `updateRoomGameState`) also trigger `trg_rooms_bump_activity`, which provides additional protection during active play, but idle phases (e.g. a host staring at an `ended` screen for > 60 s without interacting) have no such bump.

```
Worst-case: last_activity = T
  T+30s: heartbeat fires, network error, silently dropped
  T+60s: heartbeat fires again, network error, silently dropped
  T+60s: pg_cron sweep runs → last_activity (= T) < now() - 60s = T → NOT deleted (strict <)
  T+61s: next sweep run → last_activity (= T) < now() - 60s = T+1s → DELETED
```

**Fix (preferred):** Increase threshold to `interval '90 seconds'` or `interval '2 minutes'` to give at least two heartbeat cycles of buffer before a sweep can hit a live room. Alternatively, add a `REVOKE EXECUTE ON FUNCTION cleanup_dead_rooms() FROM anon` and rely solely on pg_cron (already scheduled), removing the surface where anon calls could contribute to premature deletion.

```sql
-- Safer threshold giving 3× heartbeat buffer:
WHERE COALESCE(last_activity, created_at) < now() - interval '90 seconds'
```

---

## Info

### IN-01: Dead B1 code paths now unreachable

**File:** `lib/game.ts:126-130`, `lib/types.ts:29` (`BSubtype 'B1'`), `lib/types.ts:33-34` (`rounds_b1`)
**Issue:** Confession is always `'B2'` now, so `accumulateStats`'s `if (gs.b_subtype === 'B1')` branch, `rounds_b1`, and the `'B1'` member of `BSubtype` are dead. Harmless but misleading for future readers. `title_transparent`/`title_daring` group titles depending on B1 can also never trigger.
**Fix:** Remove the B1 branch and `rounds_b1`, or add a comment marking them retained-for-historical-stats.

---

### IN-02: `tallyQuestionSelection` fallback to `candidates[0]` masks stale-vote regression

**File:** `lib/game.ts:244-258`, consumed at `app/room/[code]/game/page.tsx:1747`
**Issue:** If `winnerIndex` exceeds `candidates.length` (stale vote row referencing an index from a prior round after a replay), `candidates[winnerIndex]` is `undefined` and falls back to `candidates[0]`. The fallback masks the underlying data inconsistency silently.
**Fix:** Log when the fallback triggers so a stale-vote regression is observable.

---

### IN-03: `players_hint` i18n change is purely cosmetic — confirm intent

**File:** `lib/i18n.ts:22, 259, 494, 729`
**Issue:** "3 à 10 joueurs" → "Conseillé entre 3 et 10 joueurs" in all 4 locales. No code reads a numeric bound from this string, so it is display-only. Confirming no other UI (e.g. a min/max player gate) was meant to change alongside it — the start button still hardcodes `players.length < 2` (lobby/page.tsx:315).
**Fix:** None required if copy-only.

---

### IN-04: Duplicated quit/host-transfer logic across lobby and game

**File:** `app/room/[code]/lobby/page.tsx:124-142` vs `app/room/[code]/game/page.tsx:1867-1888`
**Issue:** `onQuit` (delete self, promote earliest remaining by `created_at`, delete room if empty) is implemented near-identically in both files. Divergence risk if one is patched and not the other.
**Fix:** Extract a shared `leaveRoom(roomId, myId, wasHost)` helper in `lib/`.

---

### IN-05: Lazy stamp fires for `round_c_choice` which no longer has a timer (gap-closure addition)

**File:** `app/room/[code]/game/page.tsx:1683`
**Issue:** The `timerPhases` array used by the SC-5 lazy-stamp effect includes `'round_c_choice'`:

```ts
const timerPhases = ['voting_question', 'round_a_vote', 'round_b_vote', 'round_c_choice']
```

Plan 03-06 (5b) simultaneously removed `VoteTimer` from `ChoiceScreen`. The stamped `round_started_at` value for `round_c_choice` is now written into `game_state` but never consumed by any timer. This creates one unnecessary `updateRoomGameState` write per session on the choice phase and leaves stale `round_started_at` values in the JSONB column that could confuse future readers into thinking the choice phase has/had a timer.

**Fix:** Remove `'round_c_choice'` from `timerPhases`:

```ts
const timerPhases = ['voting_question', 'round_a_vote', 'round_b_vote']
```

---

### IN-06: DesignationVoteScreen and ConfessionVoteScreen HostSkipBtn gates use live `players.length` inconsistently with the frozen denominator used everywhere else (gap-closure addition, pre-existing contrast)

**File:** `app/room/[code]/game/page.tsx:518, 723`
**Issue:** After plan 03-06 fixed `ChoiceScreen` to use `gs.vote_round_player_count || players.length` for HostSkipBtn, the other two vote screens (`DesignationVoteScreen` at line 518 and `ConfessionVoteScreen` at line 723) still compare `voteCount < players.length` (live). This is now an obvious inconsistency: if a mid-round joiner arrives during a Type A or Type B vote, the HostSkipBtn disappears (or stays visible incorrectly) relative to the frozen threshold used by `resolveVotes`. The pre-existing nature of this inconsistency was obscured before 03-06; after the fix it stands out by contrast.
**Fix:** Apply the same frozen-count pattern to both screens:
```ts
// DesignationVoteScreen footer (line 518):
<HostSkipBtn show={isHost && hasVoted && voteCount < (gs.vote_round_player_count || players.length)} onForce={onForce} />
// ConfessionVoteScreen footer (line 723):
<HostSkipBtn show={isHost && hasVoted && voteCount < (gs.vote_round_player_count || players.length)} onForce={onForce} />
```

---

_Reviewed: 2026-06-10 (original) / 2026-06-11 (gap-closure addendum 03-06/07/08)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
