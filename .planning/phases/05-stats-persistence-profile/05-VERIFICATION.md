---
phase: 05-stats-persistence-profile
verified: 2026-06-12T16:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6 must-haves verified (automated); human smoke required
  gaps_closed:
    - "OAuth slow sign-in stats loss — localStorage stash + PendingStatsFlusher + deferred bounce + ended-room TTL exemption all implemented and verified in code"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Signed-in stats write (STAT-01/02/03)"
    expected: "Sign in with Google, complete a full game, reach end screen — exactly one row appears in user_session_stats; 'Stats sauvegardées ✓' shows; refresh = no duplicate; replay = second row with distinct session_id"
    why_human: "Live Supabase upsert from a browser-authenticated session; requires OAuth + prod DB observation"
  - test: "Anonymous CTA OAuth round-trip with slow sign-in (PROF-02 / gap closure)"
    expected: "Anonymous player taps 'Se connecter avec Google', takes several minutes on the Google sign-in screen (intentionally slow to let the room be swept), completes OAuth. The user EITHER lands back on /room/{code}/game (room still alive — 30-min TTL) OR lands on / (room swept). In EITHER case: a row appears in user_session_stats for the just-played session, and the 'Stats sauvegardées ✓' localized toast appears (bottom-center pill). No silent stats loss."
    why_human: "Core UAT gap that previously failed (test 2 in 05-UAT.md). Fix code exists and passes all automated checks, but requires a real OAuth round-trip with a multi-minute delay to confirm the PendingStatsFlusher fires and the toast appears in the production scenario"
  - test: "Profile page with real data (PROF-01)"
    expected: "Signed-in user at /profile sees cumulative stats grid (sum over all rows), session history newest first (max 20), each row with group title, date, theme caption (when present), stat chips. Unauthenticated visit redirects to /"
    why_human: "RLS scoping, cumulative reduce over all rows, and per-row title localization require a live session with real data"
  - test: "WR-03 prod console check"
    expected: "On deployed HTTPS prod (kluup.app), sign in and complete a game. No '22P02 invalid input syntax for type uuid' error in browser devtools console. 'Stats sauvegardées ✓' appears."
    why_human: "genId() falls back to a non-UUID on HTTP/LAN dev. Prod HTTPS always uses crypto.randomUUID() — confirming no silent failure requires runtime observation"
---

# Phase 05: Stats Persistence + Profile — Re-Verification Report

**Phase Goal:** Close the OAuth stats-loss gap — an anonymous player who taps the end-screen sign-in CTA and takes several minutes on Google lands back with their session stats saved, not silently lost. Also build the /profile page and wire stats persistence.
**Verified:** 2026-06-12T16:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plans 05-05 and 05-06 added post-UAT)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After a signed-in player reaches the end screen, their session stats are saved automatically — no double-write on replay | VERIFIED | `EndScreen` `useEffect([gs?.phase, gs?.session_uuid, user?.id])` gates on `user?.id` and `gs.session_uuid`; upserts with `onConflict: 'user_id,session_id', ignoreDuplicates: true` (`game/page.tsx:1318-1343`). No write in cleanup/unmount. |
| 2 | Each game session is a separate row; replay does not overwrite the previous session's record | VERIFIED | `session_id: gs.session_uuid`; lobby's `startGame` stamps a fresh `genId()` UUID on each launch; `ignoreDuplicates` ensures one row per unique `(user_id, session_uuid)` pair. |
| 3 | A signed-in user visiting /profile sees their full stats history including all group titles earned | VERIFIED | `app/profile/page.tsx` (479 lines): auth guard (`getUser()` → `router.push('/')` when null), RLS-scoped `select('*').order('played_at', { ascending: false })`, cumulative reduce over ALL rows, `history = allRows.slice(0, 20)`, per-session group title lookup. |
| 4 | An anonymous user who completes a game sees a "sign in to save your stats" CTA on the end screen — no CTA when already signed in | VERIFIED | `!isSignedIn` gate at `game/page.tsx:1527` renders the `save_prompt.*` card after the stats list. `isSignedIn && saved` at line 1553 shows the receipt line. Mutually exclusive branches. |
| 5 | A long game (>1 hour) does not lose Realtime channel sync after JWT expiry | VERIFIED | `TOKEN_REFRESHED` branch at `game/page.tsx:1883-1886` calls `await supabase.realtime.setAuth(session.access_token)`. `INITIAL_SESSION` not wired to `setAuth` (Pitfall 5 avoided). |
| 6 | `user_session_stats` includes `tag_scores jsonb` and the profile page accumulates it into a dormant archetype block | VERIFIED | Column in `005-stats-columns.sql:9` and `schema.sql:78,89`. Written as `tag_scores: {}` in the upsert. `profile/page.tsx:96-123` implements `computeTraitTotals` / `traitScoreTotal`; archetype block dormant while total = 0. |
| 7 | An anonymous player who takes several minutes completing Google sign-in (room swept by pg_cron during OAuth) lands back with their session stats saved and sees a confirmation toast | VERIFIED (code) | `handleCTASignIn` calls `setPendingStats({...stash..., stashed_at: Date.now()})` before `signInWithOAuth` (`game/page.tsx:1421-1435`); `PendingStatsFlusher` (mounted in layout inside `LocaleProvider`) flushes on `SIGNED_IN` with idempotent upsert + clears stash + shows `save_prompt.flushed` toast; `init()` not-found branch defers `router.push('/')` by 3500ms when a matching stash exists (`game/page.tsx:1660-1682`); `cleanup_dead_rooms()` exempts `status='ended'` rooms from the 90s sweep (30-min TTL in `lifecycle.sql:71`). Human re-test required to confirm end-to-end in production. |

