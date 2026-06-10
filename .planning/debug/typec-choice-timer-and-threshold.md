---
status: diagnosed
trigger: "Issue 1 (SC-8): Type C choice phase count goes 0/3 -> 0/4 mid-choice (threshold not frozen when a 4th player joins). Issue 2 (5b): Type C choice phase must have NO vote timer; resolve on actions == frozen-count, host force-button only AFK fallback."
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Focus

hypothesis: Both issues are real LOCAL-code gaps in ChoiceScreen (app/room/[code]/game/page.tsx lines 891-960), independent of the deployment gap.
test: Read local source as source of truth; trace snapshot set/read at choice-phase entry, display denominator, and resolution paths.
expecting: Issue 1 = display denominator uses live players.length; Issue 2 = VoteTimer rendered on choice phase.
next_action: diagnosis complete — return root causes (find_root_cause_only mode, no fix applied).

## Symptoms

expected:
  - Issue 1 (SC-8): A player joining mid-round does not change the vote threshold for the current question (stays at round-start count). Display should stay X/3 when a 4th joins.
  - Issue 2 (5b): Type C choice phase has NO vote timer; resolves when every present player has acted; host "Passer sans attendre" is the only AFK fallback.
actual:
  - Issue 1: "the count goes from 0/3 to 0/4 mid-choice (threshold not frozen when a 4th player joins during the Type C choice phase)"
  - Issue 2: A 30s VoteTimer is rendered on the choice phase (wrong by design decision).
errors: none
reproduction: UAT tests 6 and 5b in 03-UAT.md
started: discovered during Phase 03 UAT

## Evidence

- checked: lib/types.ts:84-88 (GameState.vote_round_player_count + round_started_at fields)
  found: vote_round_player_count documented as "Snapshot of players.length taken when the voting phase started; mid-round joiners are excluded from the current round's threshold (D-09). 0 means use players.length fallback." Field exists in LOCAL source.
  implication: The freeze mechanism is present in local code — the question is whether the choice phase sets it AND whether the display/threshold read it.

- checked: app/room/[code]/lobby/page.tsx:163-166 (startGame)
  found: makeInitialGameState always sets phase='voting_question'; startGame sets gs.round_started_at and gs.vote_round_player_count = players.length. First phase is ALWAYS question selection, never round_c_choice directly.
  implication: round_c_choice is only ever entered via resolveVotes('question_selection').

- checked: app/room/[code]/game/page.tsx:1727-1735 (resolveVotes question_selection -> round_c_choice transition)
  found: On transition to round_c_choice, the new state sets `round_started_at: new Date().toISOString(), vote_round_player_count: playersRef.current.length`. SNAPSHOT IS SET on choice-phase entry.
  implication: The frozen snapshot IS correctly written into game_state at choice-phase entry. The threshold value exists.

- checked: app/room/[code]/game/page.tsx:1788-1795 (submitChoice resolution threshold)
  found: `const threshold = gs!.vote_round_player_count || players.length; if (count >= threshold) await resolveTypeCChoice()`. The RESOLUTION threshold correctly uses the frozen snapshot.
  implication: The actual round-resolution logic IS frozen-count-correct. A 4th joiner does NOT raise the resolution threshold. The round still resolves on the 3 original acts.

- checked: app/room/[code]/game/page.tsx:1903-1917 (resolveOnShrinkRef host re-eval)
  found: Uses `count >= (gs.vote_round_player_count || players.length)`. Correct frozen snapshot on shrink path too.
  implication: Resolution is consistently frozen-correct across all paths.

- checked: app/room/[code]/game/page.tsx:907 (ChoiceScreen footer VoteProgress)
  found: `<VoteProgress count={voteCount} total={players.length} voted={hasVoted} />` — the DISPLAY denominator passes LIVE players.length, NOT gs.vote_round_player_count.
  implication: ROOT CAUSE of Issue 1 (display). When a 4th player joins, players.length becomes 4 -> the X/N pill renders 0/4. The threshold for resolution is still 3 (frozen), so the round WOULD still resolve on 3 acts — but the USER SEES 0/4, which is the reported symptom verbatim ("count goes from 0/3 to 0/4"). The displayed denominator and the resolution threshold disagree.

- checked: app/room/[code]/game/page.tsx:251-266 (VoteProgress) + lib/i18n waiting_for_votes
  found: VoteProgress renders `waiting_for_votes(shown, total)` = "X/N". total is exactly the prop passed in (players.length at the call site).
  implication: Confirms the denominator surfaced to the user is live players.length on the choice screen.

- checked: app/room/[code]/game/page.tsx:1913 (HostSkipBtn at line 913) `show={isHost && hasVoted && voteCount < players.length}`
  found: Even the host's "Passer sans attendre" visibility gate uses live players.length, not the frozen snapshot.
  implication: Secondary display/gating inconsistency — a mid-round joiner keeps the host's skip button visible (voteCount < 4) even after all 3 frozen participants have acted (voteCount == 3), although by then resolution would already have fired at threshold 3. Still worth aligning to the snapshot.

