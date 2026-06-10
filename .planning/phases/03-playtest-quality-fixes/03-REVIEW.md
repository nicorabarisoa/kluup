---
phase: 03-playtest-quality-fixes
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/join/page.tsx
  - app/room/[code]/game/page.tsx
  - app/room/[code]/lobby/page.tsx
  - lib/game.ts
  - lib/i18n.ts
  - lib/types.ts
  - lib/usePresence.ts
  - supabase/migrations/003-pseudo-unique.sql
  - supabase/schema.sql
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
resolved:
  - CR-01 (fixed in 4f077d8)
  - WR-01 (fixed in 4f077d8)
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase added: per-room case-insensitive pseudo uniqueness, a "player joined" toast during games, timer resynchronisation after refresh (`round_started_at` + derived `initialSecs`), and a frozen player-count snapshot (`vote_round_player_count`) so mid-round joiners no longer break the vote threshold. The diff scope was reviewed against the surrounding code that consumes the new fields.

The headline defect is a realtime broadcast emitted as a side effect *inside* a `setState` updater function: it both violates React's purity contract (double-fires in dev/StrictMode) and fans out to N senders because every connected client runs the INSERT handler. Several correctness gaps around the new snapshot field and the mid-round-joiner flow also surfaced. None block the core loop for a stable roster, but the join-during-game path (the exact scenario this phase targets) has rough edges.

## Critical Issues

### CR-01: `player_joined` broadcast is a side effect inside a `setState` updater and fans out to every client

> ✅ **RESOLVED** (commit `4f077d8`): broadcast moved out of the `setPlayers` updater; single-sender election (smallest id present, via `getPlayerId(code)`) added.

**File:** `app/room/[code]/game/page.tsx:1599-1612`
**Issue:** The realtime broadcast `voteChannelRef.current?.send(...)` is executed *inside* the `setPlayers((prev) => { ... })` updater. Two distinct problems:

1. **Impure reducer / double-fire.** State updater functions must be pure. React invokes them twice in development StrictMode (and may re-invoke them during concurrent rendering), so the broadcast is sent twice per join in dev and is fragile under React 19 concurrent features.
2. **N-way fan-out.** The `postgres_changes` INSERT handler runs on *every* connected client. Each client that doesn't already have the row appends it and then sends its own `player_joined` broadcast. With K players already in the room, a single join produces up to K duplicate broadcasts on the channel. The 2.5 s debounce timer (`toastTimerRef`) masks the visual duplication, but it is K redundant network messages per join and the toast text can flicker/reset.

**Fix:** Move the broadcast out of the updater into an effect or a dedicated branch keyed off the new id, and elect a single sender (e.g. only the advancer / smallest-id client broadcasts), mirroring the existing "single deterministic actor" pattern used for pruning and `onForce`:

```ts
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, (payload) => {
  if (payload.new.room_id !== roomRef.current?.id) return
  const joined = payload.new as Player
  setPlayers((prev) => {
    if (prev.find((p) => p.id === joined.id)) return prev
    const next = [...prev, joined]
    playersRef.current = next
    return next
  })
  // Side effect OUTSIDE the updater; elect one sender to avoid K-way fan-out.
  const gsNow = roomRef.current?.game_state
  const amSender = playersRef.current.length
    ? [...playersRef.current].map((p) => p.id).sort()[0] === myId
    : false
  if (amSender && gsNow && gsNow.phase !== 'ended') {
    voteChannelRef.current?.send({
      type: 'broadcast', event: 'player_joined', payload: { pseudo: joined.pseudo },
    })
  }
})
```

## Warnings

### WR-01: Confession percentage divides by current roster, not the round snapshot

> ✅ **RESOLVED** (commit `4f077d8`): `%` now divides by `gs.vote_round_player_count || players.length` with a zero-denominator guard.

