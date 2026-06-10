---
status: diagnosed
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

## Diagnosis Note — DEPLOYMENT GAP (affects interpretation of all gaps)

The entire Phase-03 commit chain (~24 commits) is LOCAL-ONLY and was never pushed to `origin/main`. Railway deploys from `origin/main` (f9c8db5), which contains NONE of the Phase-03 fixes. The UAT was run against the live build → several "failures" are deployment artifacts, not code gaps. Each gap below is classified as REAL-LOCAL-GAP (broken in HEAD source too) vs DEPLOYMENT-ONLY (HEAD source is correct; needs push + redeploy).

## Gaps

- truth: "A room with zero connected players is automatically deleted after the grace period (SC-3)"
  status: diagnosed
  classification: real-local-gap (architectural)
  reason: "After both players left, room still joinable after >15s, host not transferred, player not removed."
  root_cause: "Tab-close cleanup is survivor-dependent. The prune+room-delete runs in a setTimeout(GRACE_MS) scheduled by ANOTHER connected client on a presence 'leave' event (key===myId returns early, so a client never self-prunes). When ALL clients close their tabs (the SC-3 scenario), no JS runtime survives to run any prune → rows, host transfer, and room delete never happen. There is NO beforeunload/pagehide/visibilitychange handler anywhere (tab close = zero DB writes). The only server reaper, cleanup_dead_rooms(), uses a 30-min threshold and is invoked only opportunistically on room creation (pg_cron commented out). SC-3's '>15s' tab-close guarantee is NOT achievable client-side."
  severity: major
  test: 3
  artifacts:
    - path: "lib/usePresence.ts"
      issue: "prune/room-delete is survivor-dependent; cannot fire for the last departing client; no self-prune; unmount teardown does no DB delete"
    - path: "supabase/lifecycle.sql"
      issue: "only reaper is 30-min threshold; pg_cron not scheduled"
    - path: "app/page.tsx"
      issue: "cleanup_dead_rooms() called only on room creation"
  decision: "APPROACH CHOSEN (user, 2026-06-10): pg_cron server sweep (~1 min). Enable pg_cron in Supabase, lower cleanup_dead_rooms() idle threshold from 30 min to ~60s, schedule it every minute. Relax SC-3 acceptance from '>15s' to '~1 min'. No pagehide beacon this pass."
  resolution: "SC-3 delivered via plan 03-08 (pg_cron sweep). Acceptance window relaxed from '>15s' to '~1 min (server sweep interval)'. supabase/lifecycle.sql updated: cleanup_dead_rooms() now uses interval '60 seconds'; pg_cron Block 5 schedules the sweep every minute (idempotent). No pagehide/beforeunload handler added (out of scope this pass). Requires human checkpoint: apply updated lifecycle.sql blocks to live Supabase DB and confirm cron job exists."
  missing:
    - "Lower cleanup_dead_rooms() idle threshold to ~60s in supabase/lifecycle.sql"
    - "Schedule cleanup_dead_rooms() via pg_cron every 1 min (uncomment/add the pg_cron block in lifecycle.sql) — requires applying to live Supabase (human checkpoint, like the 03-03 migration)"
    - "Relax SC-3 acceptance criterion from '>15s' to '~1 min' in ROADMAP/UAT"
  debug_session: .planning/debug/empty-room-not-deleted.md

- truth: "After quitting from the lobby, returning to /join?code=XXXX pre-fills the old pseudo (editable, explicit submit still required) (SC-4)"
  status: diagnosed
  classification: real-local-gap
  reason: "The pseudo field was empty (no pre-fill at all) when returning to /join after quitting."
  root_cause: "The /join pre-fill is sourced ENTIRELY from the stored player id: getPlayerId(code) → if null return → else query players.pseudo by id. onQuit (lobby) calls clearPlayerId(code) AND deletes the player row before navigating. So on return, getPlayerId is null, the effect early-returns, field stays empty. Deterministic (not a race). The pseudo text is never persisted client-side independently — it lives only in players.pseudo reachable solely via the id that quit clears."
  severity: major
  test: 4
  artifacts:
    - path: "app/join/page.tsx"
      issue: "pre-fill effect (lines ~19-33) depends solely on getPlayerId + row lookup; no id/row-independent fallback"
    - path: "app/room/[code]/lobby/page.tsx"
      issue: "onQuit (124-142) clears the id and deletes the row — wipes everything the pre-fill relies on"
    - path: "lib/utils.ts"
      issue: "no independent last-pseudo persistence helper"
  missing:
    - "Persist last-used pseudo independently (e.g. localStorage key kluup_pseudo_<CODE>), written on successful join alongside setPlayerId"
    - "Read that key as a fallback in the /join prefetch when getPlayerId is null / row lookup empty"
    - "Ensure clearPlayerId / onQuit do NOT clear the remembered-pseudo key (keep input editable, explicit submit)"
  debug_session: .planning/debug/rejoin-pseudo-prefill-empty.md

