---
phase: 05-stats-persistence-profile
plan: "05"
subsystem: stats-persistence
tags: [stats, oauth, localStorage, pending-stats, flusher, i18n]
dependency_graph:
  requires: []
  provides: [pending-stats-stash, pending-stats-flusher, i18n-save-prompt-flushed]
  affects: [app/layout.tsx, app/room/[code]/game/page.tsx, lib/utils.ts, lib/i18n.ts]
tech_stack:
  added: [PendingStatsFlusher client component]
  patterns: [localStorage stash + SIGNED_IN flush, flushingRef idempotency guard, 24h staleness TTL]
key_files:
  created:
    - app/PendingStatsFlusher.tsx
  modified:
    - lib/utils.ts
    - lib/i18n.ts
    - app/layout.tsx
    - app/room/[code]/game/page.tsx
decisions:
  - "Stash payload captured before signInWithOAuth (full-page redirect destroys React state)"
  - "user_id sourced from session.user.id (Auth-validated), never from the stash (T-05-16)"
  - "flushingRef boolean guard prevents getUser() + SIGNED_IN double-flush"
  - "Deferred push (3500ms) in init() room-not-found when matching stash exists, matching flusher ~4s toast"
  - "code and stashed_at are stash-only metadata — deliberately excluded from upsert object"
  - "tag_scores: {} written at flush time (D-08 dormant, consistent with existing write effect)"
metrics:
  duration: ~10min
  completed: "2026-06-12T15:27:35Z"
  tasks_completed: 2
  files_changed: 5
requirements: [PROF-02, STAT-01]
---

# Phase 05 Plan 05: Pending-Stats Stash + OAuth Flush Summary

**One-liner:** localStorage stash before OAuth redirect + globally-mounted PendingStatsFlusher closes the silent stats-loss gap when a solo room is swept during a slow Google sign-in.

## What Was Built

### Task 1 — `lib/utils.ts` + `lib/i18n.ts`

`lib/utils.ts` gained three new exports backed by the `kluup_pending_stats` localStorage key:

- `PendingStats` type (all `user_session_stats` columns except `user_id`, plus `stashed_at` metadata)
- `PENDING_STATS_TTL_MS` = 24 hours
- `setPendingStats(p)` — writes the payload before the OAuth redirect
- `getPendingStats()` — reads and self-expires stashes older than 24h (returns null + clears)
- `clearPendingStats()` — called on successful flush

All helpers are SSR-safe (`typeof window === 'undefined'` guard) and wrapped in try/catch, mirroring the existing `getPlayerId`/`setPlayerId`/`clearPlayerId` pattern.

`lib/i18n.ts` gained `save_prompt.flushed` in all four locales:
- FR: "Stats sauvegardées ✓"
- EN: "Stats saved ✓"
- ES: "Estadísticas guardadas ✓"
- DE: "Stats gespeichert ✓"

`Dict` exhaustiveness enforced by TypeScript — adding to fewer than 4 locales fails `tsc`.

### Task 2 — `app/PendingStatsFlusher.tsx`, `app/layout.tsx`, `app/room/[code]/game/page.tsx`

**`app/PendingStatsFlusher.tsx`** (`'use client'`):
- On mount: calls `supabase.auth.getUser()` — if already signed in, flushes the stash
- Subscribes to `supabase.auth.onAuthStateChange` — flushes on `SIGNED_IN`
- `flushingRef` boolean guard prevents concurrent/double flushes from both paths
- Flush: reads `getPendingStats()` (null-safe, 24h TTL applied); upserts to `user_session_stats` with `onConflict: 'user_id,session_id', ignoreDuplicates: true`; clears stash on success; shows a localized bottom-center toast (`save_prompt.flushed`) for ~4s
- On flush error: `console.error` + does NOT clear stash (allows retry on next `SIGNED_IN`; 24h TTL still bounds it)
- Does not import anything room-specific; safe on every route

