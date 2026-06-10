---
status: diagnosed
trigger: "After quitting from the lobby, returning to /join?code=XXXX pre-fills the old pseudo (editable, explicit submit still required). UAT test 4 (SC-4): the pseudo field was empty (no pre-fill at all)."
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Focus

hypothesis: onQuit clears the stored player id AND deletes the player row, so the /join storedPseudo prefetch has neither an id to look up nor a row to read → input stays empty. Pre-fill must persist the last-used pseudo independently of the player id/row.
test: Trace the prefetch dependency chain in app/join/page.tsx against onQuit in lobby/page.tsx and the storage helpers in lib/utils.ts.
expecting: The prefetch is keyed entirely off getPlayerId(code); onQuit calls clearPlayerId(code) before navigating away → getPlayerId returns null on return → prefetch early-returns. Confirms the hypothesis.
next_action: Confirm by reading the exact prefetch source and confirm there is no independent pseudo persistence anywhere.

## Symptoms

expected: Quit from the lobby (Quitter), then open /join?code=XXXX. The pseudo input is pre-filled with the old name and the hint is shown; the input is editable and joining requires an explicit submit.
actual: The pseudo field is empty (no pre-fill at all).
errors: None reported.
reproduction: Test 4 in .planning/phases/03-playtest-quality-fixes/03-UAT.md — quit from lobby via "Quitter", then open /join?code=XXXX.
started: Discovered during Phase 03 UAT (feature never worked as specified for the post-quit path).

## Eliminated

<!-- none yet -->

## Evidence

- timestamp: 2026-06-10T00:00:00Z
  checked: app/join/page.tsx lines 19-33 (storedPseudo prefetch effect)
  found: "The prefetch reads `const pid = getPlayerId(upperCode)`; if `!pid` it returns immediately (line 25). Otherwise it queries `players.select('pseudo').eq('id', pid)` and only sets the pseudo from `data.pseudo`. There is NO other source of the pre-fill — it depends entirely on (a) a stored player id existing AND (b) the matching player row still existing in the DB."
  implication: "Both inputs to the pre-fill are destroyed by a quit. The pre-fill has no fallback that survives a quit."

- timestamp: 2026-06-10T00:00:00Z
  checked: app/room/[code]/lobby/page.tsx lines 124-142 (onQuit)
  found: "onQuit runs `clearPlayerId(code)` (line 128) THEN `await supabase.from('players').delete().eq('id', myId)` (line 129), then navigates to '/'. So on quit BOTH the localStorage id is removed AND the player row is deleted."
  implication: "After a quit: getPlayerId(code) → null (id cleared) AND the row is gone. The prefetch's two preconditions are both false."

- timestamp: 2026-06-10T00:00:00Z
  checked: lib/utils.ts lines 31-51 (getPlayerId / setPlayerId / clearPlayerId)
  found: "Identity is stored under `kluup_pid_<CODE>` in localStorage (mirrored to legacy sessionStorage 'player_id'). clearPlayerId removes BOTH. There is NO separate persistence of the pseudo text anywhere — the only place the pseudo lives across reloads is the players.pseudo column in the DB, reachable only via the player id."
  implication: "The pseudo is never stored client-side independently of the (now-deleted) row. Confirms there is no surviving source for the pre-fill after a quit."

- timestamp: 2026-06-10T00:00:00Z
  checked: Ordering of clearPlayerId vs the prefetch (cross-page, cross-navigation)
  found: "onQuit runs clearPlayerId synchronously BEFORE router.push('/'). The /join prefetch runs only later, on a fresh navigation to /join?code=XXXX. So clearPlayerId has definitively completed before the prefetch effect runs — the prefetch reads null. (Even the row delete completes via `await` before navigation, but the id-clear alone is already sufficient to make the prefetch early-return at line 25.)"
  implication: "The empty field is deterministic, not a race. getPlayerId returns null → prefetch returns at line 25 → setPseudo is never called → input stays ''."

## Resolution

root_cause: "The /join pseudo pre-fill (app/join/page.tsx, effect at lines 19-33) is sourced ENTIRELY from getPlayerId(code) → a players-table lookup by that id. The lobby's onQuit (app/room/[code]/lobby/page.tsx lines 124-142) destroys BOTH of those inputs: it calls clearPlayerId(code) (removes the kluup_pid_<CODE> localStorage key) AND deletes the player row. After a quit, getPlayerId(code) returns null, so the prefetch early-returns at line 25 and never sets the pseudo → the field is empty. The last-used pseudo is never persisted independently of the player id/row, so a quit (which intentionally clears the id and deletes the row) leaves the pre-fill with nothing to read. The pre-fill design only works for the browser-close/reopen reconnect path (where the id and row survive), NOT for the explicit-quit path that SC-4 specifies."
fix: ""
verification: ""
files_changed: []
