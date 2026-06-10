# Phase 03: Playtest Quality Fixes — Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/types.ts` | model | transform | `lib/types.ts` (self) | exact — add fields to `GameState` |
| `lib/game.ts` | service | transform | `lib/game.ts` (self) | exact — update `makeInitialGameState` |
| `lib/usePresence.ts` | hook | event-driven | `lib/usePresence.ts` (self) | exact — change constants |
| `lib/i18n.ts` | config | transform | `lib/i18n.ts` (self) | exact — add keys to all 4 dicts |
| `app/room/[code]/game/page.tsx` | component | event-driven | `app/room/[code]/game/page.tsx` (self) | exact — thread new fields, add toast |
| `app/room/[code]/lobby/page.tsx` | component | request-response | `app/room/[code]/game/page.tsx` `onQuit` | role-match — copy quit logic |
| `app/join/page.tsx` | component | request-response | `app/join/page.tsx` (self) | exact — add error state + pre-populate |
| `supabase/migrations/003-pseudo-unique.sql` | migration | CRUD | `supabase/schema.sql` idempotent index block | role-match |

---

## Pattern Assignments

### `lib/types.ts` (model, transform)

**Analog:** `lib/types.ts` itself — extend the `GameState` interface.

**Existing `GameState` tail** (lines 58–82):
```typescript
export type GameState = {
  phase: GamePhase
  round: number
  candidates: Question[]
  current_question: Question | null
  b_subtype: BSubtype | null
  designated_player_id: string | null
  designated_player_ids: string[]
  designation_tie_all: boolean
  revealed_player_ids: string[]
  yes_percentage: number | null
  volunteer_player_ids: string[]
  played_question_ids: string[]
  paused: boolean
  stats: SessionStats
  b2_revealed: boolean
  session_uuid: string
  // ADD after session_uuid:
  round_started_at: string          // ISO timestamp set at each voting phase start; '' for non-voting phases
  vote_round_player_count: number   // snapshot of players.length at voting phase start; 0 = use fallback
}
```

**Placement rule:** New fields go after `session_uuid` at the bottom of the interface. This keeps backward compat visible — old jsonb rows have `undefined` for these, which the runtime must guard.

---

### `lib/game.ts` (service, transform)

**Analog:** `lib/game.ts` `makeInitialGameState` (lines 78–97).

**Existing `makeInitialGameState` pattern** (lines 78–97):
```typescript
export function makeInitialGameState(candidates: Question[]): GameState {
  return {
    phase: 'voting_question',
    round: 1,
    candidates,
    current_question: null,
    b_subtype: null,
    designated_player_id: null,
    designated_player_ids: [],
    designation_tie_all: false,
    revealed_player_ids: [],
    yes_percentage: null,
    volunteer_player_ids: [],
    played_question_ids: [],
    paused: false,
    stats: emptyStats(),
    b2_revealed: false,
    session_uuid: '', // startGame() in lobby assigns a fresh UUID via the browser crypto API before writing to DB
  }
}
```

**What to add** — two new fields with zero values (callers set real values):
```typescript
    session_uuid: '',
    round_started_at: '',        // caller (startGame / onNextRound) sets this
    vote_round_player_count: 0,  // caller sets this; 0 triggers players.length fallback
```

**Critical constraint from RESEARCH.md:** Do NOT set `round_started_at` or `vote_round_player_count` inside `makeInitialGameState`. The function has no access to `players.length` at the time of creation. The caller (`startGame` in lobby and `onNextRound` in game) must set both fields immediately after calling `makeInitialGameState`.

---

### `lib/usePresence.ts` (hook, event-driven)

**Analog:** `lib/usePresence.ts` itself — two constant changes.

**Existing constants** (lines 8–11):
```typescript
const GRACE_MS = 60_000
const HEARTBEAT_MS = 120_000
```

**Change to:**
```typescript
const GRACE_MS = 15_000     // D-06: reduced from 60s — covers phone lock/unlock within 15s
const HEARTBEAT_MS = 30_000 // fresher presence signal (CONTEXT.md suggestion)
```

**Core pruning pattern** (lines 43–53) — do not change structure, only `GRACE_MS` value feeds `setTimeout`:
```typescript
.on('presence', { event: 'leave' }, ({ key }) => {
  if (key === myId) return
  cancelPrune(key)
  const t = setTimeout(async () => {
    pending.current.delete(key)
    if (channel.presenceState()[key]) return // reconnected within grace period
    if (!isCleaner()) return                 // another client handles it
    try { await supabase.from('players').delete().eq('id', key) } catch { /* ignore */ }
  }, GRACE_MS)
  pending.current.set(key, t)
})
```

