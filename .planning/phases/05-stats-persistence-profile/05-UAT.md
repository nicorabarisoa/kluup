---
status: complete
phase: 05-stats-persistence-profile
source: [05-VERIFICATION.md]
started: 2026-06-12T00:00:00Z
updated: 2026-06-12T12:00:00Z
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

### 3. Profile page with real data (PROF-01)
expected: Signed-in visit to /profile → cumulative 2×2 stats grid over all sessions, newest-first history (max 20) with group titles. Signed-out visit → redirect to /.
result: pass
note: "Page works as expected, but the session lost in test 2's OAuth round-trip issue is absent from history (consequence of gap #2, not a profile bug)."

### 4. WR-03 prod console check
expected: On prod HTTPS, no `22P02 invalid input syntax for type uuid` error in the browser console when the end screen saves stats.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After tapping the end-screen CTA and completing Google sign-in (even after a long delay), the user lands back on /room/{code}/game, retroactive save fires, and 'Stats sauvegardées ✓' appears"
  status: failed
  reason: "User reported: en fin de partie j'ai fait exprès de mettre du temps a me connecter sur google car je ne trouvais pas mon mot de passe, après avoir réussi ça m'a remis à l'acceuil"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
