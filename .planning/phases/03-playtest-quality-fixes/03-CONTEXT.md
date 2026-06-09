# Phase 3: Playtest Quality Fixes - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 9 core game bugs and UX issues surfaced during real playtest sessions — presence/phantom-player lifecycle, pseudo uniqueness, timer state on refresh, mid-round join handling, Type C logic, room cleanup, lobby quit button, landing page copy. No new features. No auth changes. The anonymous game flow must keep working exactly as before.

</domain>

<decisions>
## Implementation Decisions

### Pseudo Uniqueness
- **D-01:** Pseudos are unique per room (case-insensitive). Add a `UNIQUE` constraint on `LOWER(pseudo)` scoped to `room_id` in the DB (e.g. `UNIQUE(room_id, LOWER(pseudo))` or a partial unique index). No client-side pre-check — server is the single source of truth.
- **D-02:** On conflict: block the join entirely with a clear message — *"Ce pseudo est déjà pris, choisis-en un autre."* No auto-suffix, no workaround offered.
- **D-03:** The constraint is case-insensitive: "Nico" and "nico" are the same pseudo. Store pseudo as typed (for display), compare lowercase.

### Player Presence & Disconnection
- **D-04:** Grace period reduced from 60s to **15s**. A player who closes their tab is removed after 15s. Phone screen-lock: if the player reopens within 15s, the heartbeat resumes and they stay in the room.
- **D-05:** When the last connected player is removed (via presence cleanup or explicit quit), the room is **immediately deleted** (CASCADE → players + votes). No extra delay.
- **D-06:** The "elected advancer" mechanism (smallest `player.id`) already handles the pruning logic in `lib/usePresence.ts` — reduce its threshold from 60s to 15s.

### Timer State on Refresh
- **D-07:** Add `round_started_at: string` (ISO timestamp) to the `GameState` type in `lib/types.ts`. Set it when a new voting phase begins (alongside setting the phase). Clients calculate remaining time as `30 - (Date.now() - new Date(round_started_at).getTime()) / 1000`, clamped to [0, 30].
- **D-08:** Existing votes are already in the DB — after refresh, vote counts are refetched via the broadcast mechanism (`phase_changed` → refetch). This restores the correct vote count without extra work.

### Mid-Round Player Join
- **D-09:** A player who joins while a vote round is active is admitted to the roster but **excluded from the current round's vote threshold**. The threshold (snapshot of `players.length`) is taken when the voting phase starts and stored in `game_state` as `vote_round_player_count: number`. Newly joined players are counted starting from the next round.
- **D-10:** When a player joins mid-round, **broadcast a notification** visible to all players: *"[Pseudo] a rejoint la partie"*. Use the existing `broadcast` channel (`votes-broadcast-${id}`), new event type `player_joined`.

### Type C — 0 Volunteers Fix
- **D-11:** The "répond à voix haute" message on the `round_c_volunteers_reveal` screen must only appear when `volunteer_player_ids.length >= 1`. When `volunteer_player_ids.length === 0`, the game transitions directly to `round_c_roulette` (designation by vote/random). No "répond à voix haute" text when 0 volunteers — this path never has volunteers.

### Room Lifecycle
- **D-12:** The existing `cleanup_dead_rooms()` RPC (TTL 30min, `last_activity`) stays in place as a safety net. The new behavior (D-05) is the primary cleanup trigger when the last player leaves actively.

### Lobby Quit Button
- **D-13:** Add the "Quitter" button to the lobby page (`app/room/[code]/lobby/page.tsx`), same behavior as in-game: host transfer to oldest remaining player if others present, room deletion if last player.

### Pseudo Retention on Rejoin
- **D-14:** On the `/join` page, when a `player_id` is found in localStorage for a given room code but the player's pseudo is no longer in the roster (player quit), the join flow presents the pseudo input **pre-populated with the old name but editable**. The player must confirm (submit) — not silently reuse the cached pseudo.

### Landing Page Copy
- **D-15:** Replace hardcoded "3 à 10 joueurs" (or equivalent) with *"conseillé entre 3 et 10 joueurs"* (or i18n equivalent across FR/EN/ES/DE). This is a copy fix only — no logic change.