**File:** `app/room/[code]/game/page.tsx:1747`
**Issue:** `const pct = Math.round((yesVotes.length / players.length) * 100)`. This phase introduced `vote_round_player_count` precisely so the round's participant set is frozen, and the resolve threshold (line 1782/1711/1900) now uses that snapshot. But the confession `%` still divides by the live `players.length`. If a player joins mid-confession (excluded from the threshold but counted in `players.length`) or a ghost is pruned between vote and resolve, the denominator no longer matches the population that actually voted — producing a wrong "X % se sont reconnus" figure, and potentially a `pct` that can never reach the 100 % sheep case.
**Fix:** Use the same denominator as the threshold for consistency:
```ts
const denom = gs.vote_round_player_count || players.length
const pct = denom > 0 ? Math.round((yesVotes.length / denom) * 100) : 0
```

### WR-02: Mid-round joiner can vote and overshoot a threshold that excludes them

**File:** `app/room/[code]/game/page.tsx:1690-1712`, `:1598-1612`
**Issue:** The threshold (`vote_round_player_count`) deliberately excludes mid-round joiners (D-09). But the join-during-game flow still routes the new player straight into `/room/[code]/game` (see `join/page.tsx:97` and `lobby/page.tsx:49-53`), where they render the active vote phase and can call `submitVote`. Their vote inserts a row and is counted, so `count` can exceed the frozen threshold. `count >= threshold` is still satisfied (harmless for advancing), but their vote silently participates in `tallyDesignation`/confession `%` for a round they were excluded from in the count — an inconsistency between "who counts toward the threshold" and "whose votes are tallied." It can also let a designation land on a player nobody who was present at round start actually targeted.
**Fix:** Either (a) gate the vote UI for players not present at round start (e.g. compare against a snapshot list, not just a count), or (b) accept joiners fully and recompute the threshold. Pick one model; the current half-snapshot is internally inconsistent.

### WR-03: `initialSecs` timer derivation re-runs every render but cannot correct drift

**File:** `app/room/[code]/game/page.tsx:480-484, 512-516, 717-721, 907-911`
**Issue:** The inline IIFE recomputes `initialSecs = max(0, 30 - elapsed)` on every render, but `VoteTimer` only consumes `initialSecs` via `useState(initialSecs)` at mount, and the element `key` is `vt-${gs.round}` (stable within a round). So after the first mount, all later recomputations are discarded. This is fine for the intended "resync on refresh" case, but it means a tab that was backgrounded (interval throttled) and *not* remounted will keep a stale countdown — the derivation gives a false sense of self-correction. Also, identical 4-line IIFE blocks are duplicated across four screens.
**Fix:** Extract the derivation into a helper (`initialSecsFor(gs)`), and if drift-correction is actually desired, have `VoteTimer` recompute from `round_started_at` on an interval rather than counting down from a one-time initial value.

### WR-04: `useRoomPresence` grace period comment/constant mismatch with documented behaviour

**File:** `lib/usePresence.ts:6-11`
**Issue:** `GRACE_MS = 15_000` and the comment says "15s grace ... covers a phone screen-lock." CLAUDE.md (source of truth) documents a **60 s** grace period explicitly to survive phone-lock ("après 60 s de grâce (anti phone-lock)"). 15 s is well under a typical lock-and-return interval, so legitimately-present players whose phone locked will be pruned as ghosts mid-game, shrinking the roster and (via `resolveOnShrinkRef`) potentially auto-advancing a round they were still in. Either the constant regressed or the doc is stale; given the anti-phone-lock rationale, 15 s is almost certainly too aggressive.
**Fix:** Restore `GRACE_MS = 60_000` (or reconcile with the documented value and update CLAUDE.md if 15 s is intentional).

### WR-05: Stored-pseudo prefetch has no error handling and ignores stale/case-collision

