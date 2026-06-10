---
phase: 03-playtest-quality-fixes
verified: 2026-06-10T00:00:00Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Two players join the same room with the same pseudo (different case, e.g. 'Nico' then 'nico'). Confirm the second join is rejected with the inline error message under the pseudo input."
    expected: "Second join shows 'Ce pseudo est déjà pris, choisis-en un autre.' (or locale equivalent) inline below the pseudo field; no alert dialog; first player unaffected."
    why_human: "Requires live multi-device or multi-tab runtime to hit the Postgres 23505 path. DB index confirmed live by user. Code-side 23505 handler verified statically. The complete end-to-end path (DB rejection → error surfaced to UI) cannot be grepped."
  - test: "Lock the screen on a mobile device during a game (or close the tab). Return within 15 s and confirm the player is not removed from the room. Then close the tab for more than 15 s and confirm the ghost row is pruned."
    expected: "Return within 15 s: player still in roster. After 15 s absence: player row deleted. If the absent player was the last player, the room is also deleted."
    why_human: "Requires physical device with screen-lock. GRACE_MS=15_000 and room-deletion-on-last-prune code verified statically; runtime outcome cannot be confirmed without a device."
  - test: "In a game with 2 players, both players quit (or close tabs). After more than 15 s, confirm the room no longer exists (query the DB or attempt to join the room code)."
    expected: "Room deleted automatically when the last player presence times out."
    why_human: "Requires runtime presence channel. usePresence.ts room deletion code verified statically. Live behavior cannot be confirmed without running the app."
  - test: "Quit the game from the lobby (click Quitter), then navigate to /join?code=XXXX and confirm the pseudo input is pre-filled with the old name but is editable and requires an explicit submit."
    expected: "Input shows old pseudo pre-filled. Hint text 'Ton ancien pseudo est pré-rempli.' visible. Input is not read-only. Pressing join re-inserts."
    why_human: "Requires runtime localStorage state and network query (maybeSingle on stored pid). Static code verified. Live flow cannot be confirmed without running the app."
  - test: "Refresh the browser mid-round (during a 30-second vote timer). Confirm the timer shows the remaining time, not the full 30 s."
    expected: "Timer initializes to approximately (30 - elapsed_since_round_start) seconds after refresh, not always 30 s."
    why_human: "Requires running the game with a live Supabase DB so round_started_at is written by startGame/onNextRound. Static code fully verified. Live behavior requires a real session."
  - test: "In a 3-player game where round 1 has started, have a 4th player join mid-vote. Confirm all 3 original players' votes still resolve the round (threshold stays at 3, not 4). Confirm a toast appears announcing the 4th player joined."
    expected: "Round resolves when 3 votes are cast. Toast pill '${pseudo} a rejoint la partie' appears briefly at the top center. 4th player sees the current round and can vote in round 2 onward."
    why_human: "Requires 4 devices or tabs with live Supabase. vote_round_player_count snapshot and toast broadcast fully verified statically. Live race condition cannot be confirmed without a real session."
  - test: "In a Type C round where all players press 'Envoyer quelqu'un au bûcher' (zero volunteers), confirm the roulette designation screen appears, not a 'répond à voix haute' message."
    expected: "Game transitions to round_c_roulette phase showing roulette. No 'répond à voix haute' text. No crash on vols[0].pseudo."
    why_human: "resolveTypeCChoice routing and VolunteersRevealScreen 0-volunteer guard verified statically. Live round flow requires a real session with zero volunteers to confirm actual screen rendering."
---

# Phase 03: Playtest Quality Fixes — Verification Report

