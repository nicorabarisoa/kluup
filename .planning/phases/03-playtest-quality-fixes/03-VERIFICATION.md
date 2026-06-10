---
phase: 03-playtest-quality-fixes
verified: 2026-06-11T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/9 must-haves verified (3 auto + 6 code-verified, 0 failed)
  gaps_closed:
    - "SC-8 display denominator frozen (ChoiceScreen VoteProgress + HostSkipBtn both now use gs.vote_round_player_count || players.length)"
    - "SC-5b VoteTimer removed from ChoiceScreen (no isAdvancer prop, no VoteTimer reference in ChoiceScreen body)"
    - "SC-5 lazy-stamp effect for pre-Phase-3 in-flight rows implemented (lazyStampedRef, advancer-gated, updateRoomGameState)"
    - "SC-4 setLastPseudo/getLastPseudo helpers in lib/utils.ts (kluup_pseudo_<CODE>); clearPlayerId does NOT touch the key; join page writes on join and reads as fallback"
    - "SC-3 supabase/lifecycle.sql lowered to interval '60 seconds', Block 5 with CREATE EXTENSION IF NOT EXISTS pg_cron + idempotent cron.schedule every minute; ROADMAP.md + 03-UAT.md updated to ~1 min acceptance"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Two players join the same room with the same pseudo (different case, e.g. 'Nico' then 'nico'). Confirm the second join is rejected with the inline error message under the pseudo input."
    expected: "Second join shows 'Ce pseudo est déjà pris, choisis-en un autre.' (or locale equivalent) inline below the pseudo field; no alert dialog; first player unaffected."
    why_human: "Requires live multi-device or multi-tab runtime to hit the Postgres 23505 path. DB index confirmed live by user. Code-side 23505 handler verified statically."
  - test: "Lock the screen on a mobile device during a game (or close the tab). Return within 15 s and confirm the player is not removed from the room. Then close the tab for more than 15 s and confirm the ghost row is pruned."
    expected: "Return within 15 s: player still in roster. After 15 s absence: player row deleted. If the absent player was the last player, the room is also deleted."
    why_human: "Requires physical device with screen-lock. GRACE_MS=15_000 and room-deletion-on-last-prune code verified statically; runtime outcome cannot be confirmed without a device."
  - test: "SC-3 empirical smoke test — create a room, join with 2 players (two tabs), close BOTH tabs (do not click Quitter), wait ~70 seconds, then attempt to join the room code."
    expected: "Room reports 'Room introuvable' (swept by pg_cron). Separately, with one tab open and heartbeating, wait ~2 min and confirm the room still exists."
    why_human: "pg_cron job is confirmed live (jobid 6, applied by user). Infrastructure is verified. The end-to-end sweep observation has not been run yet. Live runtime required."
  - test: "Quit the game from the lobby (click Quitter), then navigate to /join?code=XXXX and confirm the pseudo input is pre-filled with the old name but is editable and requires an explicit submit."
    expected: "Input shows old pseudo pre-filled. Hint text 'Ton ancien pseudo est pré-rempli.' visible. Input is not read-only. Pressing join re-inserts."
    why_human: "Requires runtime localStorage state (kluup_pseudo_<CODE>) written by the quit path. Static code fully verified — setLastPseudo on join, getLastPseudo fallback in pre-fill effect, clearPlayerId does not clear the key."
  - test: "Refresh the browser mid-round (during a 30-second vote timer). Confirm the timer shows the remaining time, not the full 30 s."
    expected: "Timer initializes to approximately (30 - elapsed_since_round_start) seconds after refresh, not always 30 s."
    why_human: "Requires Railway push + redeploy of HEAD for SC-5 to take effect in production (deployment-only gap). Code is correct in HEAD (round_started_at at all 4 VoteTimer call sites verified). Also requires a live session for empirical observation."
  - test: "In a 3-player game where round 1 has started, have a 4th player join mid-vote during the Type C choice phase. Confirm the displayed denominator stays X/3 (not X/4) throughout, and the round resolves after 3 players act."
    expected: "Pill shows X/3. Host skip button gates on (gs.vote_round_player_count || players.length) = 3. Round resolves at 3 actions. 4th player participates from the next round. Toast 'pseudo a rejoint la partie' appears."
    why_human: "Requires 4 devices or tabs with live Supabase to test the mid-round joiner path. Frozen denominator code verified statically (lines 907-908 of game/page.tsx)."
  - test: "Play a Type C round. Confirm no countdown timer appears during the choice phase (volunteer / send-to-bûcher). The round only advances when all players have acted or the host taps 'Passer sans attendre'."
    expected: "No timer ring visible in the Type C choice phase. Round does not advance automatically at 30 s. Host skip button is the only AFK fallback."
    why_human: "VoteTimer removal from ChoiceScreen verified statically (grep confirms no VoteTimer or isAdvancer in ChoiceScreen body). Runtime confirmation requires a live session."
  - test: "In a Type C round, ensure all players press 'Envoyer quelqu'un au bûcher' (nobody volunteers). Confirm the roulette designation screen appears with no 'répond à voix haute' text."
    expected: "round_c_roulette phase renders. No volunteer reveal text. No crash."
    why_human: "resolveTypeCChoice routing and VolunteersRevealScreen guard verified statically. Live round flow with zero volunteers requires a real session."
