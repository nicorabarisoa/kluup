---
status: diagnosed
trigger: "After a mid-round refresh, the vote timer shows the remaining time (~30 − elapsed), not a fresh 30s. UAT test 5: 'timer resets to 30 on refresh (no resync)'"
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — the resync code is correct locally but absent from the deployed/remote branch (24 unpushed Phase-03 commits); secondarily, pre-Phase-3 in-flight game rows lack round_started_at and hit the falsy fallback.
test: Git ancestry + `git show origin/main:<files>` grep for initialSecs/round_started_at; trace all four VoteTimer call sites and all round_started_at writes.
expecting: origin/main lacks the field+prop → confirmed (0 occurrences each). All four local call sites correctly wire initialSecs → confirmed.
next_action: Diagnosis complete. Hand to gap-planning: push+redeploy Phase-03 branch so prod contains 204207c, then re-run UAT-5.

## Symptoms

expected: Refresh browser during a 30s vote timer → timer re-initializes to ~(30 − elapsed)s, not fresh 30s. Previously cast votes still count.
actual: On refresh the timer resets to a full 30s (no resync).
errors: None reported.
reproduction: Test 5 in .planning/phases/03-playtest-quality-fixes/03-UAT.md. Refresh browser mid vote timer.
started: Discovered during Phase 03 UAT (round_started_at + VoteTimer initialSecs feature just added).

## Eliminated

## Evidence

- timestamp: investigation
  checked: All four VoteTimer call sites (game/page.tsx lines 482-485, 514-516, 719-722, 909-912)
  found: ALL four (question_selection, designation, confession, Type C choice) compute initialSecs = Math.max(0, 30 - elapsed) where elapsed derives from gs.round_started_at, and ALL pass initialSecs to <VoteTimer key={`vt-${gs.round}`} ... initialSecs={initialSecs} />. Hypothesis (b) REFUTED for all phases — every call site wires initialSecs.
  implication: The wiring is present everywhere. If the timer shows 30, either round_started_at is empty at mount (a) or elapsed computes ~0 (c).

- timestamp: investigation
  checked: All writes of round_started_at (grep). lobby/page.tsx:165 startGame; game/page.tsx:1734 resolveVotes question_selection transition; game/page.tsx:1857 onNextRound.
  found: startGame sets it for round-1 voting_question. resolveVotes question_selection sets it on the transition INTO round_a_vote/round_b_vote/round_c_choice. onNextRound sets it for the next round's voting_question. Reveal transitions carry it forward via {...gs} (no timer there, irrelevant).
  implication: In the standard flow every TIMER-bearing phase has a non-empty round_started_at written to the DB. So (a) is NOT a general failure.

- timestamp: investigation
  checked: Date math — node sanity test of Math.floor((Date.now() - new Date(round_started_at).getTime())/1000).
  found: With a populated ISO timestamp, elapsed is correct (8s elapsed → initialSecs 22). With round_started_at === '' the IIFE guard returns elapsed 0 → initialSecs 30 (full reset). The empty-string path reproduces the EXACT symptom.
  implication: The symptom is produced precisely when round_started_at is '' at the first VoteTimer mount. (c) timezone/parse REFUTED — parse is correct.

- timestamp: investigation
  checked: VoteTimer component (lines 301-354). const [secs, setSecs] = useState(initialSecs). initialSecs consumed ONLY at first mount. Element key = `vt-${gs.round}`.
  found: On a real browser refresh the whole React tree remounts, so VoteTimer is a fresh instance and DOES read the freshly-derived initialSecs at mount — PROVIDED gs.round_started_at is populated at that first paint. The key `vt-${gs.round}` is irrelevant to refresh (round is stable); it only matters for in-app round changes.
  implication: Refresh resync hinges entirely on round_started_at being non-empty in the DB game_state for the phase being refreshed.

- timestamp: investigation
  checked: Phase 03 STATE.md decision (line 52): "VoteTimer initialSecs derived from round_started_at elapsed time, clamped [0,30] with NaN guard for pre-Phase3 in-flight games". And makeInitialGameState (lib/game.ts:96) initializes round_started_at: ''.
  found: The guard `gs.round_started_at ? ... : 0` is an EMPTY/falsy guard. An in-flight game that was STARTED before this Phase-03 deploy (game_state already in DB with round_started_at undefined/'') hits the fallback → 30. UAT was run immediately after the Phase-03 build on a room that may have been created/advanced through code paths still missing the write, OR the tester refreshed in the round_c_choice / a reveal-adjacent state.
  implication: Need to pin which phase the tester actually refreshed in. The dominant, reproducible-by-design cause: the FIRST screen of round 1 (voting_question) DOES carry round_started_at from startGame, so a clean round-1 refresh should resync. The failure path is the Type C choice phase OR a stale/pre-Phase-3 game_state OR a stale DEPLOY.