- checked: app/room/[code]/game/page.tsx:905-915 (ChoiceScreen footer VoteTimer)
  found: Footer renders `<VoteTimer key={vt-${gs.round}} isAdvancer={isAdvancer} onExpire={onForce} initialSecs={initialSecs} />` where onForce=resolveTypeCChoice (wired at line 1941). The 30s VoteTimer IS rendered on the choice phase.
  implication: ROOT CAUSE of Issue 2. Per the user's design decision (2026-06-10), the choice phase must have NO vote timer. This VoteTimer block (lines 908-912) must be removed.

- checked: app/room/[code]/game/page.tsx:301-321 (VoteTimer) + 1684-1686 (advancer election) + 1941 (onForce wiring)
  found: On timer expiry, the elected advancer (smallest player.id present) fires onExpire = onForce = resolveTypeCChoice. This is the AUTO-SKIP that the design decision wants removed. The host force path is separate: HostSkipBtn (line 913) calls onForce directly, and resolveTypeCChoice resolves with frozen threshold.
  implication: For Issue 2 fix, removing the VoteTimer also removes the advancer auto-skip. The host's "Passer sans attendre" (HostSkipBtn) remains as the only AFK fallback — exactly what the design decision specifies. resolveTypeCChoice itself is timer-independent and correct.

## Resolution

root_cause: |
  ISSUE 1 (SC-8 threshold display) — REAL LOCAL-CODE GAP (not merely a deployment artifact).
  The vote_round_player_count snapshot IS set on choice-phase entry (page.tsx:1734) and the
  RESOLUTION threshold correctly uses it (page.tsx:1794, 1912). The bug is purely in the
  DISPLAY denominator: ChoiceScreen passes `total={players.length}` (LIVE roster) to
  VoteProgress at page.tsx:907 instead of the frozen `gs.vote_round_player_count`. So when a
  4th player joins, the roster goes to 4 and the X/N pill renders 0/4, even though the round
  still resolves at the frozen threshold of 3. The displayed denominator and the actual
  threshold disagree. Secondary: HostSkipBtn visibility gate at page.tsx:913 also uses live
  players.length. This is WR-02 (half-snapshot): the freeze was implemented for resolution but
  not for the display. The bug exists in HEAD source, so it is a genuine code gap regardless of
  whether the deployed Railway build (which lacks all of Phase 03) was tested.

  ISSUE 2 (Type C timer) — REAL LOCAL-CODE GAP relative to the new design decision.
  ChoiceScreen unconditionally renders a 30s VoteTimer (page.tsx:908-912) whose onExpire=onForce
  =resolveTypeCChoice triggers an advancer auto-skip. The user's design decision (2026-06-10)
  is that the choice phase must have NO timer and must resolve only when every present (frozen)
  player has acted, with the host "Passer sans attendre" button as the sole AFK fallback. The
  timer currently present contradicts that decision. The deployed build lacks Phase 03 entirely,
  but the timer is present in HEAD source, so this is a real local gap.

fix: |
  NOT APPLIED (find_root_cause_only mode). Suggested fix direction below.

  ISSUE 1 — Freeze the choice-phase display denominator:
  - page.tsx:907 — change `total={players.length}` to use the frozen snapshot, e.g.
    `total={gs.vote_round_player_count || players.length}`.
  - page.tsx:913 — align HostSkipBtn gate: replace `voteCount < players.length` with
    `voteCount < (gs.vote_round_player_count || players.length)`.
  - Optionally also exclude mid-round joiners from the `others` designation list
    (page.tsx:900) so a 4th joiner can't be designated for the frozen round — but the
    reported symptom is strictly the denominator, so the minimal fix is the two lines above.
  - Keep the `|| players.length` fallback for in-flight pre-Phase-3 games (snapshot==0).

  ISSUE 2 — Remove the vote timer from the choice phase:
  - page.tsx:908-912 — delete the IIFE that computes initialSecs and renders
    `<VoteTimer .../>` from the ChoiceScreen footer. Leave VoteProgress and HostSkipBtn.
  - No change needed to resolveTypeCChoice (page.tsx:1798) — it is timer-independent and
    already resolves on threshold. submitChoice (page.tsx:1794-1795) already triggers
    resolution at frozen-count when the last present player acts.
  - The host force path is preserved via HostSkipBtn (page.tsx:913 -> onForce ->
    resolveTypeCChoice). Note: with the timer gone, `isAdvancer` is no longer consumed by
    ChoiceScreen — the prop can be dropped from the ChoiceScreen signature/call site
    (page.tsx:891-895, 1941) as cleanup, but that is non-functional.
  - DESIGN consequence to verify: with no timer and resolution gated on
    actions == frozen-count, if a frozen-participant goes AFK the round cannot auto-advance;
    only the host's "Passer sans attendre" advances it. This matches the design decision.
    Note HostSkipBtn currently requires `isHost && hasVoted` — confirm the host can still
    force-skip if the host themselves has acted (they will have, since they're a player);
    this is consistent with existing vote-phase behavior.

verification: NOT APPLIED — diagnose-only mode.

files_changed: []