---

# Phase 03: Playtest Quality Fixes — Verification Report (Re-verification)

**Phase Goal:** Fix the core game bugs and UX issues found during playtest so the game is solid before auth ships.
**Verified:** 2026-06-11
**Status:** human_needed
**Re-verification:** Yes — after gap closure runs 03-06, 03-07, 03-08

---

## Summary of Re-verification

This is a re-verification following the three gap-closure plans (03-06, 03-07, 03-08) that addressed the five UAT issues. All previously-UNCERTAIN must-haves that had code-verifiable implementations are now VERIFIED. No FAILEDs found in the codebase. The phase is blocked on human/operational verification only (no code gaps remain).

**Previous score:** 8/9 (3 auto-verified, 6 code-verified but UNCERTAIN, 0 failed)
**Current score:** 9/9 (all code artifacts verified, 0 failed; 8 human-runtime checks pending)

---

## Goal Achievement

### Observable Truths

| #  | Truth (Success Criterion) | Status | Evidence |
|----|---------------------------|--------|----------|
| 1  | Two players cannot join with the same pseudo (DB enforced, inline error on 23505) | ? UNCERTAIN | DB index confirmed applied by user (plan 03-03). `playerError.code === '23505'` branch at `app/join/page.tsx:95` calls `setPseudoError`. Inline `{pseudoError && <p>}` confirmed. Runtime path requires live multi-device test. |
| 2  | Closing the browser tab removes the player after 15 s grace; screen-lock within 15 s does not trigger removal | ? UNCERTAIN | `GRACE_MS = 15_000` at `lib/usePresence.ts:8`. Prune setTimeout at line 46. Room deletion on `count === 0` at lines 52-53. Runtime requires physical device test. |
| 3  | A room with zero connected players is automatically deleted by the server within ~1 min (pg_cron sweep interval) | ? UNCERTAIN | `supabase/lifecycle.sql` Block 3: `interval '60 seconds'` at line 59. Block 5: `CREATE EXTENSION IF NOT EXISTS pg_cron` at line 88, idempotent unschedule guard at line 91, `cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()')` at line 94. pg_cron jobid 6 confirmed applied live by user. Empirical smoke test (both-tabs-closed → room swept in ~70s) not yet run. |
| 4  | A player rejoining after quitting gets their old pseudo pre-filled (editable, requires submit) | ? UNCERTAIN | `lib/utils.ts:59-69`: `LAST_PSEUDO_PREFIX = 'kluup_pseudo_'`, `setLastPseudo`, `getLastPseudo` — SSR-safe, try/catch, uppercase key. `clearPlayerId` body (lines 48-51) does NOT reference `kluup_pseudo_`. `app/join/page.tsx:6` imports both helpers; line 28 reads `getLastPseudo(upperCode)` as baseline fallback before DB path; line 109 writes `setLastPseudo(room.code, pseudo.trim())` on successful join. Hint renders at lines ~143-145 when `storedPseudo && pseudo === storedPseudo`. Runtime requires localStorage state from quit flow. |
| 5  | A player who refreshes mid-round sees the correct remaining timer | ? UNCERTAIN | `VoteTimer initialSecs` prop at `game/page.tsx:301-302`. All 4 call sites compute `elapsed = gs.round_started_at ? Math.floor(...) : 0` and `initialSecs = Math.max(0, 30 - elapsed)` (lines 482-484, 514-516, 719-721). Lazy-stamp effect at lines 1675-1693 anchors pre-Phase-3 in-flight rows (advancer-gated, `lazyStampedRef` prevents re-fire). SC-5 is **deployment-only** — HEAD source is correct but Railway still serves `origin/main` until user pushes + redeploys. |
| 6  | The quit button is accessible from the lobby | ✓ VERIFIED | `<button type="button" onClick={onQuit} ...>{fr.game.quit}</button>` at `lobby/page.tsx:187-194`. `onQuit` at lines 124-142 implements host-transfer / room-deletion logic. Unchanged from initial verification. |
| 7  | Type C with 0 volunteers triggers roulette, not "répond à voix haute" | ✓ VERIFIED | `resolveTypeCChoice` at `game/page.tsx:1798-1817`: `if (vols.length > 0)` → `round_c_volunteers_reveal`, else → `round_c_roulette`. `VolunteersRevealScreen` guard at line 985. Unchanged from initial verification. |
| 8  | A player joining mid-round does not distort the vote threshold for the Type C choice phase | ✓ VERIFIED | `ChoiceScreen` footer at lines 907-908: `VoteProgress total={gs.vote_round_player_count \|\| players.length}` and `HostSkipBtn show={isHost && hasVoted && voteCount < (gs.vote_round_player_count \|\| players.length)}`. `ChoiceScreen` body (lines 891-958) contains **no** `VoteTimer` and **no** `isAdvancer` reference. Call site at line 1959 confirms no `isAdvancer` prop. Resolution threshold at lines 1737, 1776, 1812, 1930 all use the frozen snapshot. |
| 9  | Landing page says "recommended 3–10 players" in all 4 languages | ✓ VERIFIED | `lib/i18n.ts:22` FR, line 259 EN, line 494 ES, line 729 DE. Unchanged from initial verification. |

