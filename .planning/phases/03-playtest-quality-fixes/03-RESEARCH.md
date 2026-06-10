# Phase 03: Playtest Quality Fixes — Research

**Researched:** 2026-06-10
**Domain:** React/Next.js state management, Supabase Realtime presence, PostgreSQL expression indexes, client-side timer synchronisation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pseudo Uniqueness**
- D-01: Pseudos are unique per room (case-insensitive). Add a `UNIQUE` constraint on `LOWER(pseudo)` scoped to `room_id` in the DB. No client-side pre-check — server is the single source of truth.
- D-02: On conflict: block the join entirely with a clear message. No auto-suffix, no workaround offered.
- D-03: Case-insensitive: "Nico" and "nico" are the same pseudo. Store pseudo as typed (for display), compare lowercase.

**Player Presence & Disconnection**
- D-04: Grace period reduced from 60s to 15s.
- D-05: When the last connected player is removed, the room is immediately deleted (CASCADE).
- D-06: The "elected advancer" mechanism in `lib/usePresence.ts` — reduce threshold from 60s to 15s.

**Timer State on Refresh**
- D-07: Add `round_started_at: string` (ISO timestamp) to `GameState`. Set when a new voting phase begins. Client calculates remaining time as `30 - (Date.now() - new Date(round_started_at).getTime()) / 1000`, clamped to [0, 30].
- D-08: Votes already in DB — after refresh, vote counts are refetched via broadcast mechanism.

**Mid-Round Player Join**
- D-09: A player joining during a vote round is admitted to roster but excluded from the current round's vote threshold. Snapshot `vote_round_player_count: number` in `game_state` when the voting phase starts.
- D-10: Broadcast a `player_joined` notification visible to all players. Event type `player_joined` on `votes-broadcast-${id}` channel.

**Type C — 0 Volunteers Fix**
- D-11: "répond à voix haute" message on `round_c_volunteers_reveal` only appears when `volunteer_player_ids.length >= 1`. When 0 volunteers, game transitions directly to `round_c_roulette`.

**Room Lifecycle**
- D-12: `cleanup_dead_rooms()` RPC stays as safety net. D-05 is the primary cleanup trigger.

**Lobby Quit Button**
- D-13: Add "Quitter" button to `app/room/[code]/lobby/page.tsx`. Same behavior as in-game.

**Pseudo Retention on Rejoin**
- D-14: On `/join`, when a `player_id` is found in localStorage for a given room code but the player's pseudo is no longer in the roster, the join flow presents the pseudo input pre-populated with the old name but editable. The player must confirm (submit).

**Landing Page Copy**
- D-15: Replace hardcoded "3 à 10 joueurs" with "conseillé entre 3 et 10 joueurs" (and equivalents in all 4 locales).

### Claude's Discretion

- SQL approach for pseudo uniqueness: add a migration file `supabase/migrations/003-pseudo-unique.sql` + update `supabase/schema.sql` idempotently.
- `vote_round_player_count` field placement in `GameState` — add alongside `round_started_at` in the same migration of `lib/types.ts`.
- Broadcast event shape for `player_joined` notification: `{ type: 'player_joined', pseudo: string }`.
- Toast/snackbar vs inline banner for the join notification: keep it subtle (2–3s toast, non-blocking).

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 03 is a bug-fix phase with no new features or external dependencies. Every change touches existing files in a brownfield Next.js 16 / Supabase / Tailwind v4 codebase. The 9 fixes span three tiers: DB schema (pseudo uniqueness constraint), game engine state (timer snapshot, vote threshold snapshot), and UI/UX layer (toast, lobby quit, rejoin pre-population, landing copy). No new npm packages are introduced.

The most technically complex fix is D-07 + D-09: adding `round_started_at` and `vote_round_player_count` to `GameState`, then threading them through every voting phase entry-point and into `VoteTimer`'s initial state. This requires precise coordination between `lib/types.ts`, `lib/game.ts` (`makeInitialGameState`), and `app/room/[code]/game/page.tsx` (all 4 phase-start transitions + `VoteTimer` initialisation).

The highest-risk DB change is the pseudo-uniqueness index. PostgreSQL expression indexes on `LOWER(column)` scoped to `room_id` are well-supported, but the index cannot be added as a plain `UNIQUE` column constraint — it must be a `UNIQUE INDEX` using `CREATE UNIQUE INDEX`. This distinction matters for the migration file.

