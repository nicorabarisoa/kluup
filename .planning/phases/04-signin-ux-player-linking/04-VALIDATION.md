---
phase: 4
slug: signin-ux-player-linking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`next build`) + manual browser testing |
| **Config file** | `tsconfig.json` (existing) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | — | — | N/A | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | AUTH-01 | — | sign-in button only on landing/join, never in game flow | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | AUTH-01, AUTH-03 | — | anonymous player never prompted to sign in mid-game | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | IDEN-02 | — | signed-in reconnect skips insert, uses existing row | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | AUTH-03 | — | green dot on Quit only when signed in | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — Phase 4 modifies existing `'use client'` components with no pure logic units that warrant unit tests. Verification is by TypeScript compilation + manual browser OAuth flow.

*All Phase 4 behaviors are browser-only and involve OAuth redirects, Supabase session state, and UI rendering — these require manual verification or E2E tooling (out of scope for this phase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sign in with Google on landing page → return signed in | AUTH-01 | OAuth redirect loop — cannot be automated without E2E tooling | 1. Open `/`. 2. Click "Se connecter". 3. Complete Google OAuth. 4. Verify top bar shows `[Prénom] · Se déconnecter`. |
| Sign in with Google on join page → return signed in | AUTH-01 | OAuth redirect loop | 1. Open `/join`. 2. Click "Se connecter" in top bar. 3. Complete Google OAuth. 4. Verify chip shows signed-in state. |
| Sign out from landing page | AUTH-03 | Requires live auth session | 1. Sign in. 2. Click "Se déconnecter". 3. Verify page refreshes to `/` with sign-in button visible. |
| Pseudo pre-filled with Google first name | AUTH-01 | Requires live Google account | 1. Sign in. 2. Navigate to landing. 3. Verify pseudo input shows first name from Google. |
| IDEN-02: Signed-in user on second device reconnects | IDEN-02 | Requires two devices + live auth | 1. Join room on device A while signed in. 2. On device B (no localStorage), navigate to `/join?code=XXX`. 3. Verify no duplicate player row is created. |
| Green dot on Quit button in game/lobby | AUTH-03 | Requires live auth session in game | 1. Sign in + join a room. 2. Verify small green dot on Quit button. 3. Sign out, rejoin — verify no green dot. |
| Anonymous player: no auth prompt during game | AUTH-01 | Full anonymous game flow required | 1. Play through all round types without signing in. 2. Verify no sign-in prompt appears at any point. |
| Auth session survives browser refresh | SC-5 | Requires live auth + middleware | 1. Sign in. 2. Navigate to lobby. 3. Refresh page. 4. Verify still signed in (green dot still visible). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