- timestamp: investigation — DECISIVE
  checked: Git ancestry. origin/main = f9c8db5. Local HEAD = 86e984b (Phase 03 UAT). `git rev-list --count origin/main...HEAD` = 0 left / 24 right → HEAD is 24 commits AHEAD of origin, origin has 0 unique commits.
  found: The ENTIRE Phase-03 chain (9ed02e9 'add round_started_at to GameState' … 204207c 'refresh-safe VoteTimer' … 86e984b) is LOCAL-ONLY, never pushed. `git merge-base --is-ancestor 204207c f9c8db5` = NO → the refresh-safe VoteTimer commit is NOT in origin/main. `git show origin/main:app/room/[code]/game/page.tsx | grep -c initialSecs` = 0 and `git show origin/main:lib/types.ts | grep -c round_started_at` = 0 → the deployed/remote branch has NEITHER the GameState field NOR the initialSecs wiring.
  implication: Prod (Railway builds from the pushed remote) is running code with NO round_started_at field and NO initialSecs prop — i.e. the OLD VoteTimer that always useState(30). If UAT-5 was executed against the deployed prod URL (kluup.app), the timer ALWAYS resets to 30 on refresh because the resync feature simply isn't there. The local working-tree code (HEAD) is correct and WOULD resync.

- timestamp: investigation
  checked: Local working tree app/room/[code]/game/page.tsx grep initialSecs = 10 occurrences; HEAD identical. lib/game.ts makeInitialGameState initializes round_started_at: '' (line 96). The empty-string '' value is the makeInitialGameState default, but startGame/resolveVotes/onNextRound all OVERWRITE it with a real ISO timestamp before any timer-bearing phase is shown.
  found: In the local code, the only way round_started_at stays '' at a timer mount is an in-flight game whose game_state was persisted to the DB by an OLD build (before Phase 03) and then refreshed under the NEW build. makeInitialGameState '' never reaches a timer because every voting-phase entry overwrites it.
  implication: Two concrete root-cause scenarios, both fully consistent with the symptom: (1) PRIMARY — UAT ran against stale prod that lacks the feature entirely; (2) SECONDARY — a game row started under the pre-Phase-03 schema (round_started_at absent/'' in the stored jsonb) was refreshed under new code → falsy-guard fallback to 30. Both yield exactly "timer resets to 30 on refresh".

## Resolution

root_cause: |
  The refresh-safe VoteTimer logic is CORRECT in the local code but ABSENT from the running build the UAT exercised. The entire Phase-03 commit chain — including 204207c "refresh-safe VoteTimer + snapshot-based vote threshold" and 9ed02e9 which adds the round_started_at field to GameState — is local-only (24 unpushed commits; HEAD=86e984b, origin/main=f9c8db5). `git merge-base --is-ancestor 204207c f9c8db5` = NO. origin/main's app/room/[code]/game/page.tsx has 0 occurrences of initialSecs and lib/types.ts has 0 occurrences of round_started_at. Railway builds from the pushed remote, so production runs the OLD VoteTimer that does `useState(30)` unconditionally → every refresh shows a fresh 30s. SECONDARY (data) path: any game row whose game_state jsonb was written by a pre-Phase-03 build stores no round_started_at; when refreshed under the new code, the falsy guard `gs.round_started_at ? ... : 0` yields elapsed 0 → initialSecs 30. Both paths produce the exact reported symptom. The makeInitialGameState default of '' (lib/game.ts:96) is harmless because every timer-bearing phase (voting_question via startGame/onNextRound; round_a_vote/round_b_vote/round_c_choice via resolveVotes question_selection) overwrites it with a real ISO timestamp on entry.
fix: |
  (NOT APPLIED — find_root_cause_only mode.) Suggested direction:
  1. PRIMARY: push the Phase-03 branch and redeploy so prod actually contains 204207c (the resync code). Verify the deployed bundle contains `initialSecs`. Without this, no code change to the timer can ever take effect in prod.
  2. SECONDARY (robustness): keep the existing `gs.round_started_at ? ... : 0` guard (it is the correct backward-compat fallback for pre-Phase-3 in-flight rows). Optionally, when a timer-bearing phase is encountered with an empty round_started_at, lazily stamp it on first observation so legacy in-flight games at least anchor from the refresh moment instead of perpetually restarting — minor, not required for SC-5.
  3. Re-run UAT-5 against the redeployed build (or a local `next start` of HEAD, which already passes by construction).
verification: pending re-test after deploy
files_changed: []