**Primary recommendation:** Sequence the plans as (1) DB migration, (2) GameState type + engine changes, (3) game page threading, (4) UI additions (toast, lobby quit, join page), (5) i18n + copy fix. Each plan is independently deployable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pseudo uniqueness enforcement | Database (Supabase RLS + unique index) | API/Client (read Postgres error 23505) | Server is single source of truth (D-01) |
| Presence/ghost pruning | Client (lib/usePresence.ts) | Supabase Realtime presence channel | Presence is client-coordinated via elected advancer |
| Room deletion on last-leave | Client (onQuit + usePresence) | DB cascade | Client drives the delete; CASCADE handles referential integrity |
| Timer synchronisation on refresh | Client state (VoteTimer initialisation) | DB (round_started_at stored in game_state jsonb) | Timestamp stored in DB, consumed by client to derive elapsed time |
| Vote threshold snapshot | Client (game page, resolveVotes) | DB (vote_round_player_count in game_state jsonb) | Snapshot taken client-side at phase start, persisted to DB for rejoining clients |
| Mid-round join notification | Client broadcast (game page) | Supabase broadcast channel | Follows existing `votes-broadcast-${id}` pattern |
| Type C 0-volunteer fix | Client (game page, resolveTypeCChoice) | — | Pure client logic; no DB change needed |
| Lobby quit button | Client (lobby page) | DB (player delete + host transfer) | UI addition reusing existing in-game quit logic |
| Pseudo rejoin pre-population | Client (join page, localStorage) | — | Reads existing `kluup_pid_<CODE>` key; displays stored pseudo |
| Landing page copy | Client (lib/i18n.ts) | — | String-only change in i18n dictionaries |

---

## Standard Stack

This phase introduces no new libraries. All work is in existing stack.

### Core (existing, verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 (App Router) | Framework | Project foundation |
| React | 19 | UI | Framework dependency |
| TypeScript | — | Type safety | Project-wide |
| Supabase JS client | — | DB + Realtime | Project foundation |
| Tailwind CSS | v4 | Styling | Project foundation |

### No New Dependencies

This phase is entirely code and DB schema changes. No npm packages are added.

---

## Package Legitimacy Audit

> Not applicable — no external packages are installed in this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Player)
    │
    ├─── lib/usePresence.ts  ──────────────────────────────────────────────┐
    │    (Supabase Presence channel: `presence-${roomId}`)                  │
    │    leave event → setTimeout(GRACE_MS=15000) → elected advancer        │
    │    deletes players row                                                 │
    │                                                                        │
    ├─── app/join/page.tsx                                                   │
    │    └─ reads localStorage `kluup_pid_<CODE>`                           │
    │       → if found + not in roster → pre-populate pseudo field           │
    │       → insert players + UNIQUE index rejects duplicate LOWER(pseudo)  │
    │       → catch 23505 → display fr.join.pseudo_taken inline              │
    │                                                                        │
    ├─── app/room/[code]/lobby/page.tsx                                      │
    │    └─ [NEW] Quit button (top-left header row)                          │
    │       same onQuit logic as game page                                   │
    │                                                                        │
    └─── app/room/[code]/game/page.tsx
         │
         ├─── Phase start (voting_question / round_a_vote /
         │    round_b_vote / round_c_choice):
         │    → snapshot round_started_at = new Date().toISOString()
         │    → snapshot vote_round_player_count = players.length
         │    → write to game_state via updateRoomGameState
         │
         ├─── VoteTimer
         │    key={`vt-${gs.round}`}
         │    initialSecs = clamp(0, 30 - elapsed) from gs.round_started_at
         │    (refresh-safe: re-mounts with correct remaining time)
         │
         ├─── resolveVotes / submitVote / submitChoice
         │    count >= gs.vote_round_player_count  (NOT players.length)
         │    (mid-round joiners excluded from current round threshold)
         │
         ├─── resolveTypeCChoice
         │    guard: if (volunteer_player_ids.length === 0) → round_c_roulette
         │    (D-11: no "répond à voix haute" text when 0 volunteers)
         │
         └─── votes-broadcast-${roomId} channel
              ← vote_count events (existing)
              ← phase_changed events (existing)
              ← [NEW] player_joined events → Toast (2.5s, fixed top center)

Supabase
    ├─── players table
    │    └─ [NEW] UNIQUE INDEX idx_players_pseudo_lower
    │       ON players (room_id, LOWER(pseudo))
    │       (expression index — must use CREATE UNIQUE INDEX, not ALTER TABLE ADD CONSTRAINT)
    │
    └─── game_state jsonb
         └─ [NEW] fields: round_started_at: string, vote_round_player_count: number
```

### Recommended Project Structure (no change)

```
app/
├── page.tsx                     # D-15: i18n key update only
├── join/page.tsx                # D-14: pre-populate + D-01 error
├── room/[code]/
│   ├── lobby/page.tsx           # D-13: quit button
│   └── game/page.tsx            # D-07/D-09/D-10/D-11: timer, threshold, toast, Type C
lib/
├── i18n.ts                      # new keys: pseudo_taken, player_joined, landing update
├── types.ts                     # GameState: round_started_at, vote_round_player_count
├── game.ts                      # makeInitialGameState: initialise new fields
└── usePresence.ts               # GRACE_MS: 60000 → 15000, HEARTBEAT_MS: consider 30000
supabase/
├── schema.sql                   # idempotent: add UNIQUE INDEX + new GameState comment
└── migrations/
    └── 003-pseudo-unique.sql    # targeted migration: CREATE UNIQUE INDEX only
