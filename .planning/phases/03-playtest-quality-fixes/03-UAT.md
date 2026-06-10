---
status: testing
phase: 03-playtest-quality-fixes
source: [03-VERIFICATION.md]
started: "2026-06-10T00:00:00Z"
updated: "2026-06-10T00:00:00Z"
---

## Current Test

number: 1
name: Duplicate pseudo (case-insensitive) is rejected with an inline message
expected: |
  Two players join the same room with the same pseudo in different case (e.g. "Nico" then "nico").
  The second join is rejected with the inline error under the pseudo field
  ("Ce pseudo est déjà pris, choisis-en un autre." or locale equivalent) — no alert dialog,
  first player unaffected. Joining with a different pseudo succeeds.
awaiting: user response

## Tests

### 1. Duplicate pseudo rejected (SC-1)
expected: Second join (same pseudo, different case) shows the inline pseudo-taken error below the field; no alert dialog; first player unaffected; a different pseudo joins fine.
result: [pending]

### 2. Screen-lock grace vs. tab-close prune (SC-2)
expected: Lock the screen / background the tab and return within 15s → player stays in the roster. Close the tab for more than 15s → the ghost row is pruned.
result: [pending]

### 3. Empty room auto-deleted (SC-3)
expected: In a 2-player game, both players quit/close tabs. After >15s the room no longer exists (join attempt on the code fails / DB row gone).
result: [pending]

### 4. Rejoin pre-fills old pseudo but requires explicit submit (SC-4)
expected: Quit from the lobby (Quitter), then open /join?code=XXXX. The pseudo input is pre-filled with the old name and the hint "Ton ancien pseudo est pré-rempli." is shown; the input is editable (not read-only) and joining requires an explicit submit.
result: [pending]

### 5. Mid-round refresh shows remaining timer (SC-5)
expected: Refresh the browser during a 30s vote timer. The timer re-initializes to roughly (30 − elapsed) seconds, not a fresh 30s. Previously cast votes still count.
result: [pending]

### 6. Mid-round joiner doesn't distort threshold + join toast (SC-8)
expected: In a 3-player game with round 1 started, a 4th player joins mid-vote. The round still resolves on the 3 original votes (threshold stays 3, not 4). A toast pill ("<pseudo> a rejoint la partie") appears briefly top-center. The 4th player can vote from the next round on.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