**Phase Goal:** Fix the core game bugs and UX issues found during playtest so the game is solid before auth ships.
**Verified:** 2026-06-10
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth (Success Criterion)                                                                                                                          | Status      | Evidence                                                                                                                                 |
|----|----------------------------------------------------------------------------------------------------------------------------------------------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Two players cannot join with the same pseudo (DB enforced, code shows inline error on 23505)                                                        | ? UNCERTAIN | DB index confirmed applied by user. `playerError.code === '23505'` branch in `app/join/page.tsx:81` calls `setPseudoError`. Inline `{pseudoError && <p>}` at line 146. Runtime path requires live multi-device test. |
| 2  | Closing the browser removes the player after 15 s grace; screen-lock within 15 s does not trigger removal                                          | ? UNCERTAIN | `GRACE_MS = 15_000` at `lib/usePresence.ts:8`. Prune setTimeout callback at line 46. Runtime behavior requires physical device test.     |
| 3  | A room with zero connected players is automatically deleted                                                                                         | ? UNCERTAIN | `count === 0` → `supabase.from('rooms').delete()` at `lib/usePresence.ts:52–53`. Also `onQuit` in lobby (line 134–135) deletes room when last player quits manually. Runtime presence behavior requires live test. |
| 4  | A player rejoining after quitting gets a fresh join flow with their old pseudo pre-filled (editable, requires submit)                               | ? UNCERTAIN | `storedPseudo` state at `app/join/page.tsx:16`; useEffect reads `getPlayerId` → queries `players.select('pseudo').maybeSingle()` → `setPseudo` at lines 24–32. Hint rendered at line 143–145. Runtime requires localStorage + live DB. |
| 5  | A player who refreshes mid-round sees the correct remaining timer                                                                                   | ? UNCERTAIN | `VoteTimer` accepts `initialSecs = 30` at `game/page.tsx:301–302`. All 4 call sites compute `elapsed = gs.round_started_at ? Math.floor(...) : 0` and `initialSecs = Math.max(0, 30 - elapsed)` (lines 482–484, 514–516, 719–721, 909–911). `startGame` sets `gs.round_started_at = new Date().toISOString()` at `lobby/page.tsx:165`. `onNextRound` and `resolveVotes` transitions also set `round_started_at` (lines 1734, 1857). Runtime requires a live session. |
| 6  | The quit button is accessible from the lobby                                                                                                        | ✓ VERIFIED  | `<button type="button" onClick={onQuit} ...>{fr.game.quit}</button>` at `lobby/page.tsx:187–194`. `onQuit` function at lines 124–142 implements full host-transfer / room-deletion logic with no `window.confirm`. `clearPlayerId` imported at line 8. |
| 7  | Type C with 0 volunteers triggers roulette, not "répond à voix haute"                                                                              | ✓ VERIFIED  | `resolveTypeCChoice` at `game/page.tsx:1798–1817`: `if (vols.length > 0)` → `round_c_volunteers_reveal`, else → `round_c_roulette`. `VolunteersRevealScreen` early-return at line 985: `if (vols.length === 0) return (... <QuestionCard> ... <RoundEndFooter> ...)`. `vols[0].pseudo` at line 1021 only reached when `vols.length >= 1`. |
| 8  | A player joining mid-round does not distort the vote threshold or timer for the current question                                                    | ? UNCERTAIN | `threshold = gs!.vote_round_player_count \|\| players.length` used at lines 1719, 1794, 1912. `vote_round_player_count` snapshotted in `startGame` (lobby:166), `onNextRound` (line 1857), and `resolveVotes` transition (line 1734). Player-joined toast wired at lines 1577–1580 and 1611–1620 (broadcast outside setState updater per CR-01 fix). Runtime requires 4-player live test. |
| 9  | Landing page says "recommended 3–10 players" in all 4 languages                                                                                    | ✓ VERIFIED  | `lib/i18n.ts:22` FR: "Conseillé entre 3 et 10 joueurs · 10–20 min"; line 259 EN: "Recommended 3–10 players · 10–20 min"; line 494 ES: "Recomendado entre 3 y 10 jugadores · 10–20 min"; line 729 DE: "Empfohlen 3–10 Spieler · 10–20 Min". `app/page.tsx` renders this via `fr.landing.players_hint`. |