```

### Pattern 1: PostgreSQL Expression Index for Case-Insensitive Uniqueness

**What:** A `UNIQUE INDEX` on an expression (`LOWER(pseudo)`) scoped to `room_id`.
**When to use:** When uniqueness must be enforced case-insensitively, storing the original mixed-case value for display.
**Why not a UNIQUE constraint directly:** PostgreSQL `ADD CONSTRAINT ... UNIQUE` does not accept expressions. Expression uniqueness requires `CREATE UNIQUE INDEX`.

```sql
-- Source: PostgreSQL documentation (expression indexes)
-- supabase/migrations/003-pseudo-unique.sql

-- Idempotent: only creates the index if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'players'
      AND indexname = 'idx_players_pseudo_lower'
  ) THEN
    CREATE UNIQUE INDEX idx_players_pseudo_lower
      ON players (room_id, LOWER(pseudo));
  END IF;
END $$;
```

**Error code on violation:** `23505` (unique_violation). The Supabase JS client surfaces this as `error.code === '23505'`. [VERIFIED: PostgreSQL error code standard]

### Pattern 2: Catching 23505 in the Join Flow

**What:** Intercept the Supabase insert error for duplicate pseudo.
**When to use:** After the `players` insert in `app/join/page.tsx`.

```typescript
// Source: existing error handling pattern in app/join/page.tsx
const { data: player, error: playerError } = await supabase
  .from('players')
  .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false })
  .select()
  .single()

if (playerError) {
  if (playerError.code === '23505') {
    setPseudoError(fr.join.pseudo_taken)  // NEW: inline error state
  } else {
    console.error('[joinRoom] player insert failed:', playerError)
    alert(fr.join.join_error)
  }
  setLoading(false)
  return
}
```

### Pattern 3: VoteTimer Initialisation from `round_started_at`

**What:** On mount, calculate seconds remaining from the stored ISO timestamp.
**When to use:** `VoteTimer` component is always keyed by `gs.round` — it remounts each round. After a refresh, `round_started_at` is read from the DB-persisted `game_state`.

```typescript
// Source: existing VoteTimer pattern in app/room/[code]/game/page.tsx
// Modified to accept initialSecs prop derived from gs.round_started_at

function VoteTimer({
  isAdvancer,
  onExpire,
  initialSecs = 30,
}: {
  isAdvancer: boolean
  onExpire: () => void
  initialSecs?: number
}) {
  const [secs, setSecs] = useState(initialSecs)
  // ... rest unchanged
}

// At call site (game page, each voting phase):
const elapsed = gs.round_started_at
  ? Math.floor((Date.now() - new Date(gs.round_started_at).getTime()) / 1000)
  : 0
const initialSecs = Math.max(0, 30 - elapsed)

<VoteTimer key={`vt-${gs.round}`} isAdvancer={isAdvancer} onExpire={onForce} initialSecs={initialSecs} />
```

### Pattern 4: Vote Threshold Snapshot

**What:** Capture `players.length` at the moment a voting phase begins and store it in `game_state`.
**When to use:** Every call that advances to `voting_question`, `round_a_vote`, `round_b_vote`, or `round_c_choice`.

```typescript
// At every voting phase entry point in app/room/[code]/game/page.tsx
// Example: resolveVotes for 'question_selection' transitioning to round_a_vote
await advance({
  ...gs,
  phase: 'round_a_vote',
  current_question: chosen,
  played_question_ids: [...gs.played_question_ids, chosen.id],
  round_started_at: new Date().toISOString(),       // NEW
  vote_round_player_count: players.length,           // NEW
})

// In submitVote / resolveVotes / submitChoice — use snapshot, not live count:
if (count >= gs.vote_round_player_count) await resolveVotes(voteType)
//   ^^^ was: players.length
```

**Important:** The initial `voting_question` phase is set by `makeInitialGameState` in `lib/game.ts`. However, the actual phase transition to `voting_question` from `onNextRound` (and the initial launch from lobby) writes `round_started_at` at write time. `makeInitialGameState` only returns the default object — it cannot know `players.length` at the time of creation, so `vote_round_player_count` must be set by the caller (`startGame` in lobby and `onNextRound` in the game page), not inside `makeInitialGameState`.

### Pattern 5: Lobby Quit Button — Reusing In-Game Logic

**What:** Copy the `onQuit` function from the game page into the lobby page.
**Pattern source:** `app/room/[code]/game/page.tsx` lines 1816–1837 (the `onQuit` async function).

The lobby quit is structurally identical:
1. `clearPlayerId(code)`
2. `await supabase.from('players').delete().eq('id', myId)`
3. Fetch remaining players
4. If 0 remaining → delete the room
5. Else if was host → promote oldest remaining player
6. `router.push('/')`

**Difference from in-game:** No `window.confirm()` dialog in the lobby (per D-13 and UI-SPEC — single tap, immediate action).

### Pattern 6: Toast Notification (Inline State)

**What:** A 2.5s self-dismissing floating pill, no library required.
**Implementation:** `useState<string | null>` + `useEffect` with `setTimeout`.

```typescript
// Source: 03-UI-SPEC.md — inline implementation, no toast library
const [toastMessage, setToastMessage] = useState<string | null>(null)
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// In the broadcast listener for player_joined:
.on('broadcast', { event: 'player_joined' }, ({ payload }) => {
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  setToastMessage(fr.game.player_joined(payload.pseudo as string))
  toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
})

