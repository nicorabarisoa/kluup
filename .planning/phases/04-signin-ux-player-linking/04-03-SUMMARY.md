---
phase: 04-signin-ux-player-linking
plan: "03"
subsystem: ui
tags: [auth, oauth, google, join, iden-02, reconnect, user_id, i18n, typescript]

# Dependency graph
requires:
  - "04-01 (auth i18n namespace — sign_in, sign_out, pseudo_prefilled_hint keys)"
provides:
  - "auth state hook + sign-in/sign-out pill in join page top bar (AUTH-01, AUTH-03)"
  - "IDEN-02: signed-in cross-device reconnect via user_id lookup without duplicate row"
  - "user_id in player insert payload (null for anonymous, user.id when signed in)"
  - "Google-name pseudo pre-fill + fr.auth.pseudo_prefilled_hint hint"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getUser() called once at page mount via useEffect — never in render, never getSession()"
    - "authLoading guard prevents flash of incorrect auth state before getUser() resolves"
    - "IDEN-02: .eq('room_id').eq('user_id').maybeSingle() — both filters required (Pitfall 5 scope safety)"
    - "IDEN-02 gated by user && !stored — localStorage path takes precedence (Pitfall 6)"
    - "googlePrefill state tracks Google-origin pre-fill separately from storedPseudo (different hints)"
    - "user_id: user?.id ?? null — null for anonymous, user.id for signed-in (Pitfall 1)"

key-files:
  created: []
  modified:
    - app/join/page.tsx

key-decisions:
  - "googlePrefill state tracks the Google-prefilled value independently of storedPseudo so each hint (join.pseudo_prefilled_hint vs auth.pseudo_prefilled_hint) fires correctly without cross-contamination"
  - "IDEN-02 block positioned after room lookup success and before localStorage reconnect block — consistent with 04-PATTERNS.md placement spec"
  - "const stored = getPlayerId() hoisted before IDEN-02 block so both the IDEN-02 guard and the localStorage reconnect share one declaration (removes duplicate)"
  - "On IDEN-02 DB error data is undefined — falls through silently to normal insert (safe degradation, no user-visible error)"
  - "Pre-fill useEffect deps include user — effect re-runs after auth resolves so Google name is applied when user becomes non-null"

patterns-established:
  - "Top bar right cluster: <div className='flex items-center gap-2'>{authSlot}<LangSwitch /></div>"
  - "Auth slot: render nothing while authLoading (no flash); sign-in pill when !user; signed-in chip when user"
  - "Signed-in chip: single <button> with three <span> children (name/separator/sign-out label)"

requirements-completed: [AUTH-01, AUTH-03, IDEN-02]

# Metrics
duration: ~10min
completed: 2026-06-11
---

# Phase 04 Plan 03: Join Page Auth — Summary

**Google OAuth pill in join top bar, IDEN-02 cross-device reconnect via user_id, user_id on insert, Google-name pseudo pre-fill — anonymous flow structurally unchanged**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-11
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

### Task 1 — Auth state hook + sign-in/sign-out pill

- Added `import type { User } from '@supabase/supabase-js'`
- `user`/`authLoading` state + mount `useEffect` calling `getUser()` (never `getSession()`)
- `getFirstName(u)` helper: `full_name → name → email-prefix`, truncated to 11 + '…' when >12 chars
- `handleSignIn`: `signInWithOAuth({ provider: 'google' })` — browser navigates, no cleanup
- `handleSignOut`: `signOut()` → `setUser(null)` → `router.push('/')`
- Top bar: replaced bare `<LangSwitch />` with `<div className="flex items-center gap-2">{authSlot}<LangSwitch /></div>`
- Auth slot renders nothing while `authLoading` (no flash); sign-in pill when `!user`; signed-in chip when `user`
- All strings via i18n (`fr.auth.sign_in`, `fr.auth.sign_out`) — zero hardcoded auth text

### Task 2 — IDEN-02 + user_id on insert + Google-name pre-fill

- Added `googlePrefill` state to track the Google-prefilled pseudo value (distinct from `storedPseudo`)
- Pre-fill `useEffect` extended: after `remembered` check, when `!remembered && user`, extracts Google first name and calls `setPseudo(firstName)` + `setGooglePrefill(firstName)` — does NOT set `storedPseudo`
- `auth.pseudo_prefilled_hint` rendered when `!storedPseudo && googlePrefill && pseudo === googlePrefill`
- `const stored = getPlayerId(normalizedCode)` hoisted before IDEN-02 block (removes duplicate declaration that was at original line 80)
- IDEN-02 block: `if (user && !stored)` → `.from('players').select('id').eq('room_id', room.id).eq('user_id', user.id).maybeSingle()` → if found: `setPlayerId` + `setLastPseudo` + `router.push(dest)` + `return`
- DB error on IDEN-02 lookup: `data` is undefined → falls through silently to normal insert
- Player insert payload: `user_id: user?.id ?? null` added
- Existing 23505 `pseudo_taken` branch and localStorage reconnect block are unchanged

## Task Commits

1. **Task 1: Auth state hook + sign-in/sign-out pill** — `1b67e30` (feat)
2. **Task 2: IDEN-02 reconnect + user_id on insert + Google-name pre-fill** — `2019946` (feat)

## Files Created/Modified

- `app/join/page.tsx` — auth hook, getFirstName helper, handleSignIn/handleSignOut, top-bar auth slot, IDEN-02 block, user_id in insert, googlePrefill state + hint

## Decisions Made

- `googlePrefill` state is a distinct variable from `storedPseudo` — the former covers Google OAuth pre-fill (renders `auth.pseudo_prefilled_hint`), the latter covers returning-player pid pre-fill (renders `join.pseudo_prefilled_hint`). Both hints can coexist without collision because they live in separate namespaces and separate state.
- IDEN-02 guard is `user && !stored` (not just `user`) — when a localStorage entry exists, the existing reconnect path handles it correctly and IDEN-02 would be redundant and wasteful.
- Pre-fill `useEffect` dependency array includes `user` so the Google-name fallback runs after the auth `getUser()` resolves on mount.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified at commit time.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced beyond what the threat model already covers (T-04-05 through T-04-09 in the plan). The IDEN-02 lookup is scoped with both `.eq('room_id')` and `.eq('user_id')` as required by T-04-07 mitigation.

## Known Stubs

None.

## Self-Check: PASSED

- `app/join/page.tsx` contains `import type { User } from '@supabase/supabase-js'`: FOUND
- `app/join/page.tsx` contains `const [user, setUser] = useState<User | null>(null)`: FOUND
- `app/join/page.tsx` contains `supabase.auth.signInWithOAuth({ provider: 'google' })`: FOUND
- `app/join/page.tsx` contains `supabase.auth.signOut()`: FOUND
- `app/join/page.tsx` contains `.eq('room_id', room.id).eq('user_id', user.id).maybeSingle()`: FOUND
- `app/join/page.tsx` contains `user_id: user?.id ?? null`: FOUND
- `app/join/page.tsx` contains `fr.auth.sign_in` and `fr.auth.sign_out`: FOUND
- `app/join/page.tsx` contains `fr.auth.pseudo_prefilled_hint`: FOUND
- Commit `1b67e30`: FOUND
- Commit `2019946`: FOUND
- `npm run build` exits 0: VERIFIED

---
*Phase: 04-signin-ux-player-linking*
*Completed: 2026-06-11*
