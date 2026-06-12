# Debug: OAuth return from end-screen CTA lands on home page (stats never saved)

status: root-caused (read-only investigation, no fix applied)
date: 2026-06-12
uat: Phase 05, test 2 (PROF-02), severity major

## Symptom

User report (verbatim): "en fin de partie j'ai fait exprès de mettre du temps a me connecter sur
google car je ne trouvais pas mon mot de passe, après avoir réussi ça m'a remis à l'acceuil"

- Anonymous player finishes a game, end screen (`phase=ended`) shows the "Sauvegarde tes stats" CTA.
- Player taps the CTA, deliberately takes SEVERAL MINUTES on the Google sign-in screen.
- After sign-in completes, they land on `/` (home) instead of `/room/{code}/game`.
- The session never appears in `/profile` history — the retroactive save never fired.
- Likely a SOLO playtest (one player in the room).

## Investigation trace

### 1. The OAuth redirect chain itself is correct — CONFIRMED

- `app/room/[code]/game/page.tsx:1417-1425` — `handleCTASignIn()` calls
  `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo:
  `${origin}/auth/callback?next=${encodeURIComponent('/room/{code}/game')}` } })`.
  This follows the CLAUDE.md gotcha (never the raw game URL). No `skipBrowserRedirect` —
  **this is a full-page navigation away from the app; all React state is destroyed.**
- `app/auth/callback/route.ts:24-25` — `next` validated (`startsWith('/')`, not `//`) → passes
  for `/room/{code}/game`.
- `app/auth/callback/route.ts:55-65` — `exchangeCodeForSession(code)`, then
  `NextResponse.redirect(new URL(next, origin))` **on both success and error**. So the callback
  DID send the user back to `/room/{code}/game`. The bounce to `/` happens AFTER that.

### 2. The redirect to home — CONFIRMED

- `app/room/[code]/game/page.tsx:1638-1642` — on mount, `init()` fetches the room:
  ```ts
  const { data: roomData } = await supabase.from('rooms').select().eq('code', code).single()
  if (!roomData) { router.push('/'); return }
  ```
  This is the ONLY `router.push('/')` reachable on a fresh page load (the others at 2155/2186 are
  quit/leave handlers). **Room gone → straight to home.** This exactly matches the symptom.

### 3. Why the room was gone — CONFIRMED mechanism

- `lib/usePresence.ts:14,80-86` — the heartbeat (`HEARTBEAT_MS = 30s`) that bumps
  `rooms.last_activity` runs only while a client is mounted on the lobby/game page. The CTA's
  full-page redirect to Google unmounts the game page (`removeChannel` in the effect cleanup,
  `usePresence.ts:89-94`). In a SOLO room, that leaves **zero connected clients → zero heartbeats**.
- `supabase/lifecycle.sql:52-65` — `cleanup_dead_rooms()` deletes any room with
  `last_activity < now() - interval '90 seconds'` (no exemption for `status='ended'`).
  Players and votes cascade away (`lifecycle.sql:17-20`, schema FKs).
- `supabase/lifecycle.sql:88-94` — the sweep is scheduled via **pg_cron every minute**.
  `.planning/phases/03-playtest-quality-fixes/03-08-SUMMARY.md:38,68-70,105` confirms this is
  LIVE in the prod DB (user-confirmed: pg_cron 1.6.4, jobid 6, 60s threshold applied in 03-08;
  commit `0c0dda0` later raised the file to 90s — whether the 90s version was re-applied to the
  live DB is unverified, but 60s vs 90s is immaterial here).
- Net effect: **a solo room is deleted ~60-150s after the player leaves for Google.** The user
  took "several minutes" → the room (and its players + votes rows) was certainly gone by the time
  the callback redirected them back.

### 4. Why the stats were never saved — CONFIRMED

- `app/room/[code]/game/page.tsx:1318-1343` — the retroactive save effect lives inside
  `EndScreen` and reads `gs` = `room.game_state` (plus `gs.session_uuid`, `gs.stats`).
  After the OAuth round-trip the page is a **fresh mount**: `gs` must be re-fetched from the
  `rooms` row. Room deleted → `init()` bails at line 1642 → `EndScreen` never mounts → the
  D-05 retroactive save never runs. The `SIGNED_IN` listener that would link
  `players.user_id` (`page.tsx:1847-1857`) also never runs on the game page (user is on `/`),
  and the players row is deleted anyway.

### 5. The design knew about this scenario but mis-analyzed it — CONFIRMED

- `.planning/phases/05-stats-persistence-profile/05-RESEARCH.md:404-412` (Pitfall 3,
  "Retroactive Save Fails Silently When Room Is Dead") explicitly considered the slow-OAuth +
  room-TTL case but concluded: *"The retroactive save relies on `gs.stats` still being in React
  state … So the save itself works fine even after room deletion."*
  **That assumption is false**: `signInWithOAuth` is a full-page redirect — React state does NOT
  survive the round-trip. On return, `gs.stats` must come from the DB row that the sweep just
  deleted. Pitfall 3 only hardened the cosmetic part (silent `console.warn` on the players-row
  link), not the data loss.

