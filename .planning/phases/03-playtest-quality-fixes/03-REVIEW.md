---
phase: 03-playtest-quality-fixes
reviewed: 2026-06-11T10:00:00Z
depth: standard
files_reviewed: 11
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
  critical: 5
  warning: 5
  info: 3
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-11T10:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 03 covers timer reliability (`round_started_at`, `vote_round_player_count`), pseudo-uniqueness enforcement, reduced presence grace period, and various game-flow quality fixes from playtest. The overall architecture is sound; real-time convergence via `phase_changed` broadcast + refetch is a solid pattern. However, five critical defects were found:

1. The vote-resolution path is not guarded by the elected-advancer pattern, meaning every client that sees `count >= threshold` races to call `resolveVotes` simultaneously — with each client using `Math.random()` independently for confession and Type C roulette, producing inconsistent winners across clients before the broadcast settles.
2. `tallyDesignation` in the Type A resolution path receives `players.length` (live roster) instead of `vote_round_player_count` (frozen snapshot), making `tieAll` incorrect when a ghost is pruned mid-vote.
3. `ChoiceScreen` (Type C vote) has no `VoteTimer` component — the 30-second auto-skip never fires on `round_c_choice`, leaving the game permanently blocked if a player goes AFK.
4. The `shuffle` function uses a biased sort comparator, producing non-uniform question ordering.
5. The `cleanup_dead_rooms` TTL (60 s) is only 2× the presence heartbeat (30 s), providing no safety margin — a single delayed heartbeat can delete an active room.

---

## Critical Issues

### CR-01: Vote resolution is not advancer-gated — every client races with independent `Math.random()` winner selection

**File:** `app/room/[code]/game/page.tsx:1738,1813`

**Issue:** `submitVote` calls `resolveVotes` (line 1738) when `count >= threshold`. Every client that submits a vote can independently observe the threshold being met and call `resolveVotes`. The elected-advancer pattern only applies to the timer-expiry path (`VoteTimer` → `onExpire`); it is not applied to the threshold-triggered path.

This is a correctness failure specifically for confession (Type B) and Type C roulette, where `resolveVotes` and `resolveTypeCChoice` call `Math.random()` to pick a winner:

```typescript
// game/page.tsx:1781
const winner = yesIds.length > 0 && pct < 100
  ? yesIds[Math.floor(Math.random() * yesIds.length)]  // each client picks independently
  : null

// game/page.tsx:1830
const winner = topIds.length > 0
  ? topIds[Math.floor(Math.random() * topIds.length)]  // same race
  : null
```

If two clients both see `count === threshold` (e.g., the last voter and the advancer who received a broadcast), they each call `advance()` with a potentially different `winner`. Supabase last-write-wins, so one overwrites the other. More critically, the two clients will show different roulette targets briefly until `phase_changed` triggers a refetch — and if a client resolves after the phase has already changed, it can write a stale `game_state` back.

**Fix:** Gate all `resolveVotes` and `resolveTypeCChoice` calls to the advancer only. The advancer already handles timer expiry; extend the same guard to the count-threshold path:

```typescript
// In submitVote:
const threshold = gs!.vote_round_player_count || players.length
if (count >= threshold && isAdvancer) await resolveVotes(voteType)

// In submitChoice:
const threshold = gs!.vote_round_player_count || players.length
if (count >= threshold && isAdvancer) await resolveTypeCChoice()
```

To ensure the advancer resolves even when the last voter is NOT the advancer, the advancer must listen to `vote_count` broadcast events and trigger resolution when `count >= threshold`:

```typescript
.on('broadcast', { event: 'vote_count' }, ({ payload }) => {
  const gs = roomRef.current?.game_state
  if (!gs) return
  if (payload.round === gs.round) {
    setVoteCount(payload.count as number)
    const threshold = gs.vote_round_player_count || playersRef.current.length
    if (isAdvancerRef.current && payload.count >= threshold) {
      // resolve the current phase
    }
  }
})
```

---

### CR-02: `tallyDesignation` receives live `players.length` instead of frozen `vote_round_player_count` — `tieAll` miscalculated after ghost prune

**File:** `app/room/[code]/game/page.tsx:1758`

**Issue:**
```typescript
const { topIds, tieAll } = tallyDesignation(votes, players.length)
```

`players.length` is the live roster at resolution time. If a ghost was pruned between vote start and resolution (the presence grace period is now only 15 s per CLAUDE.md), `players.length` < original count. `tallyDesignation` uses `playerCount` for the `tieAll` condition:

