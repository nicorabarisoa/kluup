---
phase: 05-stats-persistence-profile
plan: 03
subsystem: auth
tags: [supabase, auth, realtime, stats, upsert, oauth, i18n]

requires:
  - phase: 05-stats-persistence-profile
    plan: 01
    provides: save_prompt.* and profile.* i18n namespaces; user_session_stats table + RLS from Phase 2
  - phase: 05-stats-persistence-profile
    plan: 02
    provides: user_session_stats migration (theme, rounds_played, tag_scores columns) applied to prod

provides:
  - Game-page root auth state (user, saved) from getUser() + onAuthStateChange
  - TOKEN_REFRESHED handler calling supabase.realtime.setAuth (SC-5 JWT resilience)
  - SIGNED_IN handler updating user state + silently linking players.user_id (D-05)
  - Idempotent stats upsert to user_session_stats firing on ended phase mount (STAT-01/02/03)
  - SignInSaveCTA rendered when !isSignedIn after stats list (PROF-02)
  - Stats saved receipt ("Stats sauvegardées ✓") for isSignedIn && saved
  - end.stats_saved i18n key in all 4 locales (fr/en/es/de)

affects:
  - 05-04 (profile page plan — depends on stats rows written by this plan)
  - Any future plan touching EndScreen or game-page auth

tech-stack:
  added: []
  patterns:
    - "WR-01 auth pattern from join page applied to game page root: getUser() once on mount + onAuthStateChange subscription"
    - "Single onAuthStateChange subscription carries TOKEN_REFRESHED (setAuth), SIGNED_IN (user update + player link), and unsubscribes on cleanup"
    - "Idempotent upsert: supabase.from('user_session_stats').upsert({...}, { onConflict: 'user_id,session_id', ignoreDuplicates: true })"
    - "CR-03 OAuth pattern: redirectTo always via /auth/callback?next=<path>, never raw page URL"
    - "D-05 retroactive write: useEffect re-fires when user?.id flips non-null after OAuth"

key-files:
  created: []
  modified:
    - app/room/[code]/game/page.tsx
    - lib/i18n.ts

key-decisions:
  - "Single onAuthStateChange listener carries all three responsibilities (TOKEN_REFRESHED setAuth + SIGNED_IN user update + SIGNED_IN player link) — avoids multiple subscriptions, matches project pattern"
  - "Stats write effect deps are [gs?.phase, gs?.session_uuid, user?.id] — minimal but complete to cover standard write + D-05 retroactive write while avoiding stale closures (Pitfall 1)"
  - "PrimaryBtn in CTA wrapped in a div for marginTop spacing — PrimaryBtn has no style prop"
  - "Plan verification regex for fixedNext used incorrect shell escaping — code is correct (/room/${code}/game template literal)"

requirements-completed: [STAT-01, STAT-02, STAT-03, PROF-02]

duration: 18min
completed: 2026-06-12
---

# Phase 5 Plan 3: Stats Persistence Wiring Summary

**Idempotent upsert to user_session_stats at EndScreen mount with OAuth CTA retroactive save and TOKEN_REFRESHED Realtime JWT refresh**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-12T08:00:00Z
- **Completed:** 2026-06-12T08:18:00Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Auth state (user, saved) added to GamePage root via WR-01 pattern; single onAuthStateChange subscription handles TOKEN_REFRESHED Realtime setAuth (SC-5), SIGNED_IN user state update, and silent players.user_id link (D-05)
- Idempotent stats upsert fires on ended phase mount for signed-in users; re-fires retroactively after OAuth CTA sign-in (D-05); ignoreDuplicates prevents duplicate rows on refresh (STAT-03)
- SignInSaveCTA card with save_prompt.* keys rendered for anonymous users; "✓ saved" receipt line rendered when isSignedIn && saved; end.stats_saved key added to all 4 locales

## Task Commits

1. **Task 1: Game-page root auth state + Realtime setAuth + retroactive-save listener** - `e7772a2` (feat)
2. **Task 2: Stats write effect + SignInSaveCTA + saved receipt in EndScreen** - `afe91ca` (feat)

## Files Created/Modified

- `app/room/[code]/game/page.tsx` — Added User import, user/saved state, auth mount effect (TOKEN_REFRESHED/SIGNED_IN listener), extended EndScreen props, write effect, handleCTASignIn, CTA card, saved receipt
- `lib/i18n.ts` — Added end.stats_saved key to fr/en/es/de locales

## Decisions Made

- Single `onAuthStateChange` subscription in GamePage root rather than inside EndScreen — avoids multiple subscriptions and matches the project's established pattern (from join page)
- Write effect placed inside EndScreen (not at root) because it needs access to EndScreen-local values (totalRounds, titleKey, myStats) without additional prop drilling
- `PrimaryBtn` in the CTA wrapped in a `<div style={{ marginTop: 12 }}>` since PrimaryBtn has no style prop — avoids changing the shared primitive
- Plan's verification regex for `fixedNext` had an incorrect shell escape pattern (`\$\{code\}` in node -e becomes `${code}` in JS string but not in regex). Code is correct — `const next = \`/room/\${code}/game\`` is the right template literal

## Deviations from Plan

None - plan executed exactly as written, with one minor note:

The plan's automated verification script for `fixedNext` used an improperly escaped regex in a node `-e` context (`\/room\/\$\{code\}\/game`). In shell, the `\$` in a single-quoted string passes through as `$` to node, but in the node string the regex `\/room\/\${code}\/game` interprets `{code}` as a character class quantifier. The actual code `const next = \`/room/${code}/game\`` is correct and matches the D-04 requirement. Verified by direct file inspection.

## Issues Encountered

None - TypeScript compiled cleanly after both tasks were applied. Build passed without warnings.

## User Setup Required

None - no external service configuration required. The user_session_stats table and columns were already migrated in plan 05-02.

## Known Stubs

None - the write path is fully wired. tag_scores: {} is intentionally dormant (D-08, activates in v3.0 when questions are tagged).

## Threat Flags

No new security surface introduced beyond what was in the plan's threat model:
- T-05-07: Write gated on user?.id from server-validated getUser() — mitigated
- T-05-08: redirectTo always via /auth/callback?next=... — mitigated
- T-05-10: Anonymous clients never attempt the write (gated on user?.id non-null) — mitigated
- T-05-11: players.user_id update scoped to eq('id', pid) with silent failure — mitigated

## Next Phase Readiness

- Stats rows will be written to user_session_stats for signed-in players as of this plan
- Plan 05-04 (profile page) can read those rows via RLS-scoped SELECT
- The end.stats_saved i18n key is available for use in profile page if needed

---
*Phase: 05-stats-persistence-profile*
*Completed: 2026-06-12*

## Self-Check: PASSED

- `app/room/[code]/game/page.tsx` exists: FOUND
- `lib/i18n.ts` exists: FOUND
- Commit e7772a2 exists: FOUND
- Commit afe91ca exists: FOUND
- `npx tsc --noEmit` passes: VERIFIED
- `npm run build` passes: VERIFIED