## Root cause

The end-screen sign-in CTA performs a full-page OAuth redirect that unmounts the only connected
client of a solo room; with no presence heartbeat, the pg_cron sweep (`cleanup_dead_rooms()`,
60-90s TTL, every minute — `supabase/lifecycle.sql:52-94`) deletes the room (cascading players +
votes, including `game_state` with `session_uuid`/`stats`) during the multi-minute Google sign-in.
The callback correctly redirects to `/room/{code}/game`, but the fresh mount's room lookup returns
nothing and `app/room/[code]/game/page.tsx:1642` (`if (!roomData) { router.push('/'); return }`)
sends the user to home. Because `EndScreen` never mounts, the retroactive stats upsert
(`page.tsx:1318-1343`) never fires — the session is lost permanently (its source data no longer
exists anywhere).

## Contributing factors

1. **No TTL exemption for `ended` rooms** — `cleanup_dead_rooms()` treats a just-finished game
   the same as an abandoned lobby (`lifecycle.sql:57-61`).
2. **Stats survive only inside `rooms.game_state`** — there is no client-side stash of the
   end-of-game payload (`session_uuid`, per-player stats, theme, rounds) that could survive the
   OAuth navigation. Everything needed for the upsert is small and known BEFORE the CTA is tapped.
3. **The room-not-found guard is silent** — `page.tsx:1642` pushes `/` with no message, so the
   user can't tell whether sign-in failed or the room expired ("ça m'a remis à l'accueil").
4. **Multi-player variant of the same bug (HYPOTHESIS, code-supported):** with other players
   still on the end screen the room survives, but the signing-in player's `players` row is pruned
   by a peer after `GRACE_MS = 20s` (`lib/usePresence.ts:11,46-72`). On return their `myId` is
   still in localStorage, so they pass the `!myId` guard (`page.tsx:1876-1881`) and the save can
   still fire (it reads `gs.stats[myId]`, not the players row) — but the `players.user_id` link
   (`page.tsx:1853`) hits a deleted row. Not the reported failure, but the same time-pressure class.

## CONFIRMED vs HYPOTHESES

CONFIRMED (read in code / phase records):
- The only fresh-load path to `/` is the room-not-found guard at `page.tsx:1642`.
- The callback redirects to `next` even on exchange error (`route.ts:55-65`) — it cannot be the
  component that sent the user to `/`.
- pg_cron sweep is live in prod (03-08-SUMMARY, user-confirmed jobid 6), TTL 60-90s, no `ended`
  exemption, cascade deletes players + votes.
- The retroactive save requires a live `rooms.game_state` after a full-page OAuth round-trip.
- 05-RESEARCH Pitfall 3 explicitly (and wrongly) asserted React state would carry `gs.stats`
  through the OAuth flow.

HYPOTHESES (plausible, not directly observable):
- The exact prod TTL at incident time (60s if the 03-08 version is still live, 90s if `0c0dda0`
  was re-applied) — immaterial given a multi-minute delay.
- The playtest was solo (stated in the failure context; consistent with the room dying — with
  peers present the room would have survived).
- A secondary possibility — PKCE flow-state expiry during the long sign-in making
  `exchangeCodeForSession` fail — would leave the user unauthenticated but STILL land them on
  the game URL first; it converges to the same `/` redirect only because the room is dead.
  Not the root cause of the home redirect.

## Recommended fix directions (not implemented)

1. **Stash the save payload before redirecting** (most robust): in `handleCTASignIn`
   (`page.tsx:1417`), write `{ session_uuid, theme, rounds_played, my stats, group_title, code }`
   to `localStorage` (e.g. `kluup_pending_stats`) before `signInWithOAuth`. On any page
   (game page room-not-found path, or a small hook in the layout / home page), after `SIGNED_IN`,
   flush the pending payload to `user_session_stats` and show "Stats sauvegardées ✓", then clear
   it. This makes the save independent of room lifetime entirely.
2. **Keep `ended` rooms alive longer**: exempt `status='ended'` from the 90s sweep (e.g. give
   ended rooms a 30-60 min TTL in `cleanup_dead_rooms()`), so the end screen survives an OAuth
   round-trip and "Rejouer" still works. Complementary to (1), not a substitute (a user can
   always exceed any TTL).
3. **Graceful room-gone landing**: when `init()` finds no room but a pending-stats stash (or a
   `kluup_last_room` breadcrumb) exists, show a "session expirée — stats sauvegardées" notice
   instead of a silent bounce to `/`.
4. Update `.planning/phases/05-stats-persistence-profile/05-RESEARCH.md` Pitfall 3: the premise
   "gs.stats still in React state" is invalid across `signInWithOAuth`'s full-page redirect.