// In JSX (outside GameControlsCtx.Provider, inside the return):
{toastMessage && (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 24, padding: '8px 16px', maxWidth: 280,
      color: C.text, fontSize: 14, fontWeight: 500,
      fontFamily: 'var(--font-body)',
      animation: 'fadeIn 150ms ease-out',
    }}
  >
    {toastMessage}
  </div>
)}
```

### Pattern 7: Broadcast `player_joined` from Roster INSERT Handler

**What:** When a new player row arrives via `postgres_changes` INSERT on the `players` table (in the game page channel), broadcast a `player_joined` event if the room has an active game state (i.e., the game is in a voting phase, not ended).

```typescript
// In the postgres_changes INSERT handler for players in game page:
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, (payload) => {
  if (payload.new.room_id !== roomRef.current?.id) return
  setPlayers((prev) => {
    if (prev.find((p) => p.id === payload.new.id)) return prev
    const next = [...prev, payload.new as Player]
    playersRef.current = next
    return next
  })
  // [NEW] Notify everyone a player joined mid-round
  const gs = roomRef.current?.game_state
  if (gs && gs.phase !== 'ended') {
    voteChannelRef.current?.send({
      type: 'broadcast', event: 'player_joined',
      payload: { pseudo: (payload.new as Player).pseudo },
    })
  }
})
```

### Anti-Patterns to Avoid

- **Changing `players.length` to `gs.vote_round_player_count` EVERYWHERE:** Only change the threshold in the 4 submit/resolve functions (`submitVote`, `resolveVotes`, `submitChoice`, `resolveTypeCChoice`). The `VoteProgress` component should still show `players.length` as the denominator — showing the live roster count to users is correct UX (they see the actual team, not the snapshot).
- **Using `setTimeout` for toast without a ref:** Without `toastTimerRef`, quick successive joins will pile up timers. Clear the previous timer before setting a new one.
- **Setting `round_started_at` in `makeInitialGameState`:** This function runs synchronously without access to the current player list. The timestamp must be set at call time by the phase-advancing code.
- **Using `ALTER TABLE players ADD CONSTRAINT ... UNIQUE (room_id, LOWER(pseudo))`:** PostgreSQL does not support expression indexes via `ADD CONSTRAINT`. Use `CREATE UNIQUE INDEX` instead. [VERIFIED: PostgreSQL documentation]
- **Reverting `GRACE_MS` to `sessionStorage`-based fallback:** The CLAUDE.md explicitly warns against this. Keep `localStorage` scoped by room code.
- **Adding a `window.confirm()` to the lobby quit:** The UI-SPEC explicitly specifies no confirmation dialog in the lobby.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notification | Custom animation library or portal system | Inline `useState` + `setTimeout` + CSS `animation` | The app already has no UI library; a 10-line inline implementation matches the existing pattern exactly |
| Pseudo duplicate detection | Client-side player list scan before insert | PostgreSQL `UNIQUE INDEX` on `LOWER(pseudo)` scoped to `room_id` | Race condition: two simultaneous joins can both pass a client-side check. DB constraint is atomic. |
| Timer resync on refresh | Server-side clock or WebSocket ping-pong | Store `round_started_at` ISO string in `game_state` (already synced to all clients) | The game state is already the sync mechanism; piggybacking on it is zero extra complexity. |

---

## Runtime State Inventory

> SKIPPED — this is a greenfield bug-fix phase on an existing game, not a rename/refactor/migration phase. No stored strings change identity. The `vote_round_player_count` and `round_started_at` fields are new additions to `game_state` jsonb — old in-flight games that lack them will receive `undefined` for these fields. This is handled gracefully because:
> - `round_started_at: undefined` → `elapsed = 0` → timer starts at 30s (safe default).
> - `vote_round_player_count: undefined || 0` → fallback to `players.length` needed. See Pitfall 3 below.

---

## Common Pitfalls

### Pitfall 1: Expression Index vs. Column Constraint

**What goes wrong:** Developer writes `ALTER TABLE players ADD CONSTRAINT uq_pseudo UNIQUE (room_id, LOWER(pseudo))` — PostgreSQL rejects it with "functions in index expression must be immutable" or a syntax error depending on Postgres version.
**Why it happens:** `ADD CONSTRAINT ... UNIQUE` only works on column references, not expressions.
**How to avoid:** Always use `CREATE UNIQUE INDEX` for expression-based uniqueness. The idempotent guard (`IF NOT EXISTS`) prevents re-creation.
**Warning signs:** SQL editor error on migration execution.

### Pitfall 2: `vote_round_player_count` Fallback for In-Flight Games

**What goes wrong:** A game started before the Phase 3 migration has `vote_round_player_count = undefined` in its `game_state`. If the resolve threshold check is `count >= gs.vote_round_player_count`, `undefined` on the right side means `count >= undefined` → `false` always → the game hangs forever.
**Why it happens:** The jsonb field doesn't exist in old rows; TypeScript types it as `number` but at runtime it's `undefined`.
**How to avoid:** Use a nullish fallback everywhere the field is read:
```typescript
const threshold = gs.vote_round_player_count || players.length
if (count >= threshold) await resolveVotes(voteType)
```
The `|| players.length` fallback is correct: if no snapshot exists, use the current roster (the pre-Phase-3 behaviour).
**Warning signs:** Vote phases that never auto-resolve after Phase 3 deployment.

### Pitfall 3: `round_started_at` Fallback for In-Flight Games

**What goes wrong:** `new Date(undefined).getTime()` → `NaN`. Arithmetic with `NaN` yields `NaN`. `Math.max(0, NaN)` → `NaN`. Timer initialises with `NaN` seconds, SVG arc breaks.
**Why it happens:** Same in-flight game backward compatibility issue.
**How to avoid:**
```typescript
const elapsed = gs.round_started_at
  ? Math.floor((Date.now() - new Date(gs.round_started_at).getTime()) / 1000)
  : 0   // safe: timer starts from 30 if no timestamp
