<!-- refreshed: 2026-06-07 -->
# Architecture

**Analysis Date:** 2026-06-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Next.js App Router (Client)                │
├──────────────────┬──────────────────┬───────────────────────┤
│  Landing         │  Lobby           │  Game Page             │
│  `app/page.tsx`  │  `app/room/      │  `app/room/[code]/    │
│                  │  [code]/lobby/   │  game/page.tsx`        │
│                  │  page.tsx`       │  (~1800 lines)         │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     lib/ — Pure Modules                      │
│  `lib/game.ts` (engine) · `lib/types.ts` · `lib/i18n.ts`   │
│  `lib/locale.tsx` · `lib/usePresence.ts` · `lib/utils.ts`  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               Supabase (Postgres + Realtime)                 │
│  tables: rooms · players · votes · questions                 │
│  channels: lobby-{code} · game-{code} · votes-broadcast-{id}│
│            presence-{roomId}                                 │
└─────────────────────────────────────────────────────────────┘
```

## Architectural Patterns

**Client-only React.** Every page is marked `'use client'` — there are no React Server Components in use. The App Router is used purely for file-system routing; no server actions, no server components, no SSR data fetching.

**All state lives in Supabase.** The canonical game state (`GameState` jsonb) is persisted in `rooms.game_state`. React `useState` is a local mirror, not the source of truth. After any transition, the writer calls `updateRoomGameState` (writes to Supabase) then broadcasts `phase_changed` so every other client re-fetches.

**Pure engine in `lib/game.ts`.** All game logic (picking questions, tallying votes, accumulating stats, computing the group title) lives in pure/async functions with no React coupling. The game page imports and calls them imperatively.

## Data Flow

### Game state propagation

1. Player action (vote, choice) in `app/room/[code]/game/page.tsx`
2. Row inserted into `votes` table via `supabase.from('votes').insert(…)`
3. Vote count fetched → broadcast `vote_count` event on `votes-broadcast-{roomId}` → all clients update their `voteCount` display
4. When `count >= players.length`, the acting client calls `resolveVotes` / `resolveTypeCChoice`
5. Resolution calls `updateRoomGameState` → writes new `GameState` jsonb to `rooms` row
6. Broadcast `phase_changed` event sent on `votes-broadcast-{roomId}`
7. Every client receives broadcast → calls `refetchRoom()` → SELECT the updated room row
8. `applyRoom()` diffs the phase: if changed, resets `hasVoted` and `voteCount`

### Room state updates (secondary path)

Supabase `postgres_changes` on `rooms UPDATE` (channel `game-{code}`) also triggers `applyRoom`. This is a secondary/redundant path — the broadcast `phase_changed` is the primary convergence mechanism because it is reliable even when the `postgres_changes` payload is stale or delayed.

### Player roster

`postgres_changes` on `players INSERT/DELETE/UPDATE` (channel `game-{code}`) keeps the `players` array live. The roster size is used as the vote threshold (`count >= players.length`).

## State Management

**`GameState` (jsonb in `rooms.game_state`)** is the distributed shared state. It holds:
- `phase: GamePhase` — current state machine node
- `round: number` — 1-based, max `MAX_ROUNDS = 7` (hardcoded constant in `game/page.tsx`)
- `candidates: Question[]` — 3 questions presented for vote
- `current_question: Question | null` — chosen question
- `designated_player_ids`, `designation_tie_all`, `volunteer_player_ids` — round results
- `played_question_ids` — deduplication across rounds
- `stats: SessionStats` — accumulated per-type and per-player counters
- `paused: boolean`

**Local React state** in `game/page.tsx`:
- `room: Room | null` — mirror of DB row (including `game_state`)
- `players: Player[]` — live roster
- `hasVoted: boolean` — per-phase, reset by `applyRoom` on phase change
- `voteCount: number` — live count from broadcast

**Refs** are used to avoid stale closures:
- `roomRef` — always current room for `onPause`/`onResume` (must NOT use React state there)
- `playersRef` — always current players for threshold checks after shrink
- `voteChannelRef` — broadcast channel handle for `advance()`

## Real-time Architecture

### Channels

| Channel | Type | Used in | Purpose |
|---------|------|---------|---------|
| `lobby-{code}` | postgres_changes | `lobby/page.tsx` | Player joins/leaves, room status → navigate to game |
| `game-{code}` | postgres_changes | `game/page.tsx` | Room updates, player roster changes |
| `votes-broadcast-{roomId}` | broadcast (self: true) | `game/page.tsx` | `vote_count` and `phase_changed` events |
| `presence-{roomId}` | presence | `lib/usePresence.ts` | Ghost detection, heartbeat |

### Convergence mechanism

After any game state write, the writer broadcasts `phase_changed`. All clients (including the writer, because `self: true`) receive this and call `refetchRoom()` — a direct SELECT. This ensures convergence even if `postgres_changes` delivers a stale or partial payload.

### Presence and ghost pruning (`lib/usePresence.ts`)

- Each client tracks with `channel.track({ online_at })` on `presence-{roomId}`
- On `leave` event: a 60-second grace timer starts before pruning the player row
- The **elected cleaner** (client with the smallest `player.id` in `presenceState`) is the only one that actually calls `supabase.from('players').delete()` — prevents races
- **Heartbeat** every 2 minutes: elected cleaner updates `rooms.last_activity`

### Vote timer and elected advancer

`VoteTimer` (30 s countdown, keyed by `gs.round`) is always mounted during vote phases. The elected advancer (`players.sort()[0]` by id) fires `onExpire` → `onForce` when the timer hits zero. This prevents multiple clients racing to advance the phase.

## Key Design Decisions

**No server-side logic.** All game resolution runs on the client. The first client to reach the vote threshold resolves. Race conditions are mitigated by the `UNIQUE(room_id, round, player_id, vote_type)` constraint on `votes` and by the elected-advancer pattern.

**`roomRef` for pause/resume.** `onPause`/`onResume` read `roomRef.current.game_state` (not React state) to avoid stale closure bugs. This is a documented invariant — do not refactor to use state.

**Broadcast as primary, postgres_changes as secondary.** `phase_changed` broadcast + `refetchRoom()` is the reliable convergence path. `postgres_changes` on rooms is a belt-and-suspenders addition, not the primary mechanism.

**`MAX_ROUNDS = 7` hardcoded.** Defined at the top of `game/page.tsx`. Planned to become a `rooms.max_rounds` column for premium configuration, but not yet implemented.

**Player identity persisted per room in localStorage.** Key `kluup_pid_{CODE}` stores the player id. Survives browser close → reconnect reuses the existing row. Never use the old `sessionStorage.getItem('player_id')` global (causes duplicates).

**`host_id NOT NULL` on the existing production DB.** `rooms.insert()` must always include `host_id: genId()`. The `schema.sql` declares it nullable for new bases, but the prod table was created before that change.

## Error Handling

**Vote insert errors** are caught in `submitVote`/`submitChoice` — sets `hasVoted(false)` to allow retry.

**Room not found** on init redirects to `/` (game page) or `/join?code=XXX` (lobby page).

**No global error boundary.** Errors in async handlers are logged to console and silently recovered where possible (e.g. presence prune failures are swallowed).

## Anti-Patterns

### `html2canvas` for share card

**What happens:** old code used `html2canvas` to capture the share card.
**Why it's wrong:** mis-measured custom fonts (Bricolage Grotesque), overlapped letters on the PNG.
**Do this instead:** use `modern-screenshot` (`domToBlob`) as in `EndScreen` — renders via SVG foreignObject, correct glyph metrics. File: `app/room/[code]/game/page.tsx` around `exportCard()`.

### `sessionStorage.getItem('player_id')` global

**What happens:** reading the global session storage key for player id.
**Why it's wrong:** cleared on browser close, causes a new `players` row to be inserted on reconnect — duplicates in roster, broken vote threshold.
**Do this instead:** always use `getPlayerId(code)` / `setPlayerId(code, id)` from `lib/utils.ts`.

---

*Architecture analysis: 2026-06-07*