**D-05 last-player deletion:** The last-player-deletes-room logic lives in `onQuit` (game page + lobby page), not in `usePresence.ts`. Presence only prunes ghost rows. When presence prunes the last player, the room TTL cleanup (`cleanup_dead_rooms()` RPC) is the safety net per D-12.

---

### `lib/i18n.ts` (config, transform)

**Analog:** `lib/i18n.ts` itself — the `Dict` type enforces all 4 languages must have the same keys. Adding a key to `fr` will cause a TypeScript compile error until `en`, `es`, `de` are updated.

**Existing `join` section pattern** (lines 40–49 of `fr`):
```typescript
  join: {
    title: "Rejoindre",
    subtitle: "Entre le code de la room",
    code_placeholder: "Code (ex: 7TKFQU)",
    join_btn: "Rejoindre",
    joining: "Connexion…",
    room_not_found: "Room introuvable — vérifie le code",
    join_error: "Impossible de rejoindre la room. Réessaie dans un instant.",
    back_home: "← Accueil",
  },
```

**New keys to add to all 4 languages:**

| Key | Section | FR value | EN value | ES value | DE value |
|---|---|---|---|---|---|
| `join.pseudo_taken` | `join` | `"Ce pseudo est déjà pris, choisis-en un autre."` | `"This name is already taken, pick another one."` | `"Este nombre ya está en uso, elige otro."` | `"Dieser Name ist vergeben, wähle einen anderen."` |
| `join.pseudo_prefilled_hint` | `join` | `"Ton prénom de la dernière fois — modifie si tu veux."` | `"Your name from last time — edit if you'd like."` | `"Tu nombre de la última vez — cámbialo si quieres."` | `"Dein Name von letztem Mal — ändere ihn wenn du möchtest."` |
| `game.player_joined` | `game` | function `(pseudo: string) => \`${pseudo} a rejoint la partie\`` | function `(pseudo: string) => \`${pseudo} joined the game\`` | function `(pseudo: string) => \`${pseudo} se unió a la partida\`` | function `(pseudo: string) => \`${pseudo} ist beigetreten\`` |
| `landing.players_hint` | `landing` | `"conseillé entre 3 et 10 joueurs · 10–20 min"` | `"recommended 3 to 10 players · 10–20 min"` | `"recomendado entre 3 y 10 jugadores · 10–20 min"` | `"empfohlen 3 bis 10 Spieler · 10–20 Min"` |

**Existing `landing.players_hint`** to replace (line 22 for FR, line 205 for EN, line 386 for ES, line 567 for DE):
```typescript
players_hint: "3 à 10 joueurs · 10–20 min",  // FR — replace
players_hint: "3 to 10 players · 10–20 min",  // EN — replace
players_hint: "3 a 10 jugadores · 10–20 min", // ES — replace
players_hint: "3 bis 10 Spieler · 10–20 Min", // DE — replace
```

**Function-valued i18n key pattern** — the project already uses function-valued keys in the `lobby` section (e.g. `need_players`). Follow the same pattern:
```typescript
player_joined: (pseudo: string) => `${pseudo} a rejoint la partie`,
```

---

### `app/room/[code]/game/page.tsx` (component, event-driven)

**Analog:** `app/room/[code]/game/page.tsx` itself. Six distinct change sites:

#### 1. `VoteTimer` — add `initialSecs` prop (lines 301–350)

**Current signature** (line 301):
```typescript
function VoteTimer({ isAdvancer, onExpire }: { isAdvancer: boolean; onExpire: () => void }) {
  const [secs, setSecs] = useState(30)
```

**New signature:**
```typescript
function VoteTimer({
  isAdvancer, onExpire, initialSecs = 30,
}: {
  isAdvancer: boolean
  onExpire: () => void
  initialSecs?: number
}) {
  const [secs, setSecs] = useState(initialSecs)
```

SVG arc formula (line 326) uses `secs / 30` — must stay `/ 30` (denominator is always the full duration, not `initialSecs`). The existing `fired` ref pattern (lines 315–321) works unchanged with any starting value.

#### 2. `VoteTimer` call sites — pass `initialSecs` (lines 481, 509, 710, 896)