**Score:** 3/9 auto-verified (SCs 6, 7, 9); 6/9 code-verified but require live runtime confirmation (SCs 1–5, 8). No FAILED truths found in the codebase.

---

### Required Artifacts

| Artifact                                        | Expected                                                     | Status      | Details                                                                                                                           |
|-------------------------------------------------|--------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `lib/types.ts`                                  | `GameState.round_started_at: string` and `vote_round_player_count: number` | ✓ VERIFIED  | Lines 84, 88 — both fields present as final two members of `GameState`, after `session_uuid`.                                    |
| `lib/game.ts`                                   | `makeInitialGameState` initialises both fields to `''` / `0` | ✓ VERIFIED  | Lines 96–97 — `round_started_at: ''` and `vote_round_player_count: 0` with inline caller comments.                               |
| `lib/i18n.ts`                                   | `pseudo_taken`, `pseudo_prefilled_hint`, `player_joined` in all 4 locales | ✓ VERIFIED  | All 3 keys appear exactly 4 times each (lines 49–50/85, 286–287/322, 521–522/557, 756–757/792). `player_joined` is function-valued. |
| `lib/usePresence.ts`                            | `GRACE_MS=15_000`, `HEARTBEAT_MS=30_000`, room-deletion on last prune | ✓ VERIFIED  | Lines 8, 11 for constants. Lines 52–53 for room deletion.                                                                        |
| `supabase/migrations/003-pseudo-unique.sql`     | `CREATE UNIQUE INDEX idx_players_pseudo_lower ON players (room_id, LOWER(pseudo))` | ✓ VERIFIED  | File exists. Lines 21–23 contain exact index DDL. Lines 16–20 contain `IF NOT EXISTS` guard on `pg_indexes`. No `ADD CONSTRAINT`. |
| `supabase/schema.sql`                           | Same idempotent block mirrored after `idx_players_room_id`   | ✓ VERIFIED  | Lines 183–185 contain `idx_players_pseudo_lower` with `LOWER(pseudo)` and `CREATE UNIQUE INDEX`.                                 |
| `app/join/page.tsx`                             | `23505` inline error + rejoin pre-population                 | ✓ VERIFIED  | `pseudoError` state at line 15; `playerError.code === '23505'` branch at line 81; `storedPseudo` at line 16; useEffect prefetch at lines 24–32; inline renders at lines 143–148. |
| `app/room/[code]/lobby/page.tsx`                | Quitter button + host-transfer/room-deletion `onQuit` + `startGame` snapshots | ✓ VERIFIED  | `clearPlayerId` imported at line 8; `onQuit` at lines 124–142; quit button at lines 187–194; `gs.round_started_at` and `gs.vote_round_player_count` set in `startGame` at lines 165–166. |
| `app/room/[code]/game/page.tsx`                 | `VoteTimer initialSecs`, snapshot threshold, `player_joined` toast, Type C guard | ✓ VERIFIED  | `initialSecs` prop at line 301; 4 call sites at lines 482–484/514–516/719–721/909–911; thresholds at lines 1719/1794/1912; toast state/ref at lines 1489/1495; broadcast at lines 1611–1620 (outside updater per CR-01 fix); `VolunteersRevealScreen` guard at line 985. |

---

### Key Link Verification

