---
phase: 03
slug: playtest-quality-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js / browser testing (no dedicated test framework detected) |
| **Config file** | none — manual browser testing for realtime flows |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-pseudo-unique | TBD | 1 | SC-1 | T-03-01 | Duplicate pseudo rejected at DB level, not client | manual | `npm run build` | ✅ | ⬜ pending |
| 03-presence-grace | TBD | 1 | SC-2,3 | — | Phantom player removed after 15s, not on screen-lock | manual | `npm run build` | ✅ | ⬜ pending |
| 03-timer-refresh | TBD | 1 | SC-5 | — | Timer resumes from correct remaining time after refresh | manual | `npm run build` | ✅ | ⬜ pending |
| 03-mid-round-join | TBD | 1 | SC-8 | — | New player excluded from current round threshold | manual | `npm run build` | ✅ | ⬜ pending |
| 03-type-c-zero-volunteers | TBD | 1 | SC-7 | — | 0 volunteers triggers roulette, no "responds out loud" | manual | `npm run build` | ✅ | ⬜ pending |
| 03-lobby-quit | TBD | 1 | SC-6 | — | Quit button present and functional in lobby | manual | `npm run build` | ✅ | ⬜ pending |
| 03-pseudo-rejoin | TBD | 1 | SC-4 | — | Pre-populated but editable pseudo on rejoin | manual | `npm run build` | ✅ | ⬜ pending |
| 03-landing-copy | TBD | 1 | SC-9 | — | "conseillé entre 3 et 10 joueurs" in all 4 languages | manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (no test framework to install).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate pseudo rejected | SC-1 | Requires live Supabase DB constraint + real join flow | Open two browser tabs, join same room with same pseudo; second tab must see error message |
| Presence grace period (15s) | SC-2 | Requires realtime Supabase presence, cannot mock | Join a room, close tab, reopen within 15s — still in roster; wait 15s+ — removed |
| Screen-lock does not trigger removal | SC-2 | Device-dependent; requires actual mobile | Lock mobile screen, unlock within 15s — player still in room |
| Last-player deletion | SC-3 | Requires DB cascade verification | Join solo room, quit — room deleted (verify in Supabase dashboard) |
| Timer resumes after refresh | SC-5 | Requires active game round timing | Start a vote, refresh mid-round, verify remaining time is correct (< 30s) |
| Mid-round join threshold | SC-8 | Requires coordinated 2+ player session | Have 2 players in game, start vote, have 3rd player join mid-vote, verify threshold stays at 2 |
| Type C 0-volunteer roulette | SC-7 | Requires active Type C round | Play Type C, all players send someone else, verify roulette appears (not "responds out loud") |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