**Score:** 9/9 — all must-haves have codebase evidence. No FAILEDs. 4 truths confirmed by automated grep (SCs 6, 7, 8, 9); 5 truths have full static code evidence but require live runtime for empirical confirmation (SCs 1, 2, 3, 4, 5).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/utils.ts` | `setLastPseudo`/`getLastPseudo` helpers keyed `kluup_pseudo_<CODE>`; `clearPlayerId` does NOT clear the pseudo key | ✓ VERIFIED | Lines 59-69: `LAST_PSEUDO_PREFIX = 'kluup_pseudo_'`, both helpers exported, SSR-safe, try/catch. `clearPlayerId` at lines 48-51 only removes `kluup_pid_<CODE>` and the legacy sessionStorage key — no reference to `kluup_pseudo_`. |
| `app/join/page.tsx` | Imports `getLastPseudo`/`setLastPseudo`; writes on join; reads as fallback in pre-fill effect | ✓ VERIFIED | Line 6: both imported. Line 28: `getLastPseudo(upperCode)` used as baseline. Line 109: `setLastPseudo(room.code, pseudo.trim())` called right after `setPlayerId`. DB path still overwrites when reconnect row exists (lines 39-45). |
| `app/room/[code]/game/page.tsx` | `ChoiceScreen` uses frozen denominator in `VoteProgress` and `HostSkipBtn`; no `VoteTimer`; no `isAdvancer`; lazy-stamp effect exists | ✓ VERIFIED | Line 907: `total={gs.vote_round_player_count \|\| players.length}`. Line 908: `voteCount < (gs.vote_round_player_count \|\| players.length)`. `ChoiceScreen` body (lines 891-958): zero occurrences of `VoteTimer` or `isAdvancer`. Call site line 1959: no `isAdvancer` prop. Lazy-stamp: lines 1675-1693, `lazyStampedRef`, advancer-gated, `updateRoomGameState`. |
| `supabase/lifecycle.sql` | `interval '60 seconds'` in Block 3; Block 5 with `CREATE EXTENSION IF NOT EXISTS pg_cron`, idempotent unschedule, `cron.schedule('cleanup-dead-rooms', '* * * * *', ...)` | ✓ VERIFIED | Line 59: `interval '60 seconds'`. Line 88: `CREATE EXTENSION IF NOT EXISTS pg_cron`. Line 91: `cron.unschedule` guard. Line 94: `cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()')`. No `interval '30 minutes'` remains. |
| `.planning/ROADMAP.md` | SC-3 text states `~1 min (pg_cron sweep interval)` | ✓ VERIFIED | Line 55: "A room with zero connected players is automatically deleted by the server within ~1 min (pg_cron sweep interval)". |
| `.planning/phases/03-playtest-quality-fixes/03-UAT.md` | SC-3 gap entry has `resolution:` noting relaxed `~1 min` window | ✓ VERIFIED | Lines 83-84 of UAT: `decision:` and `resolution:` blocks both contain `~1 min`. `resolution:` records `plan 03-08`, `interval '60 seconds'`, `pg_cron Block 5`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ChoiceScreen VoteProgress` | `gs.vote_round_player_count` | `total={gs.vote_round_player_count \|\| players.length}` | ✓ WIRED | game/page.tsx:907 — exact pattern matches plan 03-06 must_have |
| `ChoiceScreen HostSkipBtn gate` | `gs.vote_round_player_count` | `voteCount < (gs.vote_round_player_count \|\| players.length)` | ✓ WIRED | game/page.tsx:908 — exact pattern matches plan 03-06 must_have |
| `app/join/page.tsx joinRoom` | `lib/utils.ts setLastPseudo` | `setLastPseudo(room.code, pseudo.trim())` after `setPlayerId` | ✓ WIRED | join/page.tsx:109 |
| `app/join/page.tsx pre-fill effect` | `lib/utils.ts getLastPseudo` | `const remembered = getLastPseudo(upperCode)` as baseline fallback | ✓ WIRED | join/page.tsx:28-32 — applied before early-return on pid check |
| `pg_cron schedule` | `cleanup_dead_rooms()` | `cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()')` | ✓ WIRED (SQL file) — HUMAN for live DB | lifecycle.sql:94. SQL verified in file; live application confirmed by user (jobid 6) but empirical end-to-end test pending. |
| `cleanup_dead_rooms()` | rooms with no recent activity | `DELETE FROM rooms WHERE COALESCE(last_activity, created_at) < now() - interval '60 seconds'` | ✓ WIRED | lifecycle.sql:57-61 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ChoiceScreen VoteProgress pill` | `gs.vote_round_player_count` | Set in `resolveVotes('question_selection')` at game/page.tsx:1734 and `onNextRound` at ~1857; `makeInitialGameState` initializes to `0` with `\|\| players.length` fallback | Yes — real snapshot from round-start DB write | ✓ FLOWING |
| `app/join/page.tsx pseudo pre-fill` | `remembered` (getLastPseudo) | `localStorage.getItem('kluup_pseudo_' + code)` written by `setLastPseudo` on every successful join | Yes — real localStorage from prior join | ✓ FLOWING (requires runtime to observe) |
| `cleanup_dead_rooms()` via pg_cron | deleted room count | `DELETE FROM rooms WHERE last_activity < now() - interval '60 seconds'` | Yes — real DB delete; live rooms protected by 30s heartbeat keeping `last_activity` fresh | ✓ FLOWING (live DB confirmed; empirical smoke test pending) |
| `VoteTimer initialSecs` (lazy-stamp path) | `gs.round_started_at` | Advancer-elected `updateRoomGameState` write at game/page.tsx:1691 when `round_started_at` is falsy | Yes — real timestamp write to Supabase | ✓ FLOWING (for pre-Phase-3 legacy rows) |

---

### Behavioral Spot-Checks (Re-verification additions)

| Behavior | Evidence | Status |
|----------|----------|--------|
| `ChoiceScreen` has `total={gs.vote_round_player_count \|\| players.length}` | game/page.tsx line 907 — exact string found | ✓ PASS |
| `ChoiceScreen` has `voteCount < (gs.vote_round_player_count \|\| players.length)` | game/page.tsx line 908 — exact string found | ✓ PASS |
| `ChoiceScreen` body has NO `VoteTimer` reference | Grep: VoteTimer in game/page.tsx — lines 301, 484, 516, 721 only; none between lines 891-958 (ChoiceScreen) | ✓ PASS |
| `ChoiceScreen` body has NO `isAdvancer` reference | Grep: `isAdvancer` in game/page.tsx — lines 301-317, 421-423, 495-497, 674-676, 1704, 1949, 1951, 1955 only; NOT in 891-958 or call site 1959 | ✓ PASS |
| `lib/utils.ts` exports `setLastPseudo` and `getLastPseudo` | Lines 61, 66 — both `export function` confirmed | ✓ PASS |
| `clearPlayerId` body does NOT contain `kluup_pseudo_` | clearPlayerId at lines 48-51: only removes `kluup_pid_<CODE>` and sessionStorage `player_id` | ✓ PASS |
| `app/join/page.tsx` imports both helpers and calls both | Line 6: import confirmed. Line 28: `getLastPseudo` called. Line 109: `setLastPseudo` called. | ✓ PASS |
| `lifecycle.sql` uses `interval '60 seconds'` (not `'30 minutes'`) | Line 59 confirmed; no `'30 minutes'` found in file | ✓ PASS |
| `lifecycle.sql` Block 5 contains all three pg_cron statements | Lines 88, 91, 94 — `CREATE EXTENSION`, unschedule guard, `cron.schedule` all present | ✓ PASS |
| `ROADMAP.md` SC-3 contains `~1 min` | Line 55 confirmed | ✓ PASS |
| `03-UAT.md` SC-3 gap contains `~1 min` | Lines 83-84 confirmed | ✓ PASS |
| Lazy-stamp effect exists with `lazyStampedRef` guard | game/page.tsx:1675-1693 — `lazyStampedRef`, advancer check, `updateRoomGameState` call | ✓ PASS |

---

### Requirements Coverage

This phase declares no v2 AUTH/IDEN/STAT/PROF requirement IDs. All declared requirements are phase-internal success criteria (SC-1 through SC-9). No orphaned requirements.

---

### Anti-Patterns Found

Same as initial verification — no new debt markers introduced by plans 03-06, 03-07, 03-08.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/usePresence.ts` | 6-8 | `GRACE_MS = 15_000` — differs from CLAUDE.md "60 s de grâce" | ⚠️ Warning | Advisory: 15 s may be too aggressive for phone-lock. Intentional phase decision (D-04/D-06). Non-blocking. |
| `app/join/page.tsx` | 40 | `.then(({ data }) => ...)` — no `error` destructured on pseudo prefetch | ℹ️ Info | Transient errors silently ignored. Minor observability gap. Non-blocking. |
| `app/room/[code]/game/page.tsx` | 482-484 et al. | 4 identical `initialSecs` IIFE blocks | ℹ️ Info | Duplication risk. Extract helper. Non-blocking. |

