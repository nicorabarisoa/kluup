---
phase: 04-signin-ux-player-linking
plan: "04"
subsystem: ui
tags: [auth, oauth, google, landing, user_id, pseudo-prefill, i18n, typescript]

# Dependency graph
requires:
  - "04-01 (auth i18n namespace — sign_in, sign_out, pseudo_prefilled_hint keys)"
provides:
  - "auth state hook + sign-in/sign-out pill in landing page top bar (AUTH-01, AUTH-03)"
  - "Google-name pseudo pre-fill + fr.auth.pseudo_prefilled_hint hint on landing"
  - "user_id in createRoom host player insert (null for anonymous, user.id when signed in)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getUser() called once at page mount via useEffect — never in render, never getSession()"
    - "authLoading guard prevents flash of incorrect auth state before getUser() resolves"
    - "googlePrefill state tracks Google-origin pre-fill separately (distinct hint: auth.pseudo_prefilled_hint)"
    - "user_id: user?.id ?? null — null for anonymous, user.id for signed-in (Pitfall 1)"

key-files:
  created: []
  modified:
    - app/page.tsx

key-decisions:
  - "googlePrefill state tracks the Google-prefilled value on the landing page; hint shown only when pseudo === googlePrefill (user hasn't edited the field)"
  - "user_id added only to the players insert (host player row) — not to the rooms insert (host_id: genId() unchanged, NOT NULL in prod)"
  - "getFirstName helper is a local function (not exported) — identical logic to join page but no shared module needed for two callsites"

patterns-established:
  - "Top bar right cluster: <div className='flex items-center gap-2'>{authSlot}<LangSwitch /></div> — established by 04-03, confirmed on landing"
  - "Auth slot: render nothing while authLoading (no flash); sign-in pill when !user; signed-in chip when user — identical to join page"

requirements-completed: [AUTH-01, AUTH-03]

# Metrics
duration: ~10min
completed: 2026-06-11
---

# Phase 04 Plan 04: Landing Page Auth — Summary

**Google OAuth pill in landing top bar, Google-name pseudo pre-fill with hint, and user_id on the createRoom host player insert — anonymous flow structurally unchanged**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-11
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

### Task 1 — Auth state hook + sign-in/sign-out pill + Google-name pre-fill

- Added `import type { User } from '@supabase/supabase-js'` and `useEffect` to React import
- `user`/`authLoading`/`googlePrefill` state + mount `useEffect` calling `getUser()` (never `getSession()`)
- `getFirstName(u)` helper: `full_name → name → email-prefix`, truncated to 11 + '…' when >12 chars
- `handleSignIn`: `signInWithOAuth({ provider: 'google' })` — browser navigates, no cleanup
- `handleSignOut`: `signOut()` → `setUser(null)` → `router.push('/')`
- Top bar: replaced bare `<LangSwitch />` with `<div className="flex items-center gap-2">{authSlot}<LangSwitch /></div>`
- Auth slot renders nothing while `authLoading` (no flash); sign-in pill when `!user`; signed-in chip when `user`
- Pre-fill `useEffect`: when `user && !pseudo`, extracts Google first name, sets `pseudo` + `googlePrefill`
- `fr.auth.pseudo_prefilled_hint` hint rendered at 12px/C.muted when `googlePrefill && pseudo === googlePrefill`
- All strings via i18n (`fr.auth.sign_in`, `fr.auth.sign_out`, `fr.auth.pseudo_prefilled_hint`) — zero hardcoded auth text

### Task 2 — user_id on createRoom host player insert

- Host player insert payload: `{ room_id: room.id, pseudo: pseudo.trim(), is_host: true, user_id: user?.id ?? null }`
- Signed-in host row carries `user.id`; anonymous host row carries `null`
- Rooms insert unchanged: `{ code, host_id: genId() }` — `user_id` NOT added to rooms table
- Collision-retry loop (5 attempts, `23505` guard) and `cleanup_dead_rooms` RPC call unchanged

## Task Commits

1. **Task 1: Auth state hook + sign-in/sign-out pill in landing top bar** — `676004a` (feat)
2. **Task 2: Add user_id to createRoom host player insert** — `24a16a0` (feat)

## Files Created/Modified

- `app/page.tsx` — auth hook, getFirstName helper, handleSignIn/handleSignOut, top-bar auth slot, googlePrefill state + hint, user_id in host player insert

## Decisions Made

- `googlePrefill` state on the landing page mirrors the same pattern as `app/join/page.tsx` — the Google-name hint (`auth.pseudo_prefilled_hint`) shows only when `pseudo === googlePrefill` (user hasn't edited the field).
- `user_id` is added only to the `players` insert (host row), not to the `rooms` insert. The `rooms` table only has `host_id` (NOT NULL in prod, vestigial but required).
- `getFirstName` is a local helper function inside `Home()` — identical logic to the join page. No shared module needed for two callsites.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified at commit time.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced beyond what the threat model already covers (T-04-10 through T-04-SC in the plan). The `signInWithOAuth` call delegates PKCE to the existing `app/auth/callback/route.ts`. The `user_id` in the host player insert is self-reported (T-04-11 accepted risk, documented in threat register).

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- AUTH-01 (sign in) and AUTH-03 (sign out) are now wired on both the landing page and the join page
- Signed-in host player rows carry `user_id`; anonymous host rows carry `null`
- Phase 4 UX plans (01-04) are all complete — Phase 5 can proceed with cross-session stats and profile
- No blockers

---
*Phase: 04-signin-ux-player-linking*
*Completed: 2026-06-11*