**Pattern to add at each call site:**
```typescript
// Compute once, before the JSX return, for the current voting phase:
const elapsed = gs.round_started_at
  ? Math.floor((Date.now() - new Date(gs.round_started_at).getTime()) / 1000)
  : 0
const initialSecs = Math.max(0, 30 - elapsed)

// Then at the VoteTimer element:
<VoteTimer key={`vt-${gs.round}`} isAdvancer={isAdvancer} onExpire={onForce} initialSecs={initialSecs} />
```

#### 3. Vote threshold — replace `players.length` with snapshot (lines 1664, 1733)

**Current** (line 1664):
```typescript
if (count >= players.length) await resolveVotes(voteType)
```
**New:**
```typescript
const threshold = gs!.vote_round_player_count || players.length
if (count >= threshold) await resolveVotes(voteType)
```

**Current** (line 1733):
```typescript
if (count >= players.length) await resolveTypeCChoice()
```
**New:**
```typescript
const threshold = gs!.vote_round_player_count || players.length
if (count >= threshold) await resolveTypeCChoice()
```

Also update `resolveOnShrinkRef.current` (lines 1840–1854) — replace `players.length` with `(gs.vote_round_player_count || players.length)` in the count comparison.

#### 4. Voting phase transitions — snapshot new fields (lines 1675–1678, 1789–1795)

**Existing `resolveVotes` question_selection transition** (lines 1675–1679):
```typescript
await advance({
  ...gs, phase: nextPhase as GameState['phase'],
  current_question: chosen, played_question_ids: [...gs.played_question_ids, chosen.id],
})
```
**New:**
```typescript
await advance({
  ...gs, phase: nextPhase as GameState['phase'],
  current_question: chosen, played_question_ids: [...gs.played_question_ids, chosen.id],
  round_started_at: new Date().toISOString(),
  vote_round_player_count: playersRef.current.length,   // use ref, not state (Pitfall 4)
})
```

**Existing `onNextRound` transition** (lines 1789–1795):
```typescript
await advance({
  ...gs, phase: 'voting_question', round: nextRound, candidates,
  current_question: null, b_subtype: null, designated_player_id: null,
  designated_player_ids: [], designation_tie_all: false,
  revealed_player_ids: [], yes_percentage: null, volunteer_player_ids: [],
  b2_revealed: false, stats,
})
```
**New:** add two fields:
```typescript
  round_started_at: new Date().toISOString(),
  vote_round_player_count: playersRef.current.length,
```

#### 5. `player_joined` toast — new broadcast listener + state

**Pattern** — add alongside existing broadcast listener setup (near `voteChannelRef` setup, ~line 1600):
```typescript
const [toastMessage, setToastMessage] = useState<string | null>(null)
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

In the broadcast channel `.on('broadcast', ...)` chain:
```typescript
.on('broadcast', { event: 'player_joined' }, ({ payload }) => {
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  setToastMessage(fr.game.player_joined(payload.pseudo as string))
  toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
})
```

In JSX (inside the returned `<main>`, after the `GameControlsCtx.Provider`):
```typescript
{toastMessage && (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 24, padding: '8px 16px', maxWidth: 280,
      color: '#fff', fontSize: 14, fontWeight: 500,
      fontFamily: 'var(--font-body)',
    }}
  >
    {toastMessage}
  </div>
)}
```

#### 6. `player_joined` broadcast — emit from players INSERT handler (~line 1563)

**Existing INSERT handler pattern** (lines 1558–1565):
```typescript
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, (payload) => {
  if (payload.new.room_id !== roomRef.current?.id) return
  setPlayers((prev) => {
    if (prev.find((p) => p.id === payload.new.id)) return prev
    const next = [...prev, payload.new as Player]
    playersRef.current = next
    return next
  })
})
```

**Add after `setPlayers` call:**
```typescript
  const currentGs = roomRef.current?.game_state
  if (currentGs && currentGs.phase !== 'ended') {
    voteChannelRef.current?.send({
      type: 'broadcast', event: 'player_joined',
      payload: { pseudo: (payload.new as Player).pseudo },
    })
  }