No `TBD`, `FIXME`, or `XXX` markers found in any of the three gap-closure plans' modified files (`app/room/[code]/game/page.tsx`, `lib/utils.ts`, `app/join/page.tsx`, `supabase/lifecycle.sql`).

---

### Human Verification Required

#### 1. SC-1: Duplicate pseudo rejection (end-to-end)

**Test:** Open two browser tabs. In tab 1, create a room with pseudo "Nico". In tab 2, join the same room code with pseudo "nico" (different case).
**Expected:** Tab 2 shows inline error "Ce pseudo est déjà pris, choisis-en un autre." (or locale equivalent) below the pseudo input. No alert dialog. Joining with a different pseudo succeeds.
**Why human:** Requires live multi-device or multi-tab test to hit the Postgres 23505 path. DB index confirmed applied; code-side handler verified statically.

#### 2. SC-2: Browser close removes player after 15 s grace; screen-lock does not

**Test:** During a live game, close a player's browser tab. Within 15 s, confirm the player is still in the roster. After 15 s, confirm their row is deleted. Separately, lock the screen on a mobile device and unlock within 15 s; confirm the player is not removed.
**Expected:** Close-tab: pruned after ~15 s. Screen-lock-and-return within 15 s: player remains.
**Why human:** Requires physical device and live Supabase presence channel. `GRACE_MS=15_000` verified statically.