- truth: "After a mid-round refresh, the vote timer shows the remaining time (~30 − elapsed), not a fresh 30s (SC-5)"
  status: diagnosed
  classification: deployment-only (HEAD source is CORRECT)
  reason: "On refresh the timer reset to 30s."
  root_cause: "The refresh-safe VoteTimer logic is CORRECT in HEAD source — round_started_at is written by lobby startGame, onNextRound, and resolveVotes('question_selection'); all four VoteTimer call sites pass initialSecs = max(0, 30 - elapsed). The failure is the deployment gap: origin/main (deployed) has 0 occurrences of initialSecs / round_started_at, so prod runs the OLD VoteTimer (useState(30)) and resets on refresh. Local next build of HEAD passes by construction."
  severity: major
  test: 5
  artifacts:
    - path: "app/room/[code]/game/page.tsx"
      issue: "HEAD: correct (no fix needed). Deployed origin/main: lacks the feature entirely."
  missing:
    - "Push the Phase-03 branch and redeploy so prod contains the fix; re-test SC-5 against the redeployed build"
    - "Optional: lazily stamp round_started_at when a timer-bearing phase is observed empty (anchors pre-Phase-3 in-flight game rows)"
  debug_session: .planning/debug/timer-resets-on-refresh.md

- truth: "The Type C choice phase (volunteer / send-to-bûcher) advances when all players have acted, without a misapplied 30s vote timer"
  status: diagnosed
  classification: real-local-gap (design change)
  reason: "DESIGN DECISION (user, 2026-06-10): the Type C choice phase must have NO vote timer; it resolves when every present player has acted; host 'Passer' button is the only AFK fallback."
  root_cause: "ChoiceScreen unconditionally renders a 30s VoteTimer in its footer (game/page.tsx:908-912); on expiry the elected advancer fires onForce=resolveTypeCChoice (auto-skip), contradicting the decision."
  severity: major
  test: 5b
  artifacts:
    - path: "app/room/[code]/game/page.tsx"
      issue: "ChoiceScreen renders VoteTimer (IIFE at 908-912); isAdvancer prop becomes unused once removed"
  missing:
    - "Delete the VoteTimer IIFE at game/page.tsx:908-912 (leave VoteProgress 907 and HostSkipBtn 913)"
    - "Resolution already works: submitChoice triggers resolveTypeCChoice at actions==frozen count (timer-independent) — no change needed"
    - "Drop the now-unused isAdvancer prop from ChoiceScreen (cosmetic); verify host can still force-skip after acting"
  debug_session: .planning/debug/typec-choice-timer-and-threshold.md

- truth: "A player joining mid-round does not change the vote threshold for the current question (stays at the round-start count) (SC-8)"
  status: diagnosed
  classification: real-local-gap (WR-02 half-snapshot)
  reason: "During the Type C choice phase the count jumps 0/3 → 0/4 when a 4th player joins."
  root_cause: "Half-implemented freeze. Entry DOES set vote_round_player_count (resolveVotes question_selection, game/page.tsx:1734) and the actual resolve threshold uses the snapshot (submitChoice:1794, shrink re-eval:1912 — round still resolves at 3). BUT the X/N DISPLAY uses LIVE players.length: ChoiceScreen passes total={players.length} to VoteProgress (game/page.tsx:907), so a 4th joiner renders 0/4. The host skip-button gate (913) also uses live players.length."
  severity: major
  test: 6
  artifacts:
    - path: "app/room/[code]/game/page.tsx"
      issue: "line 907 total={players.length} (display denominator); line 913 host-skip gate voteCount < players.length — both ignore the snapshot"
  missing:
    - "game/page.tsx:907 → total={gs.vote_round_player_count || players.length}"
    - "game/page.tsx:913 gate → voteCount < (gs.vote_round_player_count || players.length)"
    - "Keep the || players.length fallback for pre-Phase-3 in-flight games"
  debug_session: .planning/debug/typec-choice-timer-and-threshold.md