```typescript
// lib/game.ts:240
const tieAll = playerCount > 1 && topIds.length >= playerCount
```

Example: 5 players start voting, 1 ghost is pruned to give 4 live players. Votes were: A=2, B=2, C=1. With `playerCount=4`, `topIds=[A,B]`, `topIds.length (2) < playerCount (4)`, so `tieAll=false` — correct. But if another ghost is pruned to 2 live players, `topIds.length (2) >= playerCount (2)`, so `tieAll=true` — incorrectly triggers the "Décevant" screen.

`vote_round_player_count` was introduced precisely for this purpose and is already used for the confession denominator (line 1776) and threshold (line 1737), but was omitted here.

**Fix:**
```typescript
const frozenCount = gs.vote_round_player_count || players.length
const { topIds, tieAll } = tallyDesignation(votes, frozenCount)
```

---

### CR-03: `ChoiceScreen` (Type C) has no `VoteTimer` — 30-second auto-skip never fires on `round_c_choice`

**File:** `app/room/[code]/game/page.tsx:891-954`

**Issue:** `ChoiceScreen` renders `VoteProgress` and `HostSkipBtn` but no `VoteTimer`. Every other vote screen mounts `VoteTimer` with `isAdvancer` and `onExpire`:

- `QuestionSelectionScreen` (line 484)
- `DesignationVoteScreen` (line 516)
- `ConfessionVoteScreen` (line 721)

On `round_c_choice`, if a player goes AFK and does not act, the game is permanently blocked. The only escape hatch is the host's manual "Passer sans attendre" button, which requires the host to be watching. This directly violates the phase 03 design requirement that timer-based force-advance works on all vote phases.

`ChoiceScreen` also does not accept an `isAdvancer` prop — the timer cannot be added without a signature change.

**Fix:** Add `isAdvancer` to `ChoiceScreen` props and mount `VoteTimer` in the footer:

```typescript
// Props update:
function ChoiceScreen({
  gs, players, myId, isHost, isAdvancer, hasVoted, voteCount,
  onVolunteer, onDesignate, onForce,
}: {
  // ...
  isAdvancer: boolean
  // ...
})

// Footer update (after HostSkipBtn):
{(() => {
  const elapsed = gs.round_started_at
    ? Math.floor((Date.now() - new Date(gs.round_started_at).getTime()) / 1000)
    : 0
  const initialSecs = Math.max(0, 30 - elapsed)
  return (
    <VoteTimer
      key={`vt-${gs.round}`}
      isAdvancer={isAdvancer}
      onExpire={onForce}
      initialSecs={initialSecs}
    />
  )
})()}
```

Pass `isAdvancer` at the call site (line 1959):
```typescript
<ChoiceScreen ... isAdvancer={isAdvancer} ... />
```

---

### CR-04: `shuffle()` uses a biased sort comparator — non-uniform permutation distribution

**File:** `lib/game.ts:7-9`

**Issue:**
```typescript
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}
```

Using `Array.prototype.sort` with a random comparator does not produce a uniformly random permutation. V8's sort implementation (TimSort) does not call the comparator for every pair; it caches intermediate results. This causes certain permutations to be statistically impossible and others to be over-represented. For a 3-element array (the `pickCandidates` result), the first element of the input array appears first in the output roughly 50% more often than a uniform distribution would produce. This means questions already at the top of the database result set are consistently over-represented as the first candidate shown to players.