**Score: 7/7 truths verified** (6 by static code inspection; truth 7 verified at code level, awaiting human re-test)

---

### Deferred Items

No items deferred to later phases. All truths are claimed by Phase 5.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/005-stats-columns.sql` | Additive idempotent migration for theme/rounds_played/tag_scores | VERIFIED | 9 lines; `ADD COLUMN IF NOT EXISTS theme/rounds_played/tag_scores`; zero `POLICY` keyword (comment says "RLS rule") |
| `supabase/schema.sql` | Source-of-truth mirror of three new columns + RLS intact | VERIFIED | Columns in CREATE TABLE block (lines 76-78) + idempotent ALTER (lines 87-89); `stats_insert_own/select_own/update_own` policies intact (lines 155-167) |
| `lib/i18n.ts` | `profile.*` (11 keys), `save_prompt.*` (3 keys + `flushed`), `end.stats_saved` in all four locales | VERIFIED | `profile:` at lines 219, 485, 749, 1013; `save_prompt:` at lines 232, 498, 762, 1026; `save_prompt.flushed` at lines 236, 502, 766, 1030; `end.stats_saved` at lines 157, 423, 687, 951 |
| `app/room/[code]/game/page.tsx` | Auth state, stats write effect, Realtime setAuth, CTA + saved line, stash before OAuth, deferred bounce | VERIFIED | `user`/`saved` state declared; auth effect with `onAuthStateChange`; `TOKEN_REFRESHED` → `setAuth`; upsert at lines 1318-1343; CTA at lines 1527-1549; saved receipt at lines 1553-1559; `setPendingStats` at line 1424; `getPendingStats` check in `init()` at line 1674 |
| `lib/utils.ts` | `setPendingStats` / `getPendingStats` / `clearPendingStats` + `PendingStats` type + 24h TTL | VERIFIED | All helpers present (lines 168-190); `PENDING_STATS_TTL_MS = 24 * 60 * 60 * 1000`; 24h staleness check in `getPendingStats`; SSR-safe, try/catch throughout |
| `app/PendingStatsFlusher.tsx` | `'use client'` global flusher — `SIGNED_IN` → read stash → upsert → clear → toast | VERIFIED | File exists (111 lines); `'use client'`; `flushingRef` idempotency guard; upserts with `onConflict: 'user_id,session_id', ignoreDuplicates: true`; `clearPendingStats()` on success; toast renders `fr.save_prompt.flushed`; `code` and `stashed_at` excluded from upsert object |
| `app/layout.tsx` | `PendingStatsFlusher` mounted once inside `LocaleProvider` | VERIFIED | `<LocaleProvider><PendingStatsFlusher />{children}</LocaleProvider>` at line 50 |
| `supabase/lifecycle.sql` | `cleanup_dead_rooms()` exempts `status='ended'` rooms from 90s sweep (30-min TTL) | VERIFIED | CASE expression: `WHEN status = 'ended' THEN interval '30 minutes' ELSE interval '90 seconds'` at lines 71-74; Blocks 1/2/4/5 untouched; prod apply confirmed in 05-06-SUMMARY.md |
| `app/profile/page.tsx` | Profile page with auth guard, RLS-scoped fetch, cumulative grid, history, dormant archetype | VERIFIED | 479 lines; `'use client'`; auth guard at lines 162-165; fetch at lines 142-145; cumulative reduce at lines 182-190; `history = allRows.slice(0, 20)` at line 193; archetype block at lines 277-338 |
| `app/page.tsx` | Landing top-bar name chip linking to /profile | VERIFIED | `Link href="/profile"` at line 203; separate `button` sign-out tap target at lines 211-217 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `EndScreen` write effect | `user_session_stats` | `supabase.upsert onConflict user_id,session_id ignoreDuplicates` | WIRED | `game/page.tsx:1322-1343` |
| `onAuthStateChange TOKEN_REFRESHED` | Realtime channels | `supabase.realtime.setAuth(session.access_token)` | WIRED | `game/page.tsx:1883-1886` |
| `handleCTASignIn` | `localStorage kluup_pending_stats` | `setPendingStats(payload)` before `signInWithOAuth` | WIRED | `game/page.tsx:1421-1435`; stash includes `code`, `stashed_at`, all stats fields |
| `PendingStatsFlusher onAuthStateChange SIGNED_IN` | `user_session_stats` | `supabase.upsert(stash fields, { onConflict, ignoreDuplicates })` | WIRED | `PendingStatsFlusher.tsx:35-58`; `user_id` from `session.user.id` (Auth-validated), never from stash |
| `PendingStatsFlusher` | `app/layout.tsx` | mounted inside `LocaleProvider` as sibling to `{children}` | WIRED | `layout.tsx:50` |
| `init() room-not-found` | deferred `router.push('/')` | `getPendingStats()` check + `setTimeout(3500)` | WIRED | `game/page.tsx:1660-1682` |
| `SignInSaveCTA` | `/auth/callback?next=/room/{code}/game` | `signInWithOAuth redirectTo` via `${origin}/auth/callback?next=...` | WIRED | `game/page.tsx:1440`; CLAUDE.md OAuth gotcha not regressed |
| `app/profile/page.tsx` | `user_session_stats` | `supabase.from('user_session_stats').select('*').order('played_at', ...)` | WIRED | `profile/page.tsx:142-145` |
| `app/page.tsx` name chip | `/profile` | `Link href="/profile"` | WIRED | `page.tsx:202-208` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/profile/page.tsx` | `allRows` | `supabase.from('user_session_stats').select('*').order(...)` — RLS-scoped live DB query | Yes | FLOWING |
| `EndScreen` (stats write) | `user_session_stats` upsert | `gs.stats.designated/confessed/volunteered`, `gs.stats.rounds_*`, `gs.session_uuid` from live `game_state` jsonb | Yes | FLOWING |
| `PendingStatsFlusher` | `user_session_stats` upsert | `getPendingStats()` reads localStorage stash set by `handleCTASignIn` before OAuth redirect | Yes — stash contains real game data | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly (Dict exhaustiveness + all new types) | `npx tsc --noEmit` | No output (exit 0) | PASS |
| Migration file has 3 ADD COLUMN IF NOT EXISTS and zero POLICY keyword | `node -e` grep checks | 3 columns present; "POLICY" absent | PASS |
| `save_prompt.flushed` present in all 4 locales | `node -e` match count | 4 occurrences | PASS |
| PendingStatsFlusher has real upsert + clears stash + shows toast | `node -e` pattern checks | All 3 present | PASS |
| Stash includes `code` and `stashed_at` | `node -e` regex | Both present in `setPendingStats({...})` call | PASS |
| Flusher upsert excludes `code` and `stashed_at` (stash-only metadata) | `node -e` negative checks | Neither present in upsert object | PASS |
| `lifecycle.sql` has CASE-based TTL: 30 min ended, 90s otherwise | `node -e` checks | All three tokens present | PASS |
| Gap-closure commits exist in git history | `git log` | 731f0d8, 7881b0c, 7eb53c8 all present | PASS |