| From                            | To                                     | Via                                              | Status      | Details                                                                                                                           |
|---------------------------------|----------------------------------------|--------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `app/join/page.tsx`             | `idx_players_pseudo_lower` (Plan 03)   | `playerError.code === '23505'` → `setPseudoError` | ✓ VERIFIED  | Line 81 branches on `'23505'`; calls `setPseudoError(fr.join.pseudo_taken)`. DB index confirmed live.                            |
| `VoteTimer` call sites          | `gs.round_started_at`                  | `initialSecs = max(0, 30 - elapsed)`             | ✓ VERIFIED  | All 4 sites (lines 482, 514, 719, 909) compute elapsed with the truthiness guard.                                                |
| `submitVote` / `submitChoice` / `resolveOnShrinkRef` | `gs.vote_round_player_count` | `threshold = gs.vote_round_player_count \|\| players.length` | ✓ VERIFIED  | Lines 1719, 1794, 1912 all use the snapshot with `||` fallback.                                                                  |
| `players INSERT handler`        | `votes-broadcast channel`              | single-sender `player_joined` broadcast          | ✓ VERIFIED  | Broadcast outside updater at lines 1611–1620; sender election via `ids[0] === getPlayerId(code)`.                               |
| `lib/usePresence.ts` prune timer | `supabase.from('rooms').delete()`      | `count === 0` after player delete                | ✓ VERIFIED  | Lines 51–53; room deletion after last player prune.                                                                              |
| `app/room/[code]/lobby/page.tsx` `onQuit` | `clearPlayerId` + rooms/players delete | SC-3 last-player lobby quit deletes room        | ✓ VERIFIED  | Lines 128–135; `clearPlayerId(code)` → delete player → check remaining → delete room if 0.                                       |
| `startGame` in lobby            | `gs.round_started_at` + `gs.vote_round_player_count` | Inline assignments before DB write | ✓ VERIFIED  | `lobby/page.tsx` lines 165–166 set both fields after `makeInitialGameState` and before `supabase.from('rooms').update(...)` at line 169. |

---

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable             | Source                                             | Produces Real Data | Status       |
|---------------------------------|---------------------------|----------------------------------------------------|--------------------|--------------|
| `VoteTimer` in game page        | `initialSecs`             | `gs.round_started_at` from Supabase `rooms` jsonb  | Yes — `new Date().toISOString()` written by `startGame`/`onNextRound`/`resolveVotes` before DB write | ✓ FLOWING   |
| Lobby quit → room deletion      | `remaining.length`        | `supabase.from('players').select().eq('room_id',...)`| Yes — real DB query | ✓ FLOWING   |
| Presence prune → room deletion  | `count`                   | `supabase.from('players').select('id', {count:'exact', head:true})` | Yes — real DB count query | ✓ FLOWING |
| `pseudoError` in join page      | `playerError.code`        | Supabase insert response + `idx_players_pseudo_lower` | Yes — real DB enforcement (index confirmed applied) | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                             | Command                                                                                             | Result           | Status  |
|------------------------------------------------------|-----------------------------------------------------------------------------------------------------|------------------|---------|
| `lib/types.ts` contains both new GameState fields    | `grep -c "round_started_at\|vote_round_player_count" lib/types.ts`                                 | Both found       | ✓ PASS  |
| `lib/usePresence.ts` GRACE_MS = 15_000               | Grep for `15_000` in `lib/usePresence.ts`                                                           | Line 8 confirmed | ✓ PASS  |
| `003-pseudo-unique.sql` idempotent guard             | Grep for `IF NOT EXISTS` + `idx_players_pseudo_lower`                                               | Both on lines 16–22 | ✓ PASS |
| `app/join/page.tsx` branches on 23505                | Grep for `'23505'`                                                                                  | Line 81 confirmed | ✓ PASS |
| `VoteTimer` initialSecs prop                         | Grep for `initialSecs`                                                                              | Lines 301–302 + 4 call sites | ✓ PASS |
| Type C 0-volunteer early-return                      | Grep for `vols.length === 0`                                                                        | Line 985 confirmed | ✓ PASS |
| Landing "Recommended" copy all 4 locales             | Grep for "Recommended\|Conseillé\|Recomendado\|Empfohlen" in `lib/i18n.ts`                         | Lines 22/259/494/729 | ✓ PASS |

---

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared in PLAN files; no `scripts/*/tests/probe-*.sh` found for this phase.