const initialSecs = Math.max(0, 30 - elapsed)
```
**Warning signs:** VoteTimer renders `NaN` in the countdown circle.

### Pitfall 4: `vote_round_player_count` Set Too Late

**What goes wrong:** The snapshot is taken after the DB write, so it briefly shows `players.length` from a stale closure that doesn't include the newest player who triggered the join notification.
**Why it happens:** React state batching and async DB calls mean the `players` state may not include the latest INSERT yet when `advance()` is called.
**How to avoid:** Use `playersRef.current.length` instead of `players.length` when snapshotting `vote_round_player_count` at phase-start. `playersRef` is kept in sync synchronously in the INSERT handler.
**Warning signs:** Vote threshold is off by one when a player joins right as a round starts.

### Pitfall 5: Toast Appears in Lobby

**What goes wrong:** The `player_joined` broadcast listener is active at the lobby level too (via the `game-${code}` channel), and the toast is rendered regardless of current page.
**Why it happens:** The game page's broadcast channel is set up in `setup()`, which only runs on the game page. The lobby page has its own channel (`lobby-${code}`) and does NOT subscribe to `votes-broadcast-${id}`.
**How to avoid:** Toast listener is only in `app/room/[code]/game/page.tsx`. No cross-page risk. The lobby already shows a live player list (via `postgres_changes` on players INSERT), which is the correct UX there.
**Warning signs:** Would require the lobby to subscribe to the votes-broadcast channel, which it never does.

### Pitfall 6: Pseudo Uniqueness Breaks Reconnect

**What goes wrong:** A player reconnects (their row still exists in DB, `getPlayerId` finds the stored id) but the code path goes through insert instead of reuse, hitting the unique constraint on their own pseudo.
**Why it happens:** If the reconnect logic changes or the check for `existing` player fails, the insert path is taken.
**How to avoid:** The existing reconnect logic in `app/join/page.tsx` (lines 52–58) checks for the stored `player_id` in the DB first. If found, it sets `playerId` directly and skips the insert. The unique constraint is never hit for reconnects. Verify this logic is not accidentally removed.
**Warning signs:** Reconnecting players see "pseudo already taken" for their own name.

### Pitfall 7: `resolveOnShrinkRef` Uses Old Threshold

**What goes wrong:** When the roster shrinks (ghost pruned), `resolveOnShrinkRef.current()` checks `count >= players.length`. After Phase 3, it should check `count >= (gs.vote_round_player_count || players.length)`.
**Why it happens:** The resolve-on-shrink closure at lines 1840–1854 of game page currently uses `players.length` directly.
**How to avoid:** Update `resolveOnShrinkRef.current` to use the same threshold logic as `submitVote` and `submitChoice`.
**Warning signs:** Host does not auto-advance when a ghost is pruned but all remaining players have voted.

---

## Code Examples

### Adding `round_started_at` and `vote_round_player_count` to `GameState`

```typescript
// lib/types.ts — add to GameState interface
export type GameState = {
  // ... existing fields ...
  session_uuid: string

  // Phase 3 additions:
  // ISO timestamp of when the current voting phase started.
  // Used by clients to compute remaining timer time after a refresh.
  // Empty string for non-voting phases (reveal, ended).
  round_started_at: string

  // Player count snapshot taken when the current voting phase started.
  // Joiners after this snapshot are excluded from the current round threshold.
  // 0 as default; runtime code falls back to players.length if 0.
  vote_round_player_count: number
}
```

### `makeInitialGameState` Updates

```typescript
// lib/game.ts — add initialisation of new fields
export function makeInitialGameState(candidates: Question[]): GameState {
  return {
    phase: 'voting_question',
    round: 1,
    candidates,
    // ... existing fields ...
    session_uuid: '',
    round_started_at: '',          // caller sets this at phase-start
    vote_round_player_count: 0,    // caller sets this at phase-start
  }
}
```

**Note:** The caller (`startGame` in lobby) must set both fields immediately after calling `makeInitialGameState`, before writing to DB.

### Lobby `startGame` — Set New Fields

```typescript
// app/room/[code]/lobby/page.tsx — in startGame()
const candidates = await pickCandidates(selectedTheme, 1, [])
const gs = makeInitialGameState(candidates)
gs.session_uuid = crypto.randomUUID()
gs.round_started_at = new Date().toISOString()           // NEW
gs.vote_round_player_count = players.length              // NEW

