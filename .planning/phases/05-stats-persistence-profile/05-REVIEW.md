---
phase: 05-stats-persistence-profile
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/room/[code]/game/page.tsx
  - app/profile/page.tsx
  - app/page.tsx
  - lib/i18n.ts
  - lib/utils.ts
  - lib/usePresence.ts
  - supabase/migrations/005-stats-columns.sql
  - supabase/schema.sql
findings:
  critical: 1
  warning: 11
  info: 5
  total: 17
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 5 (stats persistence + profile + session fixes) was reviewed at standard depth, with cross-references into `app/join/page.tsx`, `app/room/[code]/lobby/page.tsx` and `lib/game.ts` where the reviewed code depends on them. The stats write path (`EndScreen` upsert, RLS scoping, idempotency via `UNIQUE(user_id, session_id)` + `ignoreDuplicates`) is fundamentally sound, the migration is correctly additive, and the i18n `Dict` typing does enforce key parity across the four languages.

However, the review found **one game-freezing logic divergence** in the new vote-threshold capping (the `min()` cap was applied in 2 of the 3 resolution trigger paths but not in the broadcast handler — which can permanently hang a Type C round with the host's escape hatch also hidden), plus a cluster of warnings: a documented OAuth-redirect rule violated on the landing page, a new `user_id`-linking path that bypasses the IDEN-02 same-account guard, a latent uuid type mismatch on `session_uuid`, and several hardcoded-text violations of project rule #1 in the profile page.

## Critical Issues

### CR-01: Broadcast `vote_count` handler uses uncapped threshold — Type C round can hang forever with no escape hatch

**File:** `app/room/[code]/game/page.tsx:1731`
**Issue:** The phase introduces `voteThreshold = Math.min(gs.vote_round_player_count || players.length, players.length)` (line 1934) precisely so a disconnected player lowers the bar. `submitVote` (line 1973), `submitChoice` (line 2053), and `resolveOnShrink` (line 2198) all use this capped value. But the `vote_count` broadcast handler — the path that resolves the round **when the last voter is not the advancer** — uses the raw, uncapped snapshot:

```ts
const threshold = gs.vote_round_player_count || playersRef.current.length   // line 1731 — no min() cap
if (payload.count < threshold) return
```

Failure sequence (Type C, no timer per SC-7):
1. Round starts with 4 players → `vote_round_player_count = 4`.
2. One player disconnects before acting and is pruned (roster = 3). `resolveOnShrink` fires but count (2) < 3 → correctly waits.
3. The 3rd player acts last and is **not** the advancer → their client broadcasts `count = 3` but skips resolution.
4. On the advancer's client, the handler computes `threshold = 4` → `3 < 4` → returns. Nobody resolves.
5. The host cannot rescue: `ChoiceScreen`'s `HostSkipBtn` is gated on `voteCount < Math.min(snapshot, players.length)` (line 951) → `3 < 3` is false → **the skip button is hidden**.

`round_c_choice` has no countdown (SC-7 decision), and `resolveOnShrink` only fires on a further roster decrease — so the room is stuck until someone quits or the 30-min TTL reaps it. On timer phases (`voting_question`, `round_a_vote`, `round_b_vote`) the same divergence causes an unnecessary 30 s stall until `onForce` fires, masking the bug.

**Fix:**
```ts
// line 1731 — same capping as voteThreshold (line 1934)
const live = playersRef.current.length
const threshold = Math.min(gs.vote_round_player_count || live, live)
```
(See also WR-10: this divergence exists because the threshold formula is duplicated in four places.)

## Warnings

### WR-01: Landing-page OAuth `redirectTo` violates the documented "always `/auth/callback?next=`" rule

**File:** `app/page.tsx:112`
**Issue:** `handleSignIn` uses `redirectTo: window.location.href`. CLAUDE.md is explicit: *"OAuth `redirectTo` : TOUJOURS pointer sur `/auth/callback?next=<path>` — jamais sur l'URL courante."* The EndScreen CTA in the same phase does it correctly (`game/page.tsx:1417-1425`); the landing page does not. Risks: the PKCE `?code=<uuid>` lands on `/` and depends on client-side `detectSessionInUrl` instead of the hardened server-side callback; the raw origin URL may not be covered by Supabase's Redirect URLs allow-list (CLAUDE.md only guarantees `/auth/callback` is whitelisted), in which case Supabase silently falls back to the Site URL — breaking sign-in from preview/staging origins.
**Fix:**
```ts
redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/')}`
```

### WR-02: Silent `user_id` link on SIGNED_IN bypasses the IDEN-02 same-account guard

**File:** `app/room/[code]/game/page.tsx:1846-1852`
**Issue:** On `SIGNED_IN`, the game page unconditionally runs `players.update({ user_id }).eq('id', pid)`. It never checks whether **another row in the same room already carries that `user_id`**. `/join` goes to great lengths to preserve the invariant "jamais 2 lignes même `user_id` dans une room" (presence check, `user_id: null` fallback — playtest #4 decision), because its IDEN-02 lookup uses `.maybeSingle()` on `eq('user_id', ...)` (`app/join/page.tsx:170-175`). The exact scenario from playtest #4 re-enters through this new path: a player taps the end-screen "save your stats" CTA and signs in with the host's Google account → two rows share one `user_id` → the next `/join` IDEN-02 lookup gets multiple rows, `maybeSingle()` errors, the guard is skipped, and a third row with the same `user_id` is inserted. Note `SIGNED_IN` also re-fires on tab focus in supabase-js v2, so the update runs repeatedly (harmless once linked, but widens the race window).
**Fix:** Before the update, query `players` for an existing row with this `user_id` in `roomRef.current.id`; skip the link (leave `user_id` null) if one exists and it isn't `pid` — mirroring the `/join` guard.

### WR-03: `session_uuid` from `genId()` can be a non-UUID, but `user_session_stats.session_id` is `uuid` — stats write silently fails

**File:** `app/room/[code]/game/page.tsx:1327` (write), `supabase/schema.sql:71` (column), `app/room/[code]/lobby/page.tsx:189` (generation)
**Issue:** `genId()` explicitly documents a non-UUID fallback (`${Date.now()}-${rand}-${rand}`, `lib/utils.ts:14-23`) for non-secure contexts (HTTP on LAN — the project's standard phone-testing setup, which is exactly why `rooms.host_id` was made `text` per the schema comment on line 23). `user_session_stats.session_id` is `uuid NOT NULL`. A game started over HTTP/LAN produces a non-UUID `session_uuid`; every signed-in player's end-of-game upsert then fails with `22P02 invalid input syntax for type uuid`, logged to console only — stats silently lost and the "saved ✓" receipt never shows. The lobby comment "genId is safe on HTTP/LAN" is true for generation but false for this consumer.
**Fix:** Either change `session_id` to `text` (additive migration, consistent with the `host_id` precedent), or guard the upsert: skip + warn when `gs.session_uuid` doesn't match a UUID regex.

### WR-04: Hardcoded UI text in profile history — violates project rule #1 (zéro texte hardcodé)

**File:** `app/profile/page.tsx:439, 349`
**Issue:** Two violations of the absolute "zero hardcoded text" rule:
- Line 439: `` `· ${row.rounds_played} manches` `` — French "manches" shown to EN/ES/DE users. (Also cosmetic: when `themeCaption` is null the caption renders with a leading "· ".)
- Line 349: `...replace(/^\d+\s*/, '') || 'sessions'` — hardcoded English fallback `'sessions'`, plus a regex that strips the leading number from a localized sentence; it only works while all four languages happen to lead with the digit.
**Fix:** Add dedicated keys, e.g. `profile.rounds_count: (n) => ...` (or reuse a variant of `game.round_of`) and `profile.stat_sessions_total: "Sessions"`, in all four dictionaries.

### WR-05: Retry button label built by string-splitting the error message

**File:** `app/profile/page.tsx:271`
**Issue:** `<GhostBtn ...>{fr.profile.error_load.split('.')[0] + '…'}</GhostBtn>` renders "Impossible de charger ton profil…" as the **retry button label** — error text presented as an action, and a fragile manipulation of an i18n string (breaks if a translation reorders its sentences).
**Fix:** Add `profile.retry` to all dictionaries and use it directly.

### WR-06: `fetchStats(uid)` ignores its `uid` parameter — no explicit `user_id` filter, RLS-only scoping

**File:** `app/profile/page.tsx:139-153`
**Issue:** The function signature takes `uid?: string` and both call sites pass `user.id`, but the body never uses it — the query has no `.eq('user_id', uid)`. The dead parameter strongly suggests the filter was intended and dropped. Today RLS (`stats_select_own`) scopes the rows, but this project has a documented history of RLS policies being the thing that breaks (`schema.sql` exists largely to repair them); a future policy regression here would expose every user's stats to every signed-in user with zero client-side defense.
**Fix:** `.eq('user_id', uid)` (and make `uid` required), keeping RLS as the second layer.

### WR-07: Pause does not freeze the vote timer — a >30 s pause force-resolves the vote immediately on resume

**File:** `app/room/[code]/game/page.tsx:350-358` (`RoundTimer`), `2097-2101` (`onResume`)
**Issue:** `RoundTimer` computes remaining time from `gs.round_started_at` wall-clock elapsed. During pause the vote screen (and timer) unmounts; `onResume` does not adjust `round_started_at` for the paused duration. Pausing a vote phase for more than the remaining seconds → on resume `initialSecs = 0` → the advancer's `VoteTimer` fires `onExpire` on mount → the round is force-resolved with partial votes the instant the group resumes. This contradicts the documented pause spec ("En pause : les timers se figent").
**Fix:** In `onPause`, store `paused_at`; in `onResume`, shift `round_started_at` forward by the pause duration (`round_started_at += now - paused_at`) before writing the resumed state.

### WR-08: 20 s presence grace regresses the documented 60 s anti-phone-lock decision; CLAUDE.md not updated

**File:** `lib/usePresence.ts:11`
**Issue:** `GRACE_MS = 20_000` replaces the 60 s grace that CLAUDE.md records as a playtest decision explicitly motivated by phone locks ("après 60 s de grâce (anti phone-lock)"). A guest who locks their phone for ~30 s mid-game (extremely common at a table) now gets their player row deleted — which cascades **their already-cast votes** away and drops the threshold, then forces a re-join. The phase scope lists 20 s as intentional, but (a) the regression risk against the playtest decision is real and should be revalidated at the next playtest, and (b) CLAUDE.md still states 60 s grace and 2 min heartbeat (now 30 s, line 14) — the "source de vérité" is now wrong on both numbers.
**Fix:** Re-validate 20 s against the phone-lock scenario (mobile browsers drop the websocket within seconds of locking); update CLAUDE.md's "Cycle de vie des rooms" section either way.

### WR-09: `createRoom` has no in-flight guard — Enter key can double-create rooms

**File:** `app/page.tsx:124-125, 261`
**Issue:** The create **button** is disabled while `loading`, but the input's `onKeyDown={(e) => e.key === 'Enter' && createRoom()}` is not gated, and `createRoom` itself never checks `loading`. Two quick Enter presses run two concurrent `createRoom` calls → two rooms + two host player rows inserted, `setPlayerId` written twice (second wins), and two racing `router.push` calls; one orphan room lingers until the 30-min sweep.
**Fix:** First line of `createRoom`: `if (loading) return`.

### WR-10: Vote-threshold formula duplicated in four places with three variants

**File:** `app/room/[code]/game/page.tsx:947, 951, 1731, 1934` (+ `533, 535, 560-562, 759-761` using `players.length`)
**Issue:** The resolution threshold is computed independently in: the parent (`voteThreshold`, min-capped, line 1934), `ChoiceScreen` (inline min, duplicated twice at 947/951), the broadcast handler (raw snapshot, line 1731 — the CR-01 bug), while `QuestionSelectionScreen` / `DesignationVoteScreen` / `ConfessionVoteScreen` use plain `players.length` for `VoteProgress` totals and `HostSkipBtn` visibility. The display total can therefore disagree with the actual resolution threshold (e.g. "3 / 5 ont voté" when the round resolves at 4), and any future tweak must be replicated in four spots — which is exactly how CR-01 happened.
**Fix:** Compute `voteThreshold` once in the parent and pass it as a prop to all vote screens (replacing both the inline `Math.min` expressions and the `players.length` totals); reuse it in the broadcast handler via a ref or by recomputing from `playersRef`.

### WR-11: Profile archetype card renders the same fallback string twice (title and body), in v2.0 for every user

**File:** `app/profile/page.tsx:328-337` (and `295`)
**Issue:** In the dormant path (all users in v2.0, since `tag_scores` is always `{}`), both the archetype name and the descriptive paragraph under it render `fr.archetypes.archetype_fallback` — the card shows "Une simple personne" twice in a row. The body line was clearly meant to be an explanatory string (e.g. "play more games to reveal your archetype"). Additionally, in the future `hasTraits` path (line 295) the archetype **name** is also hardcoded to `archetype_fallback` — the 21 archetype keys present in `lib/i18n.ts:195-215` are never selected, so when v3.0 tags light up, every user will still be "Une simple personne" above real trait bars, contradicting the "lights up without redeploy (D-08)" comment.
**Fix:** Add a dedicated `archetypes.dormant_body` key for the description; either implement the archetype selection (simple/hybrid rules from the spec) now behind the `hasTraits` gate, or remove the misleading "lights up without redeploy" claim.

## Info

### IN-01: Trait "percentages" are relative to the top trait and floored at 4%

**File:** `app/profile/page.tsx:200, 312, 318`
**Issue:** `pct = Math.max(4, Math.round((t.score / maxTraitScore) * 100))` — the top trait always reads 100%, and the visual minimum-width floor (4) leaks into the **displayed** number (a 1% trait shows "4%"). The spec defines % over the trait total. Dormant in v2.0 but will surface wrong numbers in v3.0.
**Fix:** Divide by `totalTagScore` for the label; apply the 4% floor only to the bar width.

### IN-02: `computeTraitTotals` doesn't floor negative trait totals at 0

**File:** `app/profile/page.tsx:102-111`
**Issue:** The spec says "Floor à 0 par trait" (tags can carry negative points). Raw sums can go negative, skewing `totalTagScore` and the `hasTraits` gate. Dormant until v3.0.
**Fix:** `totals[key] = Math.max(0, totals[key])` after accumulation.

### IN-03: Join/leave toasts capture the locale dictionary at mount

**File:** `app/room/[code]/game/page.tsx:1746, 1801`
**Issue:** The realtime handlers (registered once in the `[code]` effect) close over `fr`; switching language mid-game leaves toasts in the old language.
**Fix:** Read the dictionary via a ref kept in sync each render, or store a message key + payload in state and translate at render time.

### IN-04: Resume-banner query selects `status` but never uses it

**File:** `app/page.tsx:71`
**Issue:** `select('id, status')` — `status` is dead. (Routing to the lobby is correct: the lobby forwards `playing`/`ended` rooms to `/game` on load.) Either drop the field or use it to route directly.

### IN-05: Profile fetch relies on PostgREST's implicit 1000-row cap

**File:** `app/profile/page.tsx:142-145`
**Issue:** D-07 requires cumulative stats over **all** rows, but the unbounded `select('*')` is silently truncated at the PostgREST default (1000). Cumulative totals would quietly undercount for very heavy users. Low urgency; note for when an aggregate RPC becomes worthwhile. Also pre-existing: the `confession.b1_*` keys in `lib/i18n.ts:117-120` are dead (B1 was removed in playtest #3) across all four dictionaries.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