---

### Requirements Coverage

This phase declares no v2 AUTH/IDEN/STAT/PROF requirement IDs. All declared requirements are phase-internal success criteria (SC-1 through SC-9). REQUIREMENTS.md v2 requirements (AUTH-01 through PROF-02) remain Pending and are mapped to Phases 2/3/4 in the v2 milestone — all are out of scope for this phase. No orphaned requirements found for phase 03.

---

### Anti-Patterns Found

| File                               | Line  | Pattern                                                                | Severity     | Impact                                                                                                                               |
|------------------------------------|-------|------------------------------------------------------------------------|--------------|--------------------------------------------------------------------------------------------------------------------------------------|
| `lib/usePresence.ts`               | 6–8   | `GRACE_MS = 15_000` — contradicts CLAUDE.md "60 s de grâce (anti phone-lock)" | ⚠️ Warning  | WR-04 from code review: 15 s may be too aggressive for phone-lock use case. CLAUDE.md explicitly documented 60 s as the anti-phone-lock value. Phase intent was 15 s (D-04/D-06), but CLAUDE.md has not been updated. Advisory. |
| `app/join/page.tsx`                | 26–32 | `.then(({ data }) => ...)` — no `error` destructured on pseudo prefetch | ℹ️ Info      | WR-05 from code review: transient PostgREST errors silently ignored. No logging. Minor observability gap. Non-blocking.              |
| `app/room/[code]/game/page.tsx`    | 482–484 et al. | 4 identical IIFE blocks computing `initialSecs` — duplicated code | ℹ️ Info      | WR-03 from code review: re-computation per render is correct but drift-correction illusion; extract into helper for maintainability. Non-blocking. |
| `app/room/[code]/lobby/page.tsx` + `game/page.tsx` | Multiple | `onQuit` logic duplicated verbatim across lobby and game | ℹ️ Info | IN-04 from code review: divergence risk if one is patched without the other. Extract shared `leaveRoom()` helper. Non-blocking. |

No `TBD`, `FIXME`, or `XXX` debt markers found in phase-modified files. No unreferenced stubs or empty implementations.

---

### Human Verification Required

#### 1. SC-1: Duplicate pseudo rejection (end-to-end)

**Test:** Open two browser tabs. In tab 1, create a room with pseudo "Nico". In tab 2, join the same room code with pseudo "nico" (different case).
**Expected:** Tab 2 shows inline error "Ce pseudo est déjà pris, choisis-en un autre." (or locale equivalent) below the pseudo input. No alert dialog. Joining with a different pseudo succeeds.
**Why human:** Requires live multi-device or multi-tab test to hit the Postgres 23505 path. DB index confirmed applied; code-side handler verified statically.

#### 2. SC-2: Browser close removes player after 15 s grace; screen-lock does not

**Test:** During a live game, close a player's browser tab. Within 15 s, confirm the player is still in the roster. After 15 s, confirm their row is deleted (shown by disappearing from other players' player lists). Separately, lock the screen on a mobile device and unlock within 15 s; confirm the player is not removed.
**Expected:** Close-tab: pruned after ~15 s. Screen-lock-and-return within 15 s: player remains.
**Why human:** Requires physical device and live Supabase presence channel. `GRACE_MS=15_000` verified statically.

#### 3. SC-3: Room deleted when last player disconnects

**Test:** In a 2-player game, have one player quit (Quitter button) and the other close their tab. After > 15 s, attempt to join the room code or query the DB; the room should not exist.
**Expected:** Room row deleted automatically. Joining the old code returns "Room introuvable."
**Why human:** Requires live presence channel. Room-deletion-on-last-prune code verified statically.

#### 4. SC-4: Rejoin pre-fills old pseudo (editable, requires submit)