**Fix:** Replace with Fisher-Yates (Knuth shuffle):
```typescript
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

---

### CR-05: `cleanup_dead_rooms` TTL (60 s) is only 2× the presence heartbeat (30 s) — one delayed heartbeat deletes an active room

**File:** `supabase/lifecycle.sql:57-59`

**Issue:**
```sql
WHERE COALESCE(last_activity, created_at) < now() - interval '60 seconds'
```

`lib/usePresence.ts` sets `HEARTBEAT_MS = 30_000`. The pg_cron sweep runs every minute. The actual safety margin is:

```
TTL (60 s) - heartbeat_interval (30 s) = 30 s
```

Any single heartbeat that is delayed more than 30 seconds — due to network jitter, phone CPU throttling, a slow Railway cold start, or a congested Supabase connection — will cause the room's `last_activity` to fall below the 60 s threshold *while players are actively connected*, resulting in mid-game room deletion with no warning to any client.

CLAUDE.md notes this was changed from 30 min to 60 s. The rationale for SC-3 is valid but the margin is unsafe.

**Fix:** Either increase TTL to at least 3× the heartbeat:
```sql
WHERE COALESCE(last_activity, created_at) < now() - interval '90 seconds'
```
Or decrease the heartbeat to 15 s to triple the margin. Keep the comment in both files in sync.

---

## Warnings

### WR-01: `resolveTypeCChoice` uses live `players.length` for `tallyDesignation` — same frozen-count gap as CR-02

**File:** `app/room/[code]/game/page.tsx:1829`

**Issue:**
```typescript
const { topIds } = tallyDesignation(desigs, players.length)
```

The `tieAll` return value is discarded here (only `topIds` is destructured), so the immediate bug is less severe than CR-02 — a spurious `tieAll=true` doesn't cause a "Décevant" screen because the Type C roulette never uses it. However, the `topIds` computation itself depends on the `max` vote count, not `playerCount`; `playerCount` is only used for `tieAll`. So in practice the winner selection is unaffected by the stale count. The issue should still be fixed for consistency, correctness of the `tallyDesignation` contract, and future safety if `tieAll` is ever used in Type C.

**Fix:**
```typescript
const frozenCount = gs.vote_round_player_count || players.length
const { topIds } = tallyDesignation(desigs, frozenCount)
```

---

### WR-02: `lobby/page.tsx:startGame` calls `crypto.randomUUID()` directly — throws on HTTP/LAN (non-secure context)

**File:** `app/room/[code]/lobby/page.tsx:164`

**Issue:**
```typescript
gs.session_uuid = crypto.randomUUID()
```

CLAUDE.md explicitly documents: "Several Web APIs only work in a 'secure context' (HTTPS or localhost) and throw over plain HTTP — which is exactly how the app is served when testing on a phone via the dev machine's LAN IP." `lib/utils.ts` provides `genId()` as the safe fallback wrapper that catches the error and degrades to a timestamp-based ID. The lobby bypasses it and calls `crypto.randomUUID()` directly, which will throw `TypeError: crypto.randomUUID is not a function` on HTTP, breaking game start during LAN testing.

**Fix:**
```typescript
import { genId } from '@/lib/utils'
// ...
gs.session_uuid = genId()
```

---

### WR-03: Visitor arriving at `/room/[code]/game` without a player ID gets stuck on `LoadingScreen` forever — no redirect

**File:** `app/room/[code]/game/page.tsx:1695`

**Issue:**
```typescript
if (!room || !myId) return <LoadingScreen />
```

If a user arrives at the game URL without a stored player ID (e.g., typed directly, or after clearing storage), `myId` is `null` (line 1493: `setMyId(getPlayerId(code))`). The `init()` async function fetches the room and sets `room`, but `myId` stays `null`. The component renders `LoadingScreen` indefinitely — there is no redirect to `/join?code=${code}`.

The lobby page handles this correctly (line 65: `if (!id || !data.find((p) => p.id === id)) { router.replace(...) }`), but the game page does not.

**Fix:** After `init()` completes and `room` is set but `myId` is still null, redirect to join:
```typescript
// After init() in the setup() function, or in a useEffect watching [room, myId]:
useEffect(() => {
  if (room && !myId) {
    router.replace(`/join?code=${code}`)
  }
}, [room, myId, code, router])
```

---

### WR-04: `B2RouletteScreen` `nobody` check is derived from `revealed_player_ids.length`, but `revealed_player_ids` has dual semantics — will show wrong state if `yes_percentage` and array are inconsistent

**File:** `app/room/[code]/game/page.tsx:742-745`

**Issue:**
```typescript
const yesCount = gs.revealed_player_ids?.length ?? 0
const nobody = yesCount === 0
const allYes = pct === 100 && yesCount > 0
```

`revealed_player_ids` is used in two semantically distinct ways:
- In B1 (removed but still referenced in `accumulateStats`): all "yes" players
- In B2 (current): only the roulette winner's id

In `resolveVotes('confession')`, line 1785: `revealed_player_ids: yesIds` — here it holds ALL yes players. But this array is not cleared in the initial `...gs` spread when `onNextRound` builds the next round state (it is explicitly reset on line 1872: `revealed_player_ids: []`). This is fine on the happy path, but there is a subtler problem: the `nobody` condition (`yesCount === 0`) means "zero yes votes" — but `revealed_player_ids` now stores all yes-voters at the point of resolution. If 0 players said yes, `yesIds = []`, `revealed_player_ids = []`, `nobody = true`. That is correct. However the canonical source of truth for this screen should be `gs.yes_percentage === 0` (which is set from `pct` at the same resolution point), not the array length — using `pct` is more explicit and eliminates the dual-semantics confusion.

**Fix:** Use `pct` as the single source of truth:
```typescript
const nobody = pct === 0
const allYes = pct === 100
```

---

### WR-05: `onQuit` / host-transfer pattern has a time-of-check-to-time-of-use gap — room can be left with no host

**File:** `app/room/[code]/game/page.tsx:1897-1917`, `app/room/[code]/lobby/page.tsx:124-141`

**Issue:** Both `onQuit` implementations follow this pattern:

```typescript
await supabase.from('players').delete().eq('id', myId)         // 1. delete self
const { data: rest } = await supabase.from('players').select() // 2. re-read roster
if (remaining.length === 0) { /* delete room */ }
else if (wasHost) { /* transfer host to first remaining */ }
```

Between steps 1 and 2, another quitting player can delete themselves and read an empty roster, then both players see `remaining.length === 0` and both try to delete the room (harmless), OR one sees themselves as the first remaining player and tries to become host only to have their row deleted moments later — leaving the room with `is_host=false` for everyone. This is a TOCTOU race that can leave the room without a host if two players quit simultaneously.

**Fix:** This should be a `SECURITY DEFINER` RPC that atomically handles quit + host transfer. As a minimal fix, check that the intended next host still exists after the update:
```typescript
const updated = await supabase.from('players')
  .update({ is_host: true })
  .eq('id', next.id)
  .select()
  .single()