### Claude's Discretion
- SQL approach for pseudo uniqueness: add a migration file (`supabase/migrations/003-pseudo-unique.sql`) + update `supabase/schema.sql` idempotently.
- `vote_round_player_count` field placement in `GameState` — add alongside `round_started_at` in the same migration of `lib/types.ts`.
- Broadcast event shape for `player_joined` notification: `{ type: 'player_joined', pseudo: string }`.
- Toast/snackbar vs inline banner for the join notification: Claude's choice — keep it subtle (2–3s toast, non-blocking).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Engine & State
- `lib/types.ts` — `GameState` interface; add `round_started_at: string` and `vote_round_player_count: number`
- `lib/game.ts` — `makeInitialGameState()`, `pickCandidates`, vote resolution logic; `round_started_at` must be initialized to `''` and `vote_round_player_count` to `0`
- `app/room/[code]/game/page.tsx` — full game page: all phase transitions, vote resolution, `VoteTimer`, roster management; snapshot `vote_round_player_count` when each voting phase starts

### Presence & Player Lifecycle
- `lib/usePresence.ts` — `useRoomPresence(roomId, myId)`: heartbeat + prune logic; reduce grace from 60s to 15s
- `lib/utils.ts` — `getPlayerId`/`setPlayerId`/`clearPlayerId`: localStorage identity per room; referenced in D-14

### DB Schema
- `supabase/schema.sql` — source of truth; update with pseudo uniqueness constraint
- `CLAUDE.md` §"Modèle de données" — `players` table spec, `host_id NOT NULL` constraint on prod, RLS policies (must stay open)
- `CLAUDE.md` §"Cycle de vie des rooms" — existing cleanup / presence / quit logic to not regress

### Pages Affected
- `app/room/[code]/lobby/page.tsx` — add quit button (D-13)
- `app/join/page.tsx` — pre-populate pseudo on rejoin (D-14)
- `app/page.tsx` — landing page copy fix (D-15)

### Realtime
- `CLAUDE.md` §"Temps réel" — broadcast channel naming (`votes-broadcast-${id}`); new `player_joined` event follows same pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/usePresence.ts` `useRoomPresence` — the 60s grace period is a constant; reducing to 15s is a one-line change
- Existing broadcast channel `votes-broadcast-${id}` — already used for `vote_count` and `phase_changed` events; `player_joined` is a new event type on the same channel
- Quit button already implemented in-game (`RoundHeader`) — copy the behavior to the lobby page
- `VoteTimer` component — already keyed by `gs.round`; needs to initialize from `round_started_at` when mounting after a refresh

### Established Patterns
- All `GameState` fields initialized in `makeInitialGameState()` — `round_started_at` and `vote_round_player_count` follow this pattern
- Vote resolution threshold: currently `count >= players.length` — must change to `count >= gs.vote_round_player_count` for voting phases
- Pseudo uniqueness: currently no constraint — new `UNIQUE` index scoped to `(room_id, LOWER(pseudo))` is a clean addition; no FK changes

### Integration Points
- Each voting phase start (`voting_question`, `round_a_vote`, `round_b_vote`, `round_c_choice`) must set `round_started_at = new Date().toISOString()` and `vote_round_player_count = players.length`
- `updateRoomGameState` in `lib/game.ts` is the write path for all `game_state` updates — new fields flow through it automatically
- Type C reveal logic: `round_c_volunteers_reveal` guard `volunteer_player_ids.length >= 1` before showing "répond à voix haute"

</code_context>

<specifics>
## Specific Ideas

- The mid-round join notification should be visible to all players, non-blocking (toast style, ~3s), and say *"[Pseudo] a rejoint la partie"* (i18n: `playerJoined` key needed in all 4 languages).
- The 15s grace period must not regress the phone-lock scenario: if a player locks their screen and unlocks within 15s, they stay in the room. The heartbeat interval (currently 2min) should be reviewed — consider dropping to 30s so the presence signal is fresher.
- The pseudo uniqueness constraint must be scoped to `room_id` — global uniqueness would be too restrictive (two different rooms can have a "Nico").
- `round_started_at` client-side calculation: clamp to 0 so a refreshing player who joins very late in a round sees `0s` remaining (not negative), and the timer auto-advances via the normal `onForce` path.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-playtest-quality-fixes*
*Context gathered: 2026-06-10*