**Test:** Join a room with pseudo "Alice". Quit via Quitter button. Navigate back to `/join?code=XXXX`. Confirm the pseudo input is pre-filled with "Alice", a hint "Ton ancien pseudo est pré-rempli." is visible, the field is editable, and you must press Rejoindre to join.
**Expected:** Input pre-filled. Hint visible. Field editable. No silent auto-rejoin.
**Why human:** Requires localStorage state from quit + live DB query. Static code fully verified.

#### 5. SC-5: Refresh mid-round shows correct remaining timer

**Test:** During a vote phase (e.g. question selection), note the timer value, then refresh the browser. Confirm the timer resumes from approximately the correct remaining seconds, not always from 30 s.
**Expected:** After refresh, timer starts from ~(30 - elapsed_since_round_start) seconds.
**Why human:** Requires live Supabase DB with `round_started_at` written by `startGame`. Static code fully verified.

#### 6. SC-8: Mid-round joiner excluded from threshold; toast shown

**Test:** Start a 3-player game and begin a vote phase. Have a 4th player join mid-vote. Confirm the round resolves after 3 votes (not waiting for 4), and a toast pill appears at the top center of all existing players' screens.
**Expected:** Round resolves at 3 votes. Toast "[ pseudo] a rejoint la partie" briefly visible. 4th player can vote in subsequent rounds.
**Why human:** Requires 4 devices/tabs with live Supabase. Snapshot threshold and toast code fully verified statically.

#### 7. SC-7: Type C 0-volunteer triggers roulette (not "répond à voix haute")

**Test:** In a Type C round, ensure all players press "Envoyer quelqu'un au bûcher" (nobody volunteers). Confirm the roulette designation screen appears with no "répond à voix haute" text.
**Expected:** `round_c_roulette` phase renders. No volunteer reveal text. No crash.
**Why human:** `resolveTypeCChoice` routing and `VolunteersRevealScreen` guard verified statically. Live round flow with zero volunteers requires a real session to confirm actual screen rendering.

---

### Gaps Summary

No FAILED must-haves were found. All 9 success criteria have codebase evidence supporting their implementation:

- **SC-1 (duplicate pseudo):** DB index applied (user-confirmed), 23505 branch in `app/join/page.tsx` wired correctly.
- **SC-2 (presence grace):** `GRACE_MS=15_000` confirmed, note that this differs from the 60 s value documented in CLAUDE.md — see WR-04 advisory below.
- **SC-3 (room deletion):** Both automatic (presence prune) and manual (lobby `onQuit`) paths confirmed.
- **SC-4 (rejoin pseudo):** `storedPseudo` prefetch and hint render confirmed.
- **SC-5 (refresh timer):** `round_started_at` snapshotted in `startGame`, `onNextRound`, and `resolveVotes`; `VoteTimer.initialSecs` prop wired at all 4 call sites.
- **SC-6 (lobby quit):** Quit button confirmed in lobby with host-transfer/room-deletion logic.
- **SC-7 (Type C 0-volunteer):** `resolveTypeCChoice` routes to roulette; `VolunteersRevealScreen` has early-return guard.
- **SC-8 (mid-round join):** Snapshot threshold, toast broadcast (outside updater per CR-01 fix), and `player_joined` listener all confirmed.
- **SC-9 (landing copy):** "Recommended/Conseillé/Recomendado/Empfohlen" phrasing confirmed in all 4 locales.

All 7 remaining items are flagged for human verification because they require live multi-device runtime behavior that cannot be confirmed statically.

**Advisory (not a gate):** WR-04 from the code review notes that `GRACE_MS = 15_000` may be too aggressive for phone-lock scenarios. CLAUDE.md documents 60 s as the anti-phone-lock value. The phase intentionally reduced this to 15 s (D-04/D-06). If playtest confirms phone-lock within 15 s causes unintended pruning, GRACE_MS should be restored to 60_000 and CLAUDE.md updated accordingly.

---

_Verified: 2026-06-10_
_Verifier: Claude (gsd-verifier)_