if (!updated.data) { /* next host was deleted before update; re-read and retry */ }
```

---

## Info

### IN-01: `console.log` left in production join path

**File:** `app/join/page.tsx:60`

**Issue:**
```typescript
console.log('[join] lookup:', { code: normalizedCode, found: !!room, error: roomError?.message })
```
This diagnostic log fires on every successful join in production, exposing room codes and PostgREST error messages in browser devtools. CLAUDE.md documents this as intentional for RLS debugging, but it should be conditionally disabled in production.

**Fix:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  console.log('[join] lookup:', { code: normalizedCode, found: !!room, error: roomError?.message })
}
```

---

### IN-02: `momentStat` uses `stats.rounds_b1` for `title_transparent` / `title_daring` — always 0 since B1 was removed

**File:** `app/room/[code]/game/page.tsx:1129`

**Issue:**
```typescript
case 'title_transparent':
case 'title_daring':
  return t.card.stat.confessions_open(s.rounds_b1)
```

`rounds_b1` is always 0 now that B1 sub-mode was removed (confession is always roulette / B2). The share card for these titles will always show "0 confessions révélées". Note that `computeGroupTitle` cannot currently return `title_transparent` or `title_daring` either (those conditions required B1 dominance), so this is currently dead code — but it will silently produce wrong stats if the title logic is ever extended.

**Fix:** Use `rounds_b` (total confession rounds):
```typescript
case 'title_transparent':
case 'title_daring':
  return t.card.stat.confessions_open(s.rounds_b)
```

---

### IN-03: `BSubtype` exports `'B1'` as a live union member and `accumulateStats` has a dead B1 branch — dead code misleads future contributors

**File:** `lib/types.ts:29`, `lib/game.ts:126-130`

**Issue:**
```typescript
// lib/types.ts:29
export type BSubtype = 'B1' | 'B2'

// lib/game.ts:126-130
if (gs.b_subtype === 'B1') {
  s.rounds_b1++
  gs.revealed_player_ids.forEach((id) => inc(s.confessed!, id))
}
```

`b_subtype` is now always set to `'B2'` (line 1784 of game page). The `'B1'` branch in `accumulateStats` will never execute; `rounds_b1` will always be 0. This is the root cause of IN-02. A future contributor reading this code will assume B1 is still a valid sub-mode.

**Fix:** Remove `'B1'` from `BSubtype`, remove the dead branch in `accumulateStats`, and remove the `rounds_b1` field from `SessionStats` (or retain it as `0` with a comment for historical DB rows). If DB rows from before this change could still be loaded and have `b_subtype === 'B1'`, add a comment explaining the field is vestigial.

---

_Reviewed: 2026-06-11T10:00:00Z_
_Reviewer: Claude Sonnet 4.6 (gsd-code-reviewer)_
_Depth: standard_
