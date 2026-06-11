---
phase: 04-signin-ux-player-linking
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - lib/i18n.ts
  - app/room/[code]/game/page.tsx
  - app/room/[code]/lobby/page.tsx
  - app/join/page.tsx
  - app/page.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 04 adds optional Google OAuth sign-in (via Supabase Auth) to every entry point of the app: landing page, join page, lobby, and game page. The anonymous flow is structurally intact. The auth integration is generally solid — refs-over-closures, single `getUser()` call at mount, `user_id` threaded through insert paths. However, three blocking defects were found: a race condition that causes the Google first-name pre-fill to be skipped for signed-in users arriving on join with a code in the URL, a missing OAuth redirect URL that will cause Google sign-in to silently fail in production, and a `console.log` that leaks room-lookup metadata (including the room code and RLS error details) to the browser console in production for every join attempt. Five warnings cover robustness and correctness issues in the auth/UI layer that should be addressed before this ships.

---

## Critical Issues

### CR-01: `user` state is null when the `searchParams` effect runs — Google pre-fill always skipped

**File:** `app/join/page.tsx:54-99`

**Issue:** The component has two `useEffect` hooks: one that fetches the auth user (line 25) and one that reads `searchParams` to pre-fill the pseudo (line 54). Both run after the first render. The `searchParams` effect lists `user` as a dependency (line 99), so in theory it re-runs when the user loads. However, `authLoading` starts as `true` and the code inside the effect at line 76 gates on `!remembered && user`. By the time `supabase.auth.getUser()` resolves and `user` is set (triggering the searchParams effect to re-run), the branch at line 73 exits early via `return` if `pid` is found — meaning the Google fallback at line 76–89 is **never reached on the second run** because the `pid` block (line 72–90) always short-circuits first if a stored id exists. For a freshly signed-in user arriving at `/join?code=XXXX` with no previous `localStorage` entry (first visit on this device), `!pid` is true, `!remembered` is true, and `user` is still null on the _first_ run of the effect (auth hasn't resolved yet). The second run (when `user` is set) never fires in this scenario because neither `searchParams` nor `user` changed between the first and second run in the common case where the code param doesn't change. The net result: the Google first-name pre-fill **is silently skipped** in the most common new-device scenario.

**Fix:** Restructure the effect to not short-circuit before the Google fallback, or split the DB lookup into a separate effect keyed on `[pid]` and keep the Google fallback in a third effect keyed on `[user, remembered]`:

```typescript
// Separate effect: Google pre-fill — only fires when there is no stored pseudo
// and the user is signed in. Runs after the searchParams effect has set storedPseudo.
useEffect(() => {
  if (storedPseudo) return     // stored pseudo wins
  if (pseudo && pseudo !== '') return  // user has typed something
  if (!user) return
  const raw =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email?.split('@')[0] || ''
  const firstName = raw.length > 12 ? raw.slice(0, 11) + '…' : raw
  if (firstName) {
    setPseudo(firstName)
    setGooglePrefill(firstName)
  }
}, [user, storedPseudo])
```

---

### CR-02: `console.log` leaks sensitive diagnostic data in production on every join attempt

**File:** `app/join/page.tsx:113`

```typescript
console.log('[join] lookup:', { code: normalizedCode, found: !!room, error: roomError?.message })
```

**Issue:** This `console.log` runs on every join attempt regardless of success or failure, printing the room code and any PostgREST error message to the browser's developer console. In production this exposes:
- The 6-char room code, which combined with other contextual info could help a malicious party attempt joins.
- The exact PostgREST/Supabase error string when RLS rejects the query (e.g., `"new row violates row-level security policy for table \"rooms\""`) — useful intelligence for an attacker enumerating misconfigurations.

The CLAUDE.md explicitly notes this line was added for diagnostics ("Log to help diagnose RLS / env issues"), but shipping it to production is a quality defect. The line should be replaced with a conditional `if (roomError)` branch only.

**Fix:**
```typescript
// Remove the unconditional log. Keep the error-path log below at line 116.
// For RLS diagnosis in dev, set process.env.NODE_ENV check or use a debug flag.
if (roomError) {
  console.error('[joinRoom] room lookup failed:', roomError)
  // ... existing handling
}
```

---

### CR-03: OAuth redirect URL not set — `signInWithOAuth` will fail silently in production

**File:** `app/page.tsx:85`, `app/join/page.tsx:43`

```typescript
await supabase.auth.signInWithOAuth({ provider: 'google' })
```

**Issue:** Neither call to `signInWithOAuth` specifies a `redirectTo` option. When this code runs in production (kluup.app), Supabase Auth will use whatever "Site URL" and "Redirect URLs" are configured in the Supabase dashboard. If these are not set to the correct production URL, the OAuth flow will either redirect to a wrong origin or be blocked by Supabase's redirect URL allowlist, and the user will land on an error page instead of returning to the app. The join page case is particularly broken: after the OAuth round-trip the user lands on `redirectTo` (the root `/` by default), losing the `?code=XXXX` query parameter they arrived with.

**Fix:** Always pass an explicit `redirectTo` that preserves the current URL so the user lands back where they started:

```typescript
async function handleSignIn() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
    },
  })
}
```

For the join page specifically, `window.location.href` already carries `?code=XXXX`, so the user will land back at `/join?code=XXXX` after Google sign-in — which is exactly the desired UX. Also ensure the production domain is added to Supabase's "Redirect URLs" allowlist.

---

## Warnings

### WR-01: Auth state not kept live — `onAuthStateChange` absent from all pages

**File:** `app/page.tsx:57-62`, `app/join/page.tsx:25-30`, `app/room/[code]/lobby/page.tsx:33-37`, `app/room/[code]/game/page.tsx:1553-1557`

**Issue:** All four pages call `supabase.auth.getUser()` once at mount but never subscribe to `supabase.auth.onAuthStateChange`. This means that if a user completes the Google OAuth flow and is redirected back to the page (which triggers a fresh mount), the auth state will be correct. However, if the Supabase session expires (JWT refresh) or a sign-out happens in another tab, the local `user`/`isSignedIn` state will be stale. In the game page, a stale `isSignedIn = true` causes a green dot to remain on the quit button for a signed-out user — a cosmetic but misleading indicator. On the join page, a stale signed-in state could result in the `IDEN-02` query being sent (line 135) with an expired JWT, causing a silent auth failure that surfaces as "no existing row found" and falls through to a fresh insert — potentially creating a duplicate player entry.

**Fix:**
```typescript
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user)
    setAuthLoading(false)
  })
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)
    setAuthLoading(false)
  })
  return () => subscription.unsubscribe()
}, [])
```

---

### WR-02: `getFirstName` is duplicated verbatim across two files — divergence risk

**File:** `app/page.tsx:65-72`, `app/join/page.tsx:33-40`

**Issue:** The `getFirstName(u: User)` function (including the 12-char truncation logic) is copy-pasted identically in both files. If the truncation length or the metadata key lookup order ever changes in one place, the other will silently diverge, causing different pseudo pre-fills on the landing page vs. the join page for the same user.

**Fix:** Extract to `lib/utils.ts`:
```typescript
export function getGoogleFirstName(user: User): string {
  const raw =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    '?'
  return raw.length > 12 ? raw.slice(0, 11) + '…' : raw
}
```

---

### WR-03: `handleSignOut` calls `router.push('/')` unconditionally — may disrupt in-game or lobby users

**File:** `app/join/page.tsx:47-52`, `app/page.tsx:89-94`

**Issue:** Both `handleSignOut` implementations do `setUser(null)` and then `router.push('/')`, but on the join page the user may have a partially filled-in form. More importantly, if a signed-in user triggers sign-out from the join page while already in possession of a room code (URL), they are sent back to `/` and the code is lost. The CLAUDE.md notes that `sign_out` is a session-level action — the user should remain on the current page after signing out.

**Fix:** On the join page, omit the redirect:
```typescript
async function handleSignOut() {
  await supabase.auth.signOut()
  setUser(null)
  setAuthLoading(false)
  // Don't redirect — user can continue anonymously from the current page.
}
```

---

### WR-04: Race condition between `setLastPseudo` and early return in IDEN-02 path — pseudo not persisted

**File:** `app/join/page.tsx:142-152`

```typescript
if (existingByUid) {
  setPlayerId(normalizedCode, existingByUid.id)
  setLastPseudo(normalizedCode, pseudo.trim())
  router.push(...)
  setLoading(false)
  return  // skip insert — reconnected silently (D-12)
}
```

**Issue:** In the IDEN-02 reconnect path (signed-in user, new device, existing `user_id` row found), `setLastPseudo` is called with `pseudo.trim()` — which at this point is the value the user typed into the form, or the Google pre-fill if they didn't modify it. If the Google pre-fill logic in CR-01 is broken (pre-fill was skipped), `pseudo` will be whatever the user typed, which could be empty if they cleared the field. The guard at line 102 (`if (!code.trim() || !pseudo.trim()) return`) prevents an empty pseudo from proceeding, but it means the join button is disabled and the IDEN-02 path is unreachable when `pseudo` is empty — so the user can never silently reconnect with a blank pseudo. However, if the user typed a pseudo and then the reconnect path stores it, but the DB row still has the old pseudo (the update path at line 164 is only reached in the stored-pid reconnect block, not in the IDEN-02 block), the displayed pseudo in-game will differ from what the user typed on the join form.

**Fix:** In the IDEN-02 block, also update the player row pseudo to match the form input if it differs:
```typescript
if (existingByUid) {
  setPlayerId(normalizedCode, existingByUid.id)
  // Fetch the current pseudo and update if changed.
  const { data: existingPlayer } = await supabase
    .from('players').select('pseudo').eq('id', existingByUid.id).maybeSingle()
  if (existingPlayer && existingPlayer.pseudo !== pseudo.trim()) {
    await supabase.from('players').update({ pseudo: pseudo.trim() }).eq('id', existingByUid.id)
  }
  setLastPseudo(normalizedCode, pseudo.trim())
  router.push(...)
  setLoading(false)
  return
}
```

---

### WR-05: `isSignedIn` dot on lobby quit button is read from a fire-and-forget `getUser()` — can flash incorrectly during cold start

**File:** `app/room/[code]/lobby/page.tsx:31-37`, line 227

**Issue:** The green "signed-in" dot on the quit button is controlled by `isSignedIn`, which is set from a single `supabase.auth.getUser()` call at mount. During the cold-start window before that promise resolves, `isSignedIn` is `false` (its initial state), so the dot is absent. This is fine. However, the lobby page does not expose `authLoading` to suppress a potential flash if the Supabase client returns synchronously (from cache). The more serious problem: unlike the landing and join pages, the lobby page does NOT show a sign-in/sign-out button at all — `isSignedIn` is fetched but only used to conditionally render the green dot. This means a signed-in user who arrives in the lobby has no way to sign out without leaving the lobby, even though the presence indicator implies a signed-in state. This is a UX inconsistency that could confuse users.

**Fix:** Either add a sign-out affordance to the lobby (consistent with landing/join), or remove the green dot from the lobby quit button (simpler, avoids the sign-out dead-end). If keeping the dot, at minimum the lobby should also handle auth state changes via `onAuthStateChange` for consistency with WR-01.

---

## Info

### IN-01: `badge_nosignup` landing badge is inconsistent with optional sign-in being offered on the same page

**File:** `app/page.tsx:240`

**Issue:** The landing page hero prominently displays `fr.landing.badge_nosignup` ("Sans inscription" / "No sign-up") as a trust badge, while the top-right corner of the same screen shows a "Se connecter" button. For anonymous users this is literally false — they cannot "sign in" while also being told "no sign-up required." The badge is not technically wrong (sign-up is optional), but the juxtaposition creates cognitive dissonance that may erode trust.

**Fix:** Consider rewording the badge to "Sans inscription obligatoire" / "No account required" or hiding the sign-in button until the user scrolls past the hero section. No code change is strictly required — this is a copy/UX note for the product team.

---

### IN-02: Logo color inconsistency between top bar and footer on the landing page

**File:** `app/page.tsx:156-157` (top bar) vs `app/page.tsx:344-347` (footer)

**Issue:** The top-bar logo uses `#39FF14` (lime green) for the "up" suffix, while the footer uses `#FF6B35` (orange). The CLAUDE.md entry for the most recent commit ("brand: theme-reactive logo — orange identity on landing, lobby/share card") suggests the orange footer may be intentional, but the lime-green top-bar is then inconsistent with the stated brand identity.

**Fix:** Align the top-bar logo color with the intended brand color (`#FF6B35` orange) if that is the canonical identity, or document the intentional contrast explicitly.

---

### IN-03: `setAuthLoading(false)` called redundantly in `handleSignOut` on both pages

**File:** `app/page.tsx:93`, `app/join/page.tsx:50`

**Issue:** After `supabase.auth.signOut()`, `setAuthLoading(false)` is called. But `authLoading` was already set to `false` during the `getUser()` call at mount — it is never set back to `true` at any point. So this call is always a no-op (authLoading is already false) and is dead code. If `onAuthStateChange` is added per WR-01, the subscription callback handles setting `authLoading` correctly without this manual call.

**Fix:** Remove the `setAuthLoading(false)` lines from both `handleSignOut` implementations.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