**File:** `app/join/page.tsx:26-32`
**Issue:** The `.then(({ data }) => ...)` on the pseudo prefetch swallows the error channel entirely (no `error` destructured, no `.catch`). If the stored `pid` points to a pruned row, `data` is null and nothing happens (fine), but a transient PostgREST error is silently ignored with no logging — inconsistent with the diagnostic logging the rest of this file adds (line 47). Minor, but it is the one async call in the new code with zero error visibility.
**Fix:** Destructure and log the error: `.then(({ data, error }) => { if (error) console.warn('[join] pseudo prefetch:', error.message); ... })`.

### WR-06: Pseudo uniqueness reconnect path can still surface "pseudo_taken" to a legitimate returning player

**File:** `app/join/page.tsx:66-89`, `supabase/migrations/003-pseudo-unique.sql`
**Issue:** On reconnect, the stored-id row is reused only if it still exists (line 67-71). If presence already pruned the old row (closed tab > grace period) but the player returns with the *same* pseudo, the `INSERT` path runs and trips the new `idx_players_pseudo_lower` unique index *only if another row holds that name*. The genuine failure case: a returning player whose ghost row hasn't yet been pruned but whose stored id was cleared (e.g. different device, `clearPlayerId` ran) gets `23505` and sees "ce pseudo est déjà pris" for what is effectively *their own* lingering ghost. Combined with WR-04's short grace window this is reachable.
**Fix:** Before insert, when `23505` occurs, attempt to detect a same-pseudo ghost in the room and offer reconnect/replace, or instruct the user the name will free up shortly — rather than a flat "taken" that blocks a returning player.

## Info

### IN-01: Dead B1 code paths now unreachable

**File:** `lib/game.ts:126-130`, `lib/types.ts:29` (`BSubtype 'B1'`), `lib/types.ts:33-34` (`rounds_b1`)
**Issue:** Confession is always `'B2'` now (line 1754), so `accumulateStats`'s `if (gs.b_subtype === 'B1')` branch, `rounds_b1`, and the `'B1'` member of `BSubtype` are dead. Harmless but misleading for future readers; `title_transparent`/`title_daring` group titles depending on B1 (lib/i18n.ts, types.ts) can also never trigger.
**Fix:** Remove the B1 branch and `rounds_b1`, or add a comment marking them retained-for-historical-stats (CLAUDE.md says `b_subtype` stays `'B2'` for continuity — apply the same explicit note to the B1 remnants).

### IN-02: `tallyQuestionSelection` JSDoc says ties broken randomly but the function is also the only consumer of `gs.candidates[winnerIndex] ?? gs.candidates[0]`

**File:** `lib/game.ts:244-258`, consumed at `app/room/[code]/game/page.tsx:1721`
**Issue:** If `winnerIndex` exceeds `candidates.length` (e.g. a stale vote row referencing an index from a prior round after a replay that didn't fully purge), `candidates[winnerIndex]` is `undefined` and falls back to `candidates[0]`. The fallback masks the underlying data inconsistency silently. Not a live bug given the replay vote-purge, but worth an assertion/log.
**Fix:** Log when the fallback triggers so a stale-vote regression is observable.

### IN-03: `players_hint` i18n change is purely cosmetic across 4 locales — confirm intent

**File:** `lib/i18n.ts:22, 259, 494, 729`
**Issue:** "3 à 10 joueurs" → "Conseillé entre 3 et 10 joueurs" in all 4 locales. No code reads a numeric bound from this string, so it is display-only. Flagging only to confirm no other UI (e.g. a min/max player gate) was meant to change alongside it — the start button still hardcodes `players.length < 2` (lobby/page.tsx:315).
**Fix:** None required if copy-only.

### IN-04: Duplicated quit/host-transfer logic across lobby and game

**File:** `app/room/[code]/lobby/page.tsx:124-142` vs `app/room/[code]/game/page.tsx:1867-1888`
**Issue:** `onQuit` (delete self, promote earliest remaining by `created_at`, delete room if empty) is implemented near-identically in both files. Not introduced by this phase, but the lobby copy was in the diff context. Divergence risk if one is patched and not the other.
**Fix:** Extract a shared `leaveRoom(roomId, myId, wasHost)` helper in `lib/`.

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
