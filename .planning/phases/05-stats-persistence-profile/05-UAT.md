---
status: testing
phase: 05-stats-persistence-profile
source: [05-VERIFICATION.md]
started: 2026-06-12T00:00:00Z
updated: 2026-06-12T00:00:00Z
---

## Current Test

number: 1
name: Signed-in stats write (STAT-01/STAT-02)
expected: |
  Signed in with Google, play a game to the end screen. One row appears in
  user_session_stats (Supabase Table Editor). Refreshing the end screen does
  NOT duplicate the row. "Rejouer" then completing a second game creates a
  SECOND row with a different session_id.
awaiting: user response

## Tests

### 1. Signed-in stats write (STAT-01/STAT-02)
expected: Signed in, reach end screen → one row in user_session_stats; refresh = no duplicate; replay = second row with different session_id.
result: [pending]

### 2. Anonymous CTA OAuth round-trip (PROF-02)
expected: Anonymous game to end screen → "sign in to save your stats" CTA shown after the stats. Tap it, complete Google sign-in → land back on /room/{code}/game, retroactive save fires, "Stats sauvegardées ✓" appears. No CTA when already signed in.
result: [pending]

### 3. Profile page with real data (PROF-01)
expected: Signed-in visit to /profile → cumulative 2×2 stats grid over all sessions, newest-first history (max 20) with group titles. Signed-out visit → redirect to /.
result: [pending]

### 4. WR-03 prod console check
expected: On prod HTTPS, no `22P02 invalid input syntax for type uuid` error in the browser console when the end screen saves stats.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