**`app/layout.tsx`**: `PendingStatsFlusher` mounted once inside `<LocaleProvider>` (needs `useT()`), as a sibling to `{children}`. Layout remains a Server Component — importing a `'use client'` child is valid in App Router.

**`app/room/[code]/game/page.tsx`**:

A) `handleCTASignIn` now calls `setPendingStats({...})` — with `gs.session_uuid`, per-player counts (same formula as the existing write effect), `titleKey`, `totalRounds`, `code`, `stashed_at: Date.now()` — before `signInWithOAuth`. Guard: stash only written when `gs.session_uuid` is truthy. `redirectTo` still routes through `/auth/callback?next=<path>` (CLAUDE.md OAuth gotcha unchanged).

B) `init()`'s room-not-found branch (`if (!roomData)`) now checks `getPendingStats()` for a matching `code`. When a stash for this room exists, the push to `/` is deferred by 3500ms (matching the flusher's ~4s toast window) instead of being immediate. Comment cites `.planning/debug/oauth-return-lands-on-home.md`. When no matching stash exists, the original immediate push is preserved.

C) A code comment near the modified branch documents the **known multi-player residual** (see below).

## Gap Closed

Root cause (`.planning/debug/oauth-return-lands-on-home.md`): anonymous player taps "Se connecter" on the end screen → OAuth full-page redirect destroys React state → pg_cron sweep deletes solo room (60–90s TTL, no `ended` exemption) during multi-minute Google sign-in → callback redirects back to game page → `init()` finds no room → silent `router.push('/')` → `EndScreen` never mounts → retroactive write effect never fires → session stats lost permanently.

Fix direction 1 (most robust): the entire save payload is now stashed client-side before the redirect. The flush is independent of room lifetime, React state, and landing page. Fix direction 3 (no silent bounce): `init()` defers navigation so the confirmation toast is visible.

## Deviations from Plan

None — plan executed exactly as written.

## Known Residual (documented, not a blocker)

**Multi-player room variant:** when other players are still on the end screen, the room survives the sweep, but the signing-in player's `players` row may be pruned by a peer after `GRACE_MS = 20s` (`lib/usePresence.ts`). On OAuth return, `myId` is still in localStorage so the page passes the `!myId` guard and the standard retroactive write effect can fire (it reads `gs.stats[myId]`, not the players row). However, if the pruning already happened, `players.user_id` linking (`page.tsx`) hits a deleted row. The localStorage stash still saves the stats via the flusher regardless. No blocking fix required; path differs from the solo-room sweep handled here. Documented as a code comment near `init()`'s not-found branch and in this SUMMARY.

## Threat Coverage

| Threat | Mitigation |
|--------|-----------|
| T-05-16 Spoofing | `user_id` from `session.user.id` (Auth-validated), never from stash |
| T-05-17 Info disclosure | `clearPendingStats()` on successful flush; 24h TTL on read |
| T-05-18 DoS duplicate writes | `flushingRef` + `ignoreDuplicates` + stash cleared on success |
| T-05-22 Stale stash flush | `getPendingStats()` returns null and clears when `stashed_at > 24h` |

## Self-Check: PASSED

Files created/modified:
- app/PendingStatsFlusher.tsx: FOUND
- app/layout.tsx: modified (PendingStatsFlusher mounted)
- lib/utils.ts: modified (3 helpers + PendingStats type + PENDING_STATS_TTL_MS)
- lib/i18n.ts: modified (save_prompt.flushed in 4 locales)
- app/room/[code]/game/page.tsx: modified (CTA stash + init deferred bounce)

Commits:
- 731f0d8: feat(05-05): add pending-stats stash helpers and save_prompt.flushed i18n key
- 7881b0c: feat(05-05): close stats-loss gap — stash before OAuth, global flusher, deferred bounce

Build: `npm run build` passes. `npx tsc --noEmit` passes.