Step 7b: Live Supabase session required for stats write and OAuth flow. No runnable entry points testable without auth.

---

### Probe Execution

Step 7c: No probe scripts found for this phase. Phase has no probe-based verification contract.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STAT-01 | 05-01, 05-03, 05-05 | Session stats written at game end for signed-in player; also via PendingStatsFlusher for slow-OAuth case | SATISFIED | Upsert in `EndScreen` (`game/page.tsx:1318-1343`) + `PendingStatsFlusher` flush on `SIGNED_IN` |
| STAT-02 | 05-01, 05-03 | Each session is a separate row; replay does not overwrite | SATISFIED | `session_id: gs.session_uuid`; new `genId()` on each `startGame`; `ignoreDuplicates` |
| STAT-03 | 05-01, 05-03 | Stats writes are idempotent — UNIQUE + ignoreDuplicates | SATISFIED | `onConflict: 'user_id,session_id', ignoreDuplicates: true` in both write paths |
| PROF-01 | 05-04 | Signed-in user views stats history on /profile | SATISFIED | `app/profile/page.tsx` — auth guard, fetch, cumulative reduce, last-20 history, group titles |
| PROF-02 | 05-03, 05-05 | Anonymous users see CTA; stats saved after OAuth even with slow sign-in | SATISFIED (code) | CTA at `game/page.tsx:1527`; stash + flusher close the slow-OAuth gap; human re-test required |

