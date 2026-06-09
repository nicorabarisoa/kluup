---
phase: 02
slug: auth-infrastructure-schema
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — smoke tests + build-time type check |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | Manual browser smoke test (see script below) |
| **Estimated runtime** | Build: ~30s; Manual smoke: ~5 min |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + execute manual smoke test for AUTH-04 regression
- **Before `/gsd-verify-work`:** Full suite must be green (build passes + smoke test passes)
- **Max feedback latency:** 60 seconds (build check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-?-01 | TBD | 1 | IDEN-01 | — | `players.user_id` nullable; existing rows have NULL | SQL query | `npm run build` | ❌ W0 | ⬜ pending |
| 02-?-02 | TBD | 1 | AUTH-02 | — | Middleware refreshes tokens silently; anon passes through | Manual smoke | `npm run build` | ❌ W0 | ⬜ pending |
| 02-?-03 | TBD | 1 | AUTH-04 | — | Full anon game flow: create→join→play→end→replay with no regression | Manual smoke | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm `npm run build` passes on clean checkout before any changes
- [ ] Run AUTH-04 baseline smoke test before any schema migrations (snapshot current behavior)

*No test framework to install — build + manual smoke is the validation baseline for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anonymous game flow end-to-end | AUTH-04 | No test framework; requires real Supabase + browser | See smoke test script below |
| Session cookie persists across refresh (authenticated) | AUTH-02 | Requires Google OAuth configured in Supabase Dashboard (Phase 3 blocker) | Sign in with Google → refresh page → still signed in |
| `players.user_id` column nullable in prod DB | IDEN-01 | Schema migration must run on live Supabase DB | Run SQL verification query below |

### AUTH-04 Smoke Test Script

```
1. Open {app-domain} in a private/incognito window
2. Create a room (host)
3. Open second device/tab, join the room
4. Start the game
5. Play through: voting_question → round_a_vote → round_a_reveal
6. Continue: round_b_vote → round_b2_roulette
7. Continue: round_c_choice → (volunteer or roulette path)
8. Continue until ended (7 rounds or use "End session")
9. Verify end screen with stats and group title
10. Host clicks "Rejouer" → back to lobby, new theme selection
11. Start second game — verify votes accepted (no UNIQUE constraint error)
```

**Critical:** Run this full flow AFTER every DB migration and AFTER middleware.ts is deployed.

### SQL Verification Queries (post-migration)

```sql
-- Verify players.user_id column exists and is nullable
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'players' AND column_name = 'user_id';
-- Expected: user_id | uuid | YES

-- Verify user_session_stats table and UNIQUE constraint
SELECT table_name FROM information_schema.tables WHERE table_name = 'user_session_stats';
-- Expected: 1 row

SELECT indexname FROM pg_indexes WHERE tablename = 'user_session_stats';
-- Expected: index containing user_id + session_id (UNIQUE)

-- Verify existing anonymous player rows are unaffected
SELECT COUNT(*) FROM players WHERE user_id IS NOT NULL;
-- Expected: 0 (all pre-migration rows have NULL user_id)
```

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
