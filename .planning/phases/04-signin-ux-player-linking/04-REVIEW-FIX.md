---
phase: 04-signin-ux-player-linking
fixed_at: 2026-06-11T16:15:00Z
review_path: .planning/phases/04-signin-ux-player-linking/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-06-11T16:15:00Z
**Source review:** .planning/phases/04-signin-ux-player-linking/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning; Info findings excluded per fix_scope)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### WR-02: `getFirstName` duplicated verbatim across two files

**Files modified:** `lib/utils.ts`
**Commit:** e3927c1
**Applied fix:** Added `getGoogleFirstName(user)` to `lib/utils.ts` as the single
source of truth for the 12-char truncation logic and metadata key lookup order.
Returns an empty string (not `'?'`) when no name is determinable, so callers can
skip the pre-fill. Both `app/page.tsx` and `app/join/page.tsx` now import and use
this shared helper.

---

### CR-01: Google pre-fill always skipped for signed-in users arriving with `?code=` URL

**Files modified:** `app/join/page.tsx`
**Commit:** 106a9bf
**Applied fix:** Separated the Google pre-fill into its own `useEffect` keyed on
`[user, storedPseudo]`. The `searchParams` effect no longer contains any auth
logic — it only sets the code field and stored-pseudo from localStorage. The new
dedicated effect fires correctly when auth resolves after the first render (the
common new-device scenario), and when `storedPseudo` changes. The early-return
short-circuit that was blocking the Google fallback is gone.

### CR-02: `console.log` leaks room code and RLS error in production

**Files modified:** `app/join/page.tsx`
**Commit:** 106a9bf
**Applied fix:** Removed the unconditional `console.log('[join] lookup:', {...})`
that printed the room code and PostgREST error string on every join attempt. The
error-path `console.error` below it is preserved for legitimate error diagnosis.

### CR-03: `signInWithOAuth` has no `redirectTo` — will fail silently in production

**Files modified:** `app/join/page.tsx`, `app/page.tsx`
**Commit:** 106a9bf (join), 9b412da (landing)
**Applied fix:** Both `handleSignIn` functions now pass
`options: { redirectTo: typeof window !== 'undefined' ? window.location.href : undefined }`.
On the join page this preserves `?code=XXXX` across the OAuth round-trip so the
user lands back at `/join?code=XXXX`. On the landing page it returns the user to
the hero. Note: the production domain must also be added to Supabase's
"Redirect URLs" allowlist in the Supabase dashboard.

### WR-01: `onAuthStateChange` absent from all pages — auth state can go stale

**Files modified:** `app/join/page.tsx`, `app/page.tsx`
**Commit:** 106a9bf (join), 9b412da (landing)
**Applied fix:** Both pages now subscribe to `supabase.auth.onAuthStateChange` in
the same `useEffect` as `getUser()`, with a cleanup that calls
`subscription.unsubscribe()`. The handler sets `user`/`isSignedIn` from the live
session, so JWT refreshes and cross-tab sign-outs are reflected immediately.
For the lobby and game pages, the `isSignedIn` state was removed entirely
(see WR-05) so no subscription is needed there.

### WR-03: `handleSignOut` redirects to `/` — disrupts join page users

**Files modified:** `app/join/page.tsx`, `app/page.tsx`
**Commit:** 106a9bf (join), 9b412da (landing)
**Applied fix:** Removed `router.push('/')` from `handleSignOut` on the join page.
Users can continue anonymously from wherever they are after signing out. On the
landing page `router.push('/')` was already a no-op (already at `/`), so the
removal there is a cleanup only.

### WR-04: IDEN-02 path does not update DB pseudo when user types a different name

**Files modified:** `app/join/page.tsx`
**Commit:** 106a9bf
**Applied fix:** The IDEN-02 query now selects `id, pseudo` (previously `id` only).
After finding the existing row, if the stored pseudo differs from the form input,
an `UPDATE` is issued before the redirect. This ensures the player appears with
the name they typed on this device, not the name from their previous device.

### WR-05: Stale `isSignedIn` dot on quit button has no sign-out affordance in lobby/game

**Files modified:** `app/room/[code]/lobby/page.tsx`, `app/room/[code]/game/page.tsx`
**Commit:** c28755a (lobby), 9c308c6 (game)
**Applied fix:** Removed the `isSignedIn` state, the `getUser()` auth effect, and
the green dot indicator from both pages. The dot was fed by a potentially-stale
fire-and-forget call and led to a UX dead-end (signed-in indicator with no
sign-out affordance). In the game page, `isSignedIn` was an optional prop threaded
through all screen components and `RoundHeader` — all occurrences removed cleanly.
The quit button renders without the green dot wrapper `<div>` on both pages.

## Skipped Issues

None — all 8 in-scope findings were fixed.

---

_Fixed: 2026-06-11T16:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