```

---

### `app/room/[code]/lobby/page.tsx` (component, request-response)

**Analog:** `app/room/[code]/game/page.tsx` `onQuit` function (lines 1816–1837) — copy directly.

**Existing `onQuit` in game page** (lines 1816–1837):
```typescript
async function onQuit() {
  if (!room || !myId) { router.push('/'); return }
  const wasHost = isHost

  clearPlayerId(code)
  await supabase.from('players').delete().eq('id', myId)

  const { data: rest } = await supabase.from('players').select().eq('room_id', room.id)
  const remaining = (rest ?? []) as Player[]

  if (remaining.length === 0) {
    await supabase.from('rooms').delete().eq('id', room.id)
  } else if (wasHost) {
    const next = [...remaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
    await supabase.from('players').update({ is_host: true }).eq('id', next.id)
  }

  router.push('/')
}
```

**Differences in lobby:**
1. No `window.confirm()` wrapper — single tap, immediate action (per D-13 and RESEARCH.md anti-patterns).
2. Lobby has `roomId` (string state), not a full `room` object — use `roomId` for room deletion query.
3. Add `clearPlayerId` import from `@/lib/utils` (already imported in game page, not in lobby).

**Button placement pattern** — lobby header currently has `LangSwitch` at top-right (line 164). Add the quit button to the top-left, following the `RoundHeader` pattern from game page where quit is top-left:
```tsx
<div className="w-full flex justify-between items-center px-5 pt-4">
  <button
    type="button"
    onClick={onQuit}
    className="text-sm font-medium px-3 h-8 rounded-xl"
    style={{ background: C.surface, border: `1px solid ${C.border}`, color: '#888', fontFamily: 'var(--font-body)' }}
  >
    {fr.game.quit_btn}
  </button>
  <LangSwitch />
</div>
```

**Imports to add to lobby:**
```typescript
import { copyToClipboard, getPlayerId, clearPlayerId } from '@/lib/utils'
```
(`clearPlayerId` is the new addition; the others are already imported.)

---

### `app/join/page.tsx` (component, request-response)

**Analog:** `app/join/page.tsx` itself — three additions.

#### 1. Pseudo error state (D-01/D-02)

**Current state** (lines 12–15):
```typescript
const [code, setCode] = useState('')
const [pseudo, setPseudo] = useState('')
const [loading, setLoading] = useState(false)
```

**Add:**
```typescript
const [pseudoError, setPseudoError] = useState<string | null>(null)
```

**Existing player insert + error handling** (lines 60–74):
```typescript
const { data: player, error: playerError } = await supabase
  .from('players')
  .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false })
  .select()
  .single()

if (playerError || !player) {
  console.error('[joinRoom] player insert failed:', playerError)
  alert(fr.join.join_error)
  setLoading(false)
  return
}
```

**Replace `if (playerError || !player)` block with:**
```typescript
if (playerError) {
  if (playerError.code === '23505') {
    setPseudoError(fr.join.pseudo_taken)
  } else {
    console.error('[joinRoom] player insert failed:', playerError)
    alert(fr.join.join_error)
  }
  setLoading(false)
  return
}
if (!player) { setLoading(false); return }
```

**Clear error on pseudo change:**
```typescript
onChange={(e) => { setPseudo(e.target.value); setPseudoError(null) }}
```

**Inline error display** — add below the pseudo input, above the submit button:
```tsx
{pseudoError && (
  <p className="text-sm text-center" style={{ color: '#FF3C6F', fontFamily: 'var(--font-body)' }}>
    {pseudoError}
  </p>
)}
```

#### 2. Pseudo pre-population on rejoin (D-14)

**Existing reconnect logic** (lines 52–58):
```typescript
const stored = getPlayerId(normalizedCode)
if (stored) {
  const { data: existing } = await supabase
    .from('players').select('id').eq('room_id', room.id).eq('id', stored).maybeSingle()
  if (existing) playerId = existing.id
}
```

**The pre-population case:** When `stored` exists but `existing` is null (player quit — row gone), show their old pseudo pre-filled. This requires reading the old pseudo from a separate localStorage key, OR fetching via a player lookup that also returns `pseudo`. The cleanest approach (no new storage key) is to attempt the existing lookup and, if not found, do a second query to fetch the pseudo by stored id — but that always fails if the row is deleted. Instead, store the pseudo alongside the player id.

**Alternative from RESEARCH.md:** The CONTEXT.md (D-14) says to pre-populate with the old name. The stored `player_id` is a UUID — there is no pseudo stored in localStorage. The clean implementation: add a `useEffect` that, when `code` is set from searchParams, reads `getPlayerId(code)` and if found, queries the DB for that player's `pseudo`. If the player still exists, the existing reconnect path handles it. If the row is gone, the pseudo is unavailable from localStorage alone.

**Recommended pattern** — add a `storedPseudo` state populated on mount:
```typescript
const [storedPseudo, setStoredPseudo] = useState<string | null>(null)