Note on REQUIREMENTS.md traceability table: The table maps these requirements to "Phase 4" but the implementation is in Phase 5. Requirements are marked `[x]` complete — naming discrepancy is documentation-only.

---

### Anti-Patterns Found

The following warnings carry over from the initial verification (no new debt markers introduced by Plans 05-05/05-06):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/profile/page.tsx` | 439 | Hardcoded `manches` (French string) | WARNING (WR-04) | EN/ES/DE users see French "manches" in session history rows |
| `app/profile/page.tsx` | 349 | Hardcoded `sessions` English fallback + regex on i18n string | WARNING (WR-04) | Hardcoded fallback shown in DE/ES; fragile against locale reordering |
| `app/profile/page.tsx` | 271 | `fr.profile.error_load.split('.')[0] + '…'` as retry button label | WARNING (WR-05) | Error message text reused as action label — fragile if translations change sentence structure |
| `app/profile/page.tsx` | 295 | `hasTraits` path renders `fr.archetypes.archetype_fallback` as the archetype name | WARNING (WR-11) | When tag_scores become non-zero in v3.0, the 21-archetype selection logic is absent from this branch — every user still shown fallback above real trait bars |
| `app/profile/page.tsx` | 334-336 | Dormant path renders `fr.archetypes.archetype_fallback` twice (name + body) | WARNING (WR-11) | "Une simple personne" displayed twice consecutively in v2.0 |
| `app/page.tsx` | 112 | `redirectTo: window.location.href` in `handleSignIn` | WARNING (WR-01) | Violates CLAUDE.md OAuth gotcha — PKCE `?code=<uuid>` lands without server-side exchange; may break on non-allow-listed origins |
| `app/room/[code]/game/page.tsx` | 1894 | `players.update({ user_id })` on `SIGNED_IN` with no IDEN-02 guard | WARNING (WR-02) | If user signs in with the host's Google account on the end screen, two players in the same room share a `user_id` |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase-modified file.

No new anti-patterns introduced by Plans 05-05 or 05-06.

---

### Human Verification Required

#### 1. Signed-in stats write (STAT-01/02/03)

**Test:** Sign in with Google on the deployed app (`kluup.app`). Play a full game as a signed-in player. Reach the end screen.
**Expected:** "Stats sauvegardées ✓" appears on the end screen. Supabase dashboard shows exactly one row in `user_session_stats` for the session (with `designated_count`, `confessed_count`, `volunteered_count`, `group_title`, `theme`, `rounds_played` populated). Refreshing the end screen does not add a second row. Clicking "Rejouer", completing another game, and reaching the end screen produces a second row with a different `session_id`.
**Why human:** Live Supabase upsert from a browser-authenticated session; requires OAuth + prod DB observation.

#### 2. Anonymous CTA OAuth round-trip with slow sign-in — primary gap re-test (PROF-02)

**Test:** In an incognito/private window (not signed in), complete a full game, reach the end screen. Tap "Se connecter avec Google". On the Google sign-in screen, intentionally wait several minutes (2-4 min) before completing sign-in — long enough for the pg_cron sweep to delete the solo room. Then complete sign-in.
**Expected:** Regardless of which page the OAuth callback lands on (game page or home): (a) a localized "Stats sauvegardées ✓" bottom-center toast appears within ~4 seconds of landing; (b) the Supabase dashboard shows a row in `user_session_stats` for the just-played session, linked to the Google account; (c) the session appears in `/profile` history.
**Why human:** This is the exact scenario that previously failed (UAT test 2). The fix mechanisms (localStorage stash, PendingStatsFlusher, deferred bounce, 30-min TTL for ended rooms) are all verified at code level. A real OAuth round-trip with multi-minute delay on prod is required to confirm the full path works end-to-end.

#### 3. Profile page with real data (PROF-01)

**Test:** As a signed-in user who has completed at least one game, visit `/profile`. Also open a fresh incognito window and navigate to `/profile`.
**Expected:** Signed-in user sees: cumulative stats grid with correct sums over all sessions, session history newest first (max 20 rows), each row with group title, date, stat chips, and theme caption when present. Unauthenticated visitor is redirected to `/`.
**Why human:** RLS scoping, cumulative reduction over all rows, and group title localization require a live session with real data.

#### 4. WR-03 prod confirmation (HTTP/LAN regression guard)

**Test:** On the deployed HTTPS prod app (`kluup.app`), sign in and complete a game. Open browser devtools Console — observe the network tab and console during the end-screen stats write.
**Expected:** No `22P02` or `invalid input syntax for type uuid` error. "Stats sauvegardées ✓" appears.
**Why human:** `genId()` produces a non-UUID on HTTP/LAN (fallback `${Date.now()}-${rand}-${rand}`). Prod HTTPS always uses `crypto.randomUUID()` — but confirming this in the production scenario requires runtime observation.

---

### Re-Verification: Gap Closure Summary

The UAT gap (test 2: OAuth round-trip stats loss) is closed at the code level by Plans 05-05 and 05-06:

**Fix direction 1 (most robust — Plan 05-05):** The entire save payload is stashed in `localStorage` via `setPendingStats()` before the OAuth redirect. A globally-mounted `PendingStatsFlusher` upserts it to `user_session_stats` on `SIGNED_IN`, independent of room lifetime and landing page. The flush is idempotent (`ignoreDuplicates` + stash cleared on success). A 24h staleness TTL prevents a cancelled OAuth from flushing a stale session later.

**Fix direction 3 (no silent bounce — Plan 05-05):** `init()`'s room-not-found branch detects a matching pending-stats stash and defers `router.push('/')` by 3500ms, giving the flusher's ~4s toast window time to fire before navigation.

**Fix direction 2 (defense-in-depth — Plan 06):** `cleanup_dead_rooms()` now exempts `status='ended'` rooms from the 90s sweep (30-min TTL), so a just-finished game end screen survives a typical OAuth round-trip. The prod DB function was confirmed live by the user (`pg_get_functiondef` output, documented in 05-06-SUMMARY.md).

All automated checks pass. Human re-test of the primary scenario (test 2 above, with intentional multi-minute delay) is required to advance status to `passed`.

---

_Verified: 2026-06-12T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — gap closure after UAT failure on OAuth round-trip_