#### 3. SC-3: pg_cron sweep — abandoned room deleted within ~1 min (empirical)

**Test:** Create a room with 2 players (two tabs). Close BOTH tabs without clicking Quitter (exercise the tab-close path). Wait ~70 seconds, then attempt to join the room code (or query `SELECT count(*) FROM rooms WHERE code = '<CODE>';`).
**Expected:** Room reports "Room introuvable" (swept). Separately, with one tab open and heartbeating, wait ~2 min and confirm the room still exists.
**Why human:** pg_cron jobid 6 is confirmed live. This is an empirical end-to-end smoke test of the deployed infrastructure — cannot be verified statically. Required before next production playtest.

#### 4. SC-4: Rejoin pre-fills old pseudo (editable, requires submit)

**Test:** Join a room with pseudo "Alice". Quit via Quitter button. Navigate back to `/join?code=XXXX`. Confirm the pseudo input is pre-filled with "Alice", a hint "Ton ancien pseudo est pré-rempli." is visible, the field is editable, and you must press Rejoindre to join.
**Expected:** Input pre-filled. Hint visible. Field editable. No silent auto-rejoin.
**Why human:** Requires localStorage state written by the new `setLastPseudo` call on the prior join. Static code fully verified.

#### 5. SC-5: Refresh mid-round shows correct remaining timer (post-deployment)

