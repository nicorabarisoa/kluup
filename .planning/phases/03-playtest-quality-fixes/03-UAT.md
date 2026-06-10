---
status: complete
phase: 03-playtest-quality-fixes
source: [03-VERIFICATION.md]
started: "2026-06-10T00:00:00Z"
updated: "2026-06-10T00:00:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Duplicate pseudo rejected (SC-1)
expected: Second join (same pseudo, different case) shows the inline pseudo-taken error below the field; no alert dialog; first player unaffected; a different pseudo joins fine.
result: pass
note: "User: behavior works; inline-error UI should be restyled to fit the game theme (cosmetic polish, non-blocking)."

### 2. Screen-lock grace vs. tab-close prune (SC-2)
expected: Lock the screen / background the tab and return within 15s → player stays in the roster. Close the tab for more than 15s → the ghost row is pruned.
result: pass

### 3. Empty room auto-deleted (SC-3)
expected: In a 2-player game, both players quit/close tabs. After >15s the room no longer exists (join attempt on the code fails / DB row gone).
result: issue
reported: "not passed — room still joinable after 15s, host role not transferred, player not removed from the roster"
severity: major

### 4. Rejoin pre-fills old pseudo but requires explicit submit (SC-4)
expected: Quit from the lobby (Quitter), then open /join?code=XXXX. The pseudo input is pre-filled with the old name and the hint "Ton ancien pseudo est pré-rempli." is shown; the input is editable (not read-only) and joining requires an explicit submit.
result: issue
reported: "not passed — the pseudo field was empty (no pre-fill at all)"
severity: major

### 5. Mid-round refresh shows remaining timer (SC-5)
expected: Refresh the browser during a 30s vote timer. The timer re-initializes to roughly (30 − elapsed) seconds, not a fresh 30s. Previously cast votes still count.
result: issue
reported: "not pass — timer resets to 30 on refresh (no resync)"
severity: major

### 5b. Type C choice phase should not be on a vote timer (emergent design feedback)
expected: In the Type C "choice" phase (se porter volontaire / envoyer quelqu'un au bûcher) the round advances only once every player has acted (volunteer or designate) — a 30s vote timer there is wrong; without an action from everyone the round can't advance.
result: issue
reported: "pour le volontariat il ne devrait pas avoir un timer — soit on se porte volontaire soit ils votent, sinon ils peuvent pas passer à la manche suivante"
severity: major

### 6. Mid-round joiner doesn't distort threshold + join toast (SC-8)
expected: In a 3-player game with round 1 started, a 4th player joins mid-vote. The round still resolves on the 3 original votes (threshold stays 3, not 4). A toast pill ("<pseudo> a rejoint la partie") appears briefly top-center. The 4th player can vote from the next round on.
result: issue
reported: "not pass — the count goes from 0/3 to 0/4 mid-choice (threshold not frozen when a 4th player joins during the Type C choice phase)"
severity: major

## Summary

total: 7
passed: 2
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "A room with zero connected players is automatically deleted after the grace period (SC-3)"
  status: failed
  reason: "User reported: after both players left, the room is still joinable after >15s, the host role is not transferred, and the player is not removed from the roster. Symptom suggests the presence prune / last-player room-deletion (elected-pruner client in lib/usePresence.ts) does not fire when players leave — possibly because no surviving client remains to run the prune callback, and/or the tab-close (beforeunload) path does not clean up."
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "After quitting from the lobby, returning to /join?code=XXXX pre-fills the old pseudo (editable, explicit submit still required) (SC-4)"
  status: failed
  reason: "User reported: the pseudo field was empty (no pre-fill at all) when returning to /join after quitting from the lobby. Root cause likely: onQuit calls clearPlayerId() and deletes the player row, so the storedPseudo prefetch (which queries players.pseudo by the stored player id) has no id to look up — nothing to pre-fill. The pre-fill needs to persist the last-used pseudo independently of the player id/row (e.g. a separate localStorage key not cleared on quit)."
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "After a mid-round refresh, the vote timer shows the remaining time (~30 − elapsed), not a fresh 30s (SC-5)"
  status: failed
  reason: "User reported: on refresh the timer resets to 30s — no resync. round_started_at-based initialSecs derivation is not taking effect. Likely round_started_at is empty/not written for the active phase (NaN guard falls back to 30), or VoteTimer is not consuming the derived initialSecs at the relevant call site. Needs root-cause diagnosis across startGame/onNextRound/resolveVotes (where round_started_at is snapshotted) and the VoteTimer initialSecs wiring."
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "The Type C choice phase (volunteer / send-to-bûcher) advances when all players have acted, without a misapplied 30s vote timer"
  status: failed
  reason: "Emergent UAT feedback (not in original success criteria): the Type C choice phase should not carry a vote timer. DESIGN DECISION (user, 2026-06-10): REMOVE the 30s timer from the Type C choice phase entirely. The round resolves as soon as every present player has acted (volunteered or designated). The host's manual 'Passer sans attendre' force-button remains the only escape for AFK players (no automatic timer expiry on this phase). Implementation: do not render VoteTimer on the choice phase; ensure resolution triggers on actions == frozen player count; keep host force-path."
  severity: major
  test: 5b
  artifacts: []
  missing: []

- truth: "A player joining mid-round does not change the vote threshold for the current question (stays at the round-start count) (SC-8)"
  status: failed
  reason: "User reported: during the Type C choice phase, the count jumps from 0/3 to 0/4 when a 4th player joins — the threshold is NOT frozen. The vote_round_player_count snapshot is either not set on entry to the choice phase, or the UI denominator (the X/N display) uses live players.length instead of the snapshot. Matches code-review WR-02 (mid-round joiner / half-snapshot). Diagnose where the choice phase sets/reads vote_round_player_count and where the count denominator is rendered."
  severity: major
  test: 6
  artifacts: []
  missing: []
