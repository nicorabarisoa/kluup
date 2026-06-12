# UX Patch: Lobby Flash + Replay Choice

**Date:** 2026-06-12
**Status:** Approved
**Scope:** Two pre-existing UX bugs surfaced in Phase 5 UAT (tests 5 & 6)

---

## Bug 1 — Flash of lobby before name form on /join

### Problem

When a new player arrives at `/room/{code}/lobby` via a shared link (no localStorage entry for this room), the lobby renders its full UI for a few milliseconds before the async `loadRoom()` check fires, detects no player ID, and redirects to `/join?code={code}`.

### Fix

`app/room/[code]/lobby/page.tsx`:

- Add `const [loading, setLoading] = useState(true)`
- In `loadRoom()`, call `setLoading(false)` on the happy path (just before `setPlayers(data)`)
- Early-return redirect paths don't need it (they navigate away immediately)
- Render guard: `if (loading) return null` — blank dark screen for the few ms before the check resolves

No i18n changes. No new state beyond the loading flag.

---

## Bug 2 — Host "Rejouer" forces all players to lobby

### Problem

`returnToLobby()` sets `status='waiting', game_state=null`. An effect in the game page watches `room.status` and auto-redirects all clients to `/room/{code}/lobby` when status is no longer `'playing'` or `'ended'`. Result: every player is forced to the lobby the moment the host taps "Rejouer", with no choice to leave.

### Desired behaviour

When the host taps "Rejouer" at the end screen, all players stay on their end screen. The host navigates to lobby explicitly. A "Rejouer" button appears for non-host players only after status becomes `'waiting'` (i.e. after the host triggers it). Each non-host player navigates when they're ready. Players who want to leave tap "Quitter" (host-transfer logic already works via the existing `onQuit`).

### Fix

**`returnToLobby()` — game page:**

Two changes: (1) remove `game_state: null` — redundant since `startGame()` writes a fresh game_state; clearing it here destroys the end screen for non-host clients. (2) Add explicit `router.push` so the host navigates themselves (the phaseRef guard below prevents the auto-redirect from firing for anyone on the ended phase).

```js
async function returnToLobby() {
  if (!room || !isHost) return
  await supabase.from('rooms').update({ status: 'waiting' }).eq('id', room.id)
  await voteChannelRef.current?.send({ type: 'broadcast', event: 'phase_changed', payload: {} })
  router.push(`/room/${code}/lobby`)
}
```

**Auto-redirect effect — game page:**

Guard the redirect with a `phaseRef` that tracks the current phase in real time (same pattern as the existing `roomRef`). When any client is on the end screen and `status` becomes `'waiting'`, skip the auto-redirect — they navigate themselves via their own "Rejouer" button.

```js
const phaseRef = useRef<string | undefined>(undefined)
useEffect(() => { phaseRef.current = gs?.phase }, [gs?.phase])

useEffect(() => {
  if (room && room.status !== 'playing' && room.status !== 'ended') {
    if (phaseRef.current !== 'ended') {
      router.replace(`/room/${code}/lobby`)
    }
  }
}, [room?.status])
```

**EndScreen — add `roomStatus` prop:**

EndScreen needs `room.status` to gate the non-host "Rejouer" button. Add `roomStatus: string` to its props and pass it at the game page render call.

- **Host button:** always visible on the end screen; tapping calls `onNewRound` (`returnToLobby`) which sets status and navigates.
- **Non-host button:** appears only after `roomStatus === 'waiting'` (after the host has triggered the replay). Navigating to lobby while `status='ended'` would bounce non-hosts back to the game page (lobby guard), so this gate is load-bearing.

```jsx
// Game page render:
<EndScreen ... roomStatus={room.status} />

// EndScreen footer:
{isHost
  ? <GhostBtn onClick={onNewRound}>{fr.end.new_round}</GhostBtn>
  : roomStatus === 'waiting' && <GhostBtn onClick={() => router.push(`/room/${code}/lobby`)}>{fr.end.new_round}</GhostBtn>
}
```

The existing `fr.end.new_round` i18n key covers the label for both. No new keys needed.

**No i18n changes.** No new DB fields. No new i18n keys.

---

## What is NOT changed

- Host-transfer logic on quit (`onQuit`) — already works correctly
- The lobby's player-entry guard — unchanged
- `startGame()` — already writes fresh `game_state`; no change needed
- The `status='ended'` → end-screen render path — unchanged

---

## Out of scope

- A "waiting for others" indicator on the lobby after the host navigates (nice-to-have)
- Any overlay/prompt asking non-host players explicitly ("L'hôte veut rejouer") — opt-in navigation is sufficient
