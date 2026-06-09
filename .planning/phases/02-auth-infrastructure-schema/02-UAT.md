---
status: testing
phase: 02-auth-infrastructure-schema
source: [02-VERIFICATION.md]
started: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Test

number: 1
name: AUTH-04 full anonymous game flow (regression)
expected: |
  Run the 11-step smoke script in 02-VALIDATION.md against prod (Railway).
  Full flow: create room → join → vote question → round A → round B2 roulette → round C → 7 rounds → end screen → replay (new game, votes accepted)
awaiting: user response

## Tests

### 1. AUTH-04 full anonymous game flow (regression)
expected: 11-step smoke script in 02-VALIDATION.md passes end-to-end, no UNIQUE constraint errors on replay, group title appears
result: [pending]

### 2. Live DB migration confirmation
expected: Supabase Dashboard shows players.user_id column (uuid, nullable YES) and user_session_stats table with UNIQUE index on (user_id, session_id). Run the SQL verification queries in 02-VALIDATION.md.
result: [pending]

### 3. GET /auth/callback live behavior
expected: Missing-code request → 302 to /. Invalid/expired code → 302 to /. No 500 errors, no OAuth detail exposed in response.
result: [pending]

### 4. Middleware JWT refresh live confirmation
expected: With a real Supabase Auth session, navigate between pages and refresh — session persists without re-login (AUTH-02).
result: [pending]

### 5. /api/health not degraded by middleware
expected: GET /api/health still returns 200 { status: "ok", uptime: N } with no added latency from getUser() in middleware. Confirm no auth errors appear in Railway logs.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