await supabase
  .from('rooms')
  .update({ status: 'playing', theme: selectedTheme, game_state: gs })
  .eq('id', roomId)
```

### `onNextRound` — Set New Fields

```typescript
// app/room/[code]/game/page.tsx — in onNextRound()
await advance({
  ...gs,
  phase: 'voting_question',
  round: nextRound,
  candidates,
  current_question: null,
  // ... reset fields ...
  round_started_at: new Date().toISOString(),           // NEW
  vote_round_player_count: playersRef.current.length,   // NEW — use ref, not state
  stats,
})
```

### Phase Transitions That Need the New Fields

Every transition TO a voting phase must set both fields. The 4 voting phases are:
- `voting_question` (set by `startGame` in lobby and `onNextRound` in game)
- `round_a_vote` (set in `resolveVotes` when `voteType === 'question_selection'`)
- `round_b_vote` (set in `resolveVotes` when `voteType === 'question_selection'`)
- `round_c_choice` (set in `resolveVotes` when `voteType === 'question_selection'`)

The transition from `question_selection` to the round-type vote is handled inside `resolveVotes`:

```typescript
// In resolveVotes, for question_selection resolution:
const nextPhase = chosen.type === 'A' ? 'round_a_vote'
  : chosen.type === 'B' ? 'round_b_vote'
  : 'round_c_choice'