useEffect(() => {
  const c = searchParams.get('code')
  if (!c) return
  const upperCode = c.toUpperCase()
  setCode(upperCode)
  const pid = getPlayerId(upperCode)
  if (!pid) return
  // Check if this player still exists to fetch their pseudo
  supabase.from('players').select('pseudo').eq('id', pid).maybeSingle()
    .then(({ data }) => {
      if (data?.pseudo) {
        setStoredPseudo(data.pseudo)
        setPseudo(data.pseudo)  // pre-populate
      }
    })
}, [searchParams])
```

Add hint text when pre-populated:
```tsx
{storedPseudo && pseudo === storedPseudo && (
  <p className="text-xs" style={{ color: '#888', fontFamily: 'var(--font-body)' }}>
    {fr.join.pseudo_prefilled_hint}
  </p>
)}
```

---

### `supabase/migrations/003-pseudo-unique.sql` (migration, CRUD)

**Analog:** `supabase/schema.sql` idempotent index pattern (lines 173–175):
```sql
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms (last_activity);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players (room_id);
```

**New migration file** — uses `DO $$ IF NOT EXISTS $$` guard because `CREATE UNIQUE INDEX IF NOT EXISTS` syntax is not available for expression indexes in all PG versions, and the idempotent `DO` block is the established project pattern for conditional DDL:
```sql
-- Phase 03: Pseudo uniqueness per room (case-insensitive)
-- Prevents two players in the same room from having the same pseudo, regardless of case.
-- Uses CREATE UNIQUE INDEX (not ADD CONSTRAINT) because PostgreSQL does not support
-- expression-based constraints via ALTER TABLE ADD CONSTRAINT.
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

**Also update `supabase/schema.sql`** — add this block after the existing `CREATE INDEX IF NOT EXISTS idx_players_room_id` line (line 175), following the same idempotent pattern.

---

## Shared Patterns

### Constants at top of hook/file
**Source:** `lib/usePresence.ts` lines 8–11
**Apply to:** `lib/usePresence.ts` GRACE_MS and HEARTBEAT_MS changes
```typescript
const GRACE_MS = 60_000    // → change to 15_000
const HEARTBEAT_MS = 120_000 // → change to 30_000
```

### Supabase realtime broadcast channel — emit pattern
**Source:** `app/room/[code]/game/page.tsx` lines 1660–1662
**Apply to:** new `player_joined` broadcast emit
```typescript
await voteChannelRef.current?.send({
  type: 'broadcast', event: 'vote_count', payload: { count, round: gs!.round },
})
// New event follows same shape:
await voteChannelRef.current?.send({
  type: 'broadcast', event: 'player_joined', payload: { pseudo: '...' },
})
```

### Supabase error code handling
**Source:** `app/join/page.tsx` lines 67–73 (existing `playerError` block)
**Apply to:** new `23505` branch in join page
```typescript
if (playerError || !player) {
  console.error('[joinRoom] player insert failed:', playerError)
  alert(fr.join.join_error)
  setLoading(false)
  return
}
```

### i18n hook convention
**Source:** Every component — `const fr = useT()` at top of component body
**Apply to:** All components receiving new i18n keys — no change to pattern needed

### `playersRef.current` vs `players` state for snapshots
**Source:** `app/room/[code]/game/page.tsx` — `playersRef` is set synchronously in INSERT/DELETE handlers (lines 1563, 1572, 1583)
**Apply to:** All places that snapshot `vote_round_player_count` — use `playersRef.current.length`, not `players.length`, to avoid stale closure (Pitfall 4 in RESEARCH.md)

---

## No Analog Found

All files in this phase have existing analogs. No new patterns need to be sourced from RESEARCH.md alone.

---

## Backward Compatibility Guards

These are not new files but critical runtime guards required by all plans touching the new `GameState` fields:

| Field | Undefined guard | Where |
|---|---|---|
| `gs.vote_round_player_count` | `const threshold = gs.vote_round_player_count \|\| players.length` | `submitVote`, `submitChoice`, `resolveOnShrinkRef` |
| `gs.round_started_at` | `gs.round_started_at ? Math.floor(...) : 0` | `VoteTimer` call sites |

These guards ensure in-flight games from before Phase 3 deployment do not break.

---

## Metadata

**Analog search scope:** `lib/`, `app/room/[code]/`, `app/join/`, `supabase/`
**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-06-10