**Test:** Push HEAD to origin/main and redeploy on Railway. During a vote phase, note the timer value, then refresh the browser. Confirm the timer resumes from approximately the correct remaining seconds, not always from 30 s.
**Expected:** After refresh, timer starts from ~(30 - elapsed_since_round_start) seconds.
**Why human:** SC-5 is deployment-only — HEAD source is correct (`round_started_at` at all 4 VoteTimer call sites) but Railway still serves the pre-Phase-3 build. Push + redeploy required first.

#### 6. SC-8: Mid-round joiner (Type C choice phase) excluded from denominator; frozen display

**Test:** Start a 3-player game and navigate to the Type C choice phase. Have a 4th player join mid-phase. Confirm the pill still shows X/3 (not X/4) and the round resolves after 3 players act.
**Expected:** Denominator stays frozen. Toast "pseudo a rejoint la partie" briefly visible. Round resolves at 3 actions.
**Why human:** Requires 4 devices/tabs with live Supabase. Frozen denominator code verified statically at lines 907-908.

#### 7. SC-5b: Type C choice phase shows no countdown timer

**Test:** In a Type C round, confirm no countdown ring/timer is visible during the choice phase. The round must not advance automatically; it waits for all players to act or the host to tap "Passer sans attendre".
**Expected:** No timer. No auto-advance. Host skip button is sole AFK fallback.
**Why human:** VoteTimer removal verified statically (no VoteTimer/isAdvancer in ChoiceScreen body). Live rendering cannot be confirmed without running the app.

#### 8. SC-7: Type C 0-volunteer triggers roulette (not "répond à voix haute")

**Test:** In a Type C round, ensure all players press "Envoyer quelqu'un au bûcher" (nobody volunteers). Confirm the roulette designation screen appears.
**Expected:** `round_c_roulette` phase renders. No volunteer reveal text. No crash.
**Why human:** `resolveTypeCChoice` routing and `VolunteersRevealScreen` guard verified statically. Live round flow requires a real session.

---

### Gaps Summary

No code gaps remain. All 9 success criteria have full codebase implementation evidence:

- **SC-1 (duplicate pseudo):** DB index applied (user-confirmed plan 03-03), 23505 branch confirmed.
- **SC-2 (presence grace):** `GRACE_MS=15_000` confirmed. Advisory WR-04 (CLAUDE.md documents 60 s) remains non-blocking.
- **SC-3 (room deletion):** `lifecycle.sql` verified: `interval '60 seconds'` + Block 5 pg_cron. pg_cron jobid 6 live in DB (user-confirmed). Empirical smoke test pending.
- **SC-4 (rejoin pseudo):** `lib/utils.ts` helpers verified. `clearPlayerId` does NOT clear pseudo key. `join/page.tsx` wired: writes on join, reads as fallback.
- **SC-5 (refresh timer):** All 4 VoteTimer call sites verified. Lazy-stamp effect implemented. Deployment-only blocker: push + redeploy required.
- **SC-5b (no choice-phase timer):** `ChoiceScreen` body has no `VoteTimer` and no `isAdvancer`. Confirmed.
- **SC-6 (lobby quit):** Unchanged and verified.
- **SC-7 (Type C 0-volunteer roulette):** Unchanged and verified.
- **SC-8 (frozen denominator):** `ChoiceScreen` VoteProgress and HostSkipBtn both use `gs.vote_round_player_count || players.length`. Confirmed.
- **SC-9 (landing copy):** Unchanged and verified.

**Operational actions still required before closing the phase:**
1. Push HEAD to origin/main and redeploy on Railway (unblocks SC-5 empirical check).
2. Run SC-3 empirical smoke test (both-tabs-close → room swept in ~70s, live room survives ~2 min).

---

_Verified: 2026-06-11_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — gap closure plans 03-06, 03-07, 03-08_