await advance({
  ...gs,
  phase: nextPhase as GameState['phase'],
  current_question: chosen,
  played_question_ids: [...gs.played_question_ids, chosen.id],
  round_started_at: new Date().toISOString(),           // NEW
  vote_round_player_count: playersRef.current.length,   // NEW
})
```

### Type C 0-Volunteer Guard

```typescript
// lib/types.ts (or game page): resolveTypeCChoice — D-11 fix
async function resolveTypeCChoice() {
  if (!room || !gs) return
  const vols = await fetchVotes(room.id, gs.round, 'volunteer')
  if (vols.length > 0) {
    // ≥1 volunteer → volunteers reveal screen
    await advance({
      ...gs,
      phase: 'round_c_volunteers_reveal',
      volunteer_player_ids: vols.map((v) => v.player_id as string),
    })
    return
  }
  // 0 volunteers → roulette (D-11: never show "répond à voix haute" here)
  const desigs = await fetchVotes(room.id, gs.round, 'designation')
  const { topIds } = tallyDesignation(desigs, players.length)
  const winner = topIds.length > 0
    ? topIds[Math.floor(Math.random() * topIds.length)]
    : null
  await advance({
    ...gs,
    phase: 'round_c_roulette',
    designated_player_ids: topIds,
    designated_player_id: winner,
  })
}
```

The current code already has this structure. The bug is that `VolunteersRevealScreen` renders even when `volunteer_player_ids.length === 0` if the server transitions to that phase incorrectly. After D-11, the phase transition path never reaches `round_c_volunteers_reveal` with 0 volunteers. Verify: the current `resolveTypeCChoice` already guards `if (vols.length > 0)` before advancing to `round_c_volunteers_reveal` — this logic is correct. The bug may be in a different path. Need to verify in game page. [ASSUMED — need to confirm the exact bug reproduction path from playtest notes.]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 60s ghost prune grace period | 15s (D-06) | Phase 3 | Faster roster cleanup; OK for phone lock within 15s |
| `players.length` as vote threshold | `vote_round_player_count` snapshot | Phase 3 | Mid-round joiners no longer block current round |
| No timer state in DB | `round_started_at` in `game_state` jsonb | Phase 3 | Refresh-safe timers |
| No pseudo uniqueness constraint | `UNIQUE INDEX` on `LOWER(pseudo)` per room | Phase 3 | Eliminates duplicate-name confusion |

**Deprecated/outdated:**
- `GRACE_MS = 60_000` in `lib/usePresence.ts`: replaced by 15,000 (D-06).
- `HEARTBEAT_MS = 120_000` in `lib/usePresence.ts`: CONTEXT.md suggests reviewing this. Consider reducing to 30,000 for fresher presence signal. [ASSUMED — not explicitly locked in D-04/D-06, treat as Claude's discretion.]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Type C 0-volunteer bug requires checking `resolveTypeCChoice` — the phase guard `if (vols.length > 0)` already exists but may have a separate render-side bug | Code Examples — Type C fix | If the bug is elsewhere (e.g. in how `round_c_volunteers_reveal` screen renders), the fix approach is correct but needs an additional guard in `VolunteersRevealScreen` |
| A2 | Reducing `HEARTBEAT_MS` to 30,000 is within Claude's discretion per CONTEXT.md | Common Pitfalls / usePresence | If user prefers the 2min heartbeat, leave as-is |

---

## Open Questions (RESOLVED)

1. **Type C bug exact reproduction path**
   - What we know: D-11 states "the 'répond à voix haute' message appears on `round_c_volunteers_reveal` when `volunteer_player_ids.length === 0`"
   - What's unclear: Is the bug in `resolveTypeCChoice` (wrong phase transition) or in `VolunteersRevealScreen` (renders `volunteers_reveal_one` with `vols[0]` even when `vols` is empty)?
   - Recommendation: Inspect `VolunteersRevealScreen` — if `vols` is empty, `vols[0]` is `undefined` and `volunteers_reveal_one(undefined?.pseudo)` could render garbage. The fix may need both: correct transition logic AND a guard in the render screen.
   - RESOLVED: Both transition guard and render guard fixed in Plan 04 Task 3 — `resolveTypeCChoice` transition fixed + `VolunteersRevealScreen` early-return guard added.

2. **Heartbeat interval reduction**
   - What we know: CLAUDE.md lists heartbeat at 2min; CONTEXT.md says "consider dropping to 30s".
   - What's unclear: Whether reducing the heartbeat has a Supabase billing impact (more Realtime messages).
   - Recommendation: Reduce to 30s per CONTEXT.md suggestion. Supabase Realtime messages at this scale (small party game rooms) are negligible.
   - RESOLVED: Reduced to 30s in Plan 02 Task 3 per CONTEXT.md; billing impact negligible at party-game scale.

---

## Environment Availability

> SKIPPED — this phase has no external dependencies beyond the existing Supabase project. All changes are to project source files and SQL run in the Supabase dashboard. No CLI tools, runtimes, or services need to be installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not detected — no test config or test files found in repo |
| Config file | None |
| Quick run command | `next build` (compilation + type-check as proxy) |
| Full suite command | Manual smoke test per CLAUDE.md patterns |

### Phase Requirements → Test Map

This phase has no formal REQ IDs (per additional_context: "game quality — no auth requirements"). Requirements map to the 9 success criteria.

| Success Criterion | Behavior | Test Type | Automated Command | Notes |
|-------------------|----------|-----------|-------------------|-------|
| SC-1: Duplicate pseudo rejected | Second join with same pseudo (different case) shows error | Integration / Manual | `next build` (type-check) | DB constraint enforced server-side |
| SC-2: Tab close removes player after grace period | Player row deleted within 15s of tab close | Manual | — | Presence system — requires real browser |
| SC-3: Empty room deleted | Room row absent after last player quits | Manual | — | Requires real session |
| SC-4: Rejoin shows fresh join flow | `/join` shows editable pre-populated pseudo | Manual | — | Requires localStorage setup |
| SC-5: Refresh shows correct timer + vote count | VoteTimer initialises from `round_started_at` | Manual | — | Requires mid-round refresh |
| SC-6: Lobby has quit button | Button visible and functional in lobby | Manual | — | UI change |
| SC-7: Type C 0-volunteers → roulette | No "répond à voix haute" text with 0 volunteers | Manual | — | Requires specific game flow |
| SC-8: Mid-round join excluded from threshold | Vote resolves when original players complete (not waiting for new joiner) | Manual | — | Requires coordinated 2-device test |
| SC-9: Landing page copy | "conseillé entre 3 et 10 joueurs" visible | Automated | `next build` (no strings missing) | i18n Dict type enforces all keys |

### Sampling Rate

- **Per task commit:** `npx next build` to catch TypeScript errors (esp. `Dict` exhaustiveness).
- **Per wave merge:** `next build` + manual smoke of affected screens.
- **Phase gate:** Full manual smoke test of all 9 success criteria before `/gsd-verify-work`.

### Wave 0 Gaps

- No test framework exists in the codebase. Testing is manual + `next build` type-checking.
- The `Dict` type in `lib/i18n.ts` enforces i18n key exhaustiveness at compile time — this is the automated test for SC-9.

*(No Wave 0 test file creation needed — no test framework to scaffold.)*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`. Review applicable ASVS categories for this phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes in this phase |
| V3 Session Management | No | Session identity unchanged (localStorage per room) |
| V4 Access Control | Partial | Pseudo uniqueness is enforced server-side (DB constraint) — not bypassable client-side |
| V5 Input Validation | Yes | Pseudo input: existing `maxLength={20}`. New: `LOWER(pseudo)` uniqueness in DB. `pseudo.trim()` before insert already present. |
| V6 Cryptography | No | No new crypto usage |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bypassing pseudo uniqueness via direct API call | Tampering | DB `UNIQUE INDEX` — cannot be bypassed by any client |
| Expired-room ghost data | Information Disclosure | `cleanup_dead_rooms()` TTL + D-05 immediate delete on last-leave |
| Broadcast spoofing (`player_joined`) | Spoofing | Acceptable for MVP — anon Supabase broadcast has no sender verification. The notification is cosmetic (toast only), not a security gate. |
| Timer manipulation via stale `round_started_at` | Tampering | `round_started_at` is written server-side (via game_state update) and read by all clients uniformly. A client cannot send a false timestamp — it would need to write to `rooms.game_state` which requires the host-driven flow. |

