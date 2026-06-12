---
status: complete
phase: 05-stats-persistence-profile
source: [05-VERIFICATION.md]
started: 2026-06-12T00:00:00Z
updated: 2026-06-12T16:22:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Signed-in stats write (STAT-01/STAT-02)
expected: Signed in, reach end screen → one row in user_session_stats; refresh = no duplicate; replay = second row with different session_id.
result: pass

### 2. Anonymous CTA OAuth round-trip (PROF-02)
expected: Anonymous game to end screen → "sign in to save your stats" CTA shown after the stats. Tap it, complete Google sign-in → land back on /room/{code}/game, retroactive save fires, "Stats sauvegardées ✓" appears. No CTA when already signed in.
result: issue
reported: "en fin de partie j'ai fait exprès de mettre du temps a me connecter sur google car je ne trouvais pas mon mot de passe, après avoir réussi ça m'a remis à l'acceuil"
severity: major

### 2b. Anonymous CTA OAuth round-trip — re-test after gap closure (05-05 + 05-06)
expected: Same scenario as test 2, with intentional delay (2-3 min on Google sign-in). After completing sign-in, wherever you land (home or game page): "Stats sauvegardées ✓" toast appears, session row appears in /profile history. No silent bounce.
result: pass
note: "Google auth works fine. Stats saved. Fix confirmed."

### 5. Join via link — flash of lobby before name form
expected: Arriving at /join?code=XXX via a shared link shows the name-entry form immediately with no visible flash of the lobby screen.
result: issue
reported: "petite frame où je vois le lobby avant que l'écran pour mettre mon nom soit visible, quelques microsecondes"
severity: minor

### 6. Replay — host decision forces all players back to lobby
expected: When host taps "Rejouer" at end screen, other players should have a choice (replay or leave). If host leaves instead, host rights transfer to the oldest remaining player. Players are not forcefully navigated away.
result: issue
reported: "quand l'hôte appuie sur replay ça force tout le monde à aller au lobby. Les autres joueurs devraient pouvoir choisir de rejouer ou quitter. Si l'hôte quitte, le plus ancien joueur devient hôte."
severity: major

### 3. Profile page with real data (PROF-01)
expected: Signed-in visit to /profile → cumulative 2×2 stats grid over all sessions, newest-first history (max 20) with group titles. Signed-out visit → redirect to /.
result: pass
note: "Page works as expected, but the session lost in test 2's OAuth round-trip issue is absent from history (consequence of gap #2, not a profile bug)."

### 4. WR-03 prod console check
expected: On prod HTTPS, no `22P02 invalid input syntax for type uuid` error in the browser console when the end screen saves stats.
result: pass

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After tapping the end-screen CTA and completing Google sign-in (even after a long delay), the user lands back on /room/{code}/game, retroactive save fires, and 'Stats sauvegardées ✓' appears"
  status: failed
  reason: "User reported: en fin de partie j'ai fait exprès de mettre du temps a me connecter sur google car je ne trouvais pas mon mot de passe, après avoir réussi ça m'a remis à l'acceuil"
  severity: major
  test: 2
  root_cause: "OAuth CTA full-page redirect unmounts the solo room's only client → presence heartbeat stops → pg_cron cleanup_dead_rooms() (60-90s TTL, no exemption for status='ended') deletes the room during the multi-minute Google sign-in → on return, room lookup fails and the silent guard at app/room/[code]/game/page.tsx:1642 router.push('/') fires before EndScreen and its retroactive save effect (page.tsx:1318-1343) can mount"
  artifacts:
    - path: "app/room/[code]/game/page.tsx"
      issue: "line 1642: silent room-not-found guard redirects to /; lines 1417-1425: CTA redirect destroys all React state; lines 1318-1343: retroactive save depends on a live rooms.game_state row"
    - path: "supabase/lifecycle.sql"
      issue: "lines 52-94: 60-90s TTL sweep with no exemption for status='ended' rooms; pg_cron runs every minute (live in prod, jobid 6)"
    - path: "lib/usePresence.ts"
      issue: "heartbeat keeping last_activity fresh stops the instant the sole player navigates to Google"
  missing:
    - "Stash the save payload (session_uuid, theme, rounds, my stats, group_title) in localStorage in handleCTASignIn before redirecting; flush it to user_session_stats on SIGNED_IN regardless of room survival"
    - "Exempt status='ended' rooms from the short TTL sweep (longer TTL) so the end screen survives an OAuth round-trip"
    - "Replace the silent router.push('/') room-not-found guard with an informative landing when a pending-stats stash exists"
  debug_session: ".planning/debug/oauth-return-lands-on-home.md"
  resolution: "Fixed by plans 05-05 + 05-06. Re-test passed."

- truth: "Arriving at /join?code=XXX via a shared link shows the name-entry form immediately with no flash of the lobby screen"
  status: failed
  reason: "User reported: petite frame où je vois le lobby avant l'écran pour mettre mon nom, quelques microsecondes"
  severity: minor
  test: 5
  note: "Pre-existing UX glitch, not a phase 05 regression. Likely the lobby render before the redirect-to-join guard fires."

- truth: "When the host taps Rejouer at the end screen, other players are not forcefully navigated — they can choose to replay or leave. If the host leaves, the oldest remaining player inherits host rights."
  status: failed
  reason: "User reported: quand l'hôte appuie sur replay ça force tout le monde à aller au lobby. Les autres joueurs devraient pouvoir choisir de rejouer ou quitter."
  severity: major
  test: 6
  note: "Pre-existing behavior, not a phase 05 regression. Needs separate UX redesign: end-screen replay should be opt-in per player, not host-forced."
