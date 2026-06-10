---
phase: 03-playtest-quality-fixes
plan: "05"
subsystem: join + lobby UX
tags: [join, lobby, error-handling, i18n, quit-button, rejoin, gamestate]
dependency_graph:
  requires:
    - 03-02 (pseudo_taken + pseudo_prefilled_hint i18n keys)
    - 03-03 (idx_players_pseudo_lower unique index — 23505 error source)
  provides:
    - inline pseudo-taken error in join page (23505 → fr.join.pseudo_taken)
    - rejoin pseudo pre-population with hint
    - lobby Quitter button (onQuit with host transfer / room deletion)
    - startGame sets round_started_at and vote_round_player_count before DB write
  affects:
    - app/join/page.tsx
    - app/room/[code]/lobby/page.tsx
tech_stack:
  added: []
  patterns:
    - "Postgres error code branching: playerError.code === '23505' → inline state, else alert"
    - "Rejoin pre-population: useEffect + supabase query on stored pid → setPseudo"
    - "Lobby onQuit mirrors game onQuit: clearPlayerId → delete player → check remaining → delete room or promote host"
key_files:
  modified:
    - app/join/page.tsx
    - app/room/[code]/lobby/page.tsx
decisions:
  - "pseudoError uses conditional render (not visibility:hidden) — no DOM node when hidden"
  - "storedPseudo query uses maybeSingle() — no crash if row is already gone after quit"
  - "Reconnect block (lines 62–71 in original) left unchanged — a returning player with a live row never reaches the insert, so the 23505 branch cannot fire on their own name"
  - "Lobby onQuit: no window.confirm — single tap, immediate action; consistent with in-game quit"
  - "round_started_at and vote_round_player_count set inline in startGame (not in makeInitialGameState) — factory has no access to players.length"
metrics:
  duration: "~2 min"
  completed: "2026-06-10T16:02:29Z"
  tasks_completed: 4
  files_modified: 2
---

# Phase 03 Plan 05: Join/Lobby UX Fixes Summary

**Wired 23505 inline pseudo-taken error, rejoin pseudo pre-population, lobby Quitter button (host transfer / room deletion), and startGame round_started_at + vote_round_player_count initialization.**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Inline pseudo-taken error (D-01, D-02, D-03) | 1e11568 | app/join/page.tsx |
| 2 | Pre-populate old pseudo on rejoin (D-14) | 1e11568 | app/join/page.tsx |
| 3 | Lobby Quitter button (D-13) | a9753cc | app/room/[code]/lobby/page.tsx |
| 4 | Set round_started_at and vote_round_player_count in startGame (SC-5) | a9753cc | app/room/[code]/lobby/page.tsx |

## Changes Summary

### app/join/page.tsx

**Task 1 — Inline pseudo-taken error:**
- Added `pseudoError` state (`useState<string | null>(null)`)
- Replaced `if (playerError || !player)` block with branched logic: `playerError.code === '23505'` → `setPseudoError(fr.join.pseudo_taken)`; other errors → `console.error` + `alert(fr.join.join_error)`; `!player` guard unchanged
- Code input `onChange`: added `setPseudoError(null)` alongside `setCode(...)`
- Pseudo input `onChange`: added `setPseudoError(null)` alongside `setPseudo(...)`
- Inline `{pseudoError && <p>}` below pseudo input: `text-xs`, `color: rgba(255,60,111,0.85)`, `fontFamily: var(--font-body)`
- Reconnect block (getPlayerId + existing-row reuse) unchanged — reconnecting players never reach the insert

**Task 2 — Rejoin pseudo pre-population:**
- Added `storedPseudo` state (`useState<string | null>(null)`)
- Mount `useEffect` now: if code present, reads `getPlayerId(upperCode)`; if pid found, queries `players.select('pseudo').eq('id', pid).maybeSingle()` and calls `setStoredPseudo(data.pseudo)` + `setPseudo(data.pseudo)` to pre-fill
- Defensive: `maybeSingle()` returns null if row gone — no crash
- Hint `{storedPseudo && pseudo === storedPseudo && <p>}` below pseudo input: `text-xs`, `color: #888`
- Input remains fully editable; join button still requires non-empty pseudo

### app/room/[code]/lobby/page.tsx

**Task 3 — Lobby Quitter button:**
- Added `clearPlayerId` to import from `@/lib/utils`
- Added `onQuit` async function: guard `if (!roomId || !myId)` → `router.push('/')`;
  `clearPlayerId(code)` → `delete player by myId` → fetch remaining →
  if 0 remaining: `delete room by roomId` (SC-3);
  else if `wasHost`: promote oldest by `created_at` via `update({ is_host: true })`;
  `router.push('/')`. No `window.confirm`.
- Header row changed from `justify-end` to `justify-between items-center`
- Quit button added as first child (left): `type="button"`, `text-xs font-medium px-3 h-8 rounded-xl`, `C.surface`/`C.border`/`C.muted` colors, `fr.game.quit` label
- LangSwitch stays on the right

**Task 4 — startGame round_started_at and vote_round_player_count:**
- After `gs.session_uuid = crypto.randomUUID()` and before `supabase.from('rooms').update(...)`:
  - `gs.round_started_at = new Date().toISOString()`
  - `gs.vote_round_player_count = players.length`
- Ensures VoteTimer computes accurate remaining seconds after a refresh during round 1 (SC-5)

## Deviations from Plan

None — plan executed exactly as written. All four tasks matched the action specs in 03-PATTERNS.md and 03-UI-SPEC.md.

## Known Stubs

None — no placeholder text, empty arrays, or unwired data sources.

## Threat Flags

None — no new network endpoints or auth paths. The `onQuit` function in lobby deletes only `myId` (own row), matching the existing in-game quit behaviour. RLS is open in the MVP (CLAUDE.md).

## Self-Check: PASSED

- app/join/page.tsx exists: FOUND
- app/room/[code]/lobby/page.tsx exists: FOUND
- Commit 1e11568 (join page): FOUND
- Commit a9753cc (lobby page): FOUND
- `pseudoError` state in join page: VERIFIED
- `playerError.code === '23505'` branch: VERIFIED
- `storedPseudo` state in join page: VERIFIED
- `maybeSingle()` query in useEffect: VERIFIED
- `clearPlayerId` import in lobby page: VERIFIED
- `onQuit` function in lobby page: VERIFIED
- `justify-between` header row in lobby: VERIFIED
- `fr.game.quit` quit button: VERIFIED
- `gs.round_started_at = new Date().toISOString()` in startGame: VERIFIED
- `gs.vote_round_player_count = players.length` in startGame: VERIFIED
- `npm run build` passed: VERIFIED