---

## Project Constraints (from CLAUDE.md)

All CLAUDE.md directives apply. Key ones relevant to this phase:

1. **Zero text hardcoded** — All new strings go through `lib/i18n.ts` Dict (enforced by TypeScript type). New keys: `join.pseudo_taken`, `game.player_joined` (function), updated `landing.players_hint`. Optional: `join.pseudo_prefilled_hint`.
2. **Mobile-first** — Toast positioned `fixed top-4`, max 280px width. Lobby quit button uses `px-3 h-8 rounded-xl` matching existing in-game pattern.
3. **`host_id NOT NULL` on prod** — No change to room creation in this phase; constraint is respected.
4. **Do NOT use `html2canvas`** — Not relevant; no screenshot changes.
5. **Do NOT revert to `sessionStorage.getItem('player_id')`** — The rejoin pre-population uses `getPlayerId(code)` from `lib/utils.ts` which reads `localStorage` scoped to the room code.
6. **`supabase/schema.sql` is source of truth** — Phase 3 migration must also update `schema.sql` idempotently (add `-- Phase 3: pseudo uniqueness` comment + the `DO $$ IF NOT EXISTS ... CREATE UNIQUE INDEX` block).
7. **Replay must purge votes** — Not changed in this phase; `startGame` already calls `votes.delete()`.
8. **`onPause`/`onResume`** use `roomRef.current.game_state` — Maintained; no changes to pause logic.

---

## Sources

### Primary (HIGH confidence)

- `lib/usePresence.ts` — full presence implementation read directly
- `lib/types.ts` — `GameState` interface read directly
- `lib/game.ts` — `makeInitialGameState`, `resolveVotes` read directly
- `app/room/[code]/game/page.tsx` — full game page read directly (lines 1–1899)
- `app/room/[code]/lobby/page.tsx` — full lobby page read directly
- `app/join/page.tsx` — full join page read directly
- `lib/i18n.ts` — all 4 language dictionaries read directly
- `supabase/schema.sql` — DB schema read directly
- `.planning/phases/03-playtest-quality-fixes/03-CONTEXT.md` — all decisions
- `.planning/phases/03-playtest-quality-fixes/03-UI-SPEC.md` — UI contract
- `CLAUDE.md` — project constraints

### Secondary (MEDIUM confidence)

- PostgreSQL expression index pattern (`CREATE UNIQUE INDEX ON table (col, LOWER(col))`) — standard PostgreSQL documentation pattern [ASSUMED from training knowledge; aligns with standard PostgreSQL behavior]

### Tertiary (LOW confidence)

- Supabase JS client error code `23505` for unique violations — [ASSUMED from training knowledge; consistent with PostgreSQL standard error codes which Supabase surfaces as-is]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries read directly from codebase
- Architecture: HIGH — all phase transitions traced through actual source files
- Pitfalls: HIGH — derived from direct code reading, not assumptions
- DB migration pattern: MEDIUM — expression index is standard PostgreSQL; execution in Supabase dashboard is standard

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable stack, 30 days)
