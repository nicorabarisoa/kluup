# Phase 4: Sign-in UX + Player Linking — Research

**Researched:** 2026-06-11
**Domain:** Supabase Auth client-side UI integration, optional Google OAuth surface, player identity linking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Sign-in button appears on **landing page** and **join page** only. No sign-in button on lobby, game, or end screen.
- **D-02:** On the landing page, the sign-in button lives in the **top bar, alongside the LangSwitch** — same row as the logo. When signed out: `"Se connecter"` button. When signed in: `"[Prénom] · Se déconnecter"`.
- **D-03:** On the join page, the sign-in option appears in the same top-bar zone (above the form).
- **D-04:** After OAuth completes (`/auth/callback`), always redirect to `/` (landing). The existing `app/auth/callback/route.ts` already implements this — no change needed.
- **D-05:** When signed in, top bar shows: `[Prénom Google] · [Se déconnecter]` — prénom only (not full name, not avatar). This replaces the sign-in button.
- **D-06:** In the game header (`RoundHeader`), signed-in state is indicated by a **small green dot on the Quit button** only — no text, no name. Ultra-minimal. The lobby Quit button follows the same pattern.
- **D-07:** Sign-out triggers `supabase.auth.signOut()` and `router.push('/')`.
- **D-08:** Pseudo input pre-filled with Google first name (`user.user_metadata.full_name?.split(' ')[0]`). Fallback: `user.user_metadata.name?.split(' ')[0]`, then `user.email?.split('@')[0]`. Field remains editable.
- **D-09:** Pseudo used in game = whatever user typed. Pseudo = game identity; account = stats identity. Independent.
- **D-10:** Player insert includes `user_id: session?.user?.id ?? null`. Anonymous → null. Signed in → user.id.
- **D-11:** Auth state read via `supabase.auth.getUser()` immediately before player insert (single async call).
- **D-12:** IDEN-02 — on join page, signed-in user: check `SELECT * FROM players WHERE room_id = $id AND user_id = $uid LIMIT 1`. If found: `setPlayerId(code, row.id)`, skip insert, navigate directly. Silently.
- **D-13:** If no existing row found for `user_id` in room, fall through to normal insert with `user_id` set.
- **D-14:** IDEN-02 check only when signed in. Anonymous users follow unchanged localStorage path.

### Claude's Discretion

- Auth state: `supabase.auth.getUser()` in `useEffect` on landing and join pages, result stored in component state. No global auth context needed for Phase 4.
- Sign-out: `supabase.auth.signOut()` then `router.refresh()` (or `router.push('/')`) to clear UI state.
- Green dot on Quit button: small CSS `<span>` (6px, `#22c55e`, `position:absolute`, offset top/right, `border-radius:50%`). Button wrapper gains `position:relative` only when dot is rendered.
- Pseudo pre-fill: `user.user_metadata.full_name?.split(' ')[0]`. Fallback to email prefix.
- RLS stays fully open — `user_id` is self-reported by the client in Phase 4. Tightening RLS is Phase 5+ concern.

### Deferred Ideas (OUT OF SCOPE)

- Avatar/photo de profil Google sur le `/profile` — Phase 5
- `redirect_to` post-auth pour retourner sur la page précédente — hors scope (toujours `/`)
- RLS strict sur `players.user_id` — Phase 5+

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign in with Google via OAuth (optional — game is fully playable without an account) | `supabase.auth.signInWithOAuth({ provider: 'google' })` confirmed available in installed version 2.108.1 [VERIFIED: installed node_modules]. Sign-in button on landing and join pages only. |
| AUTH-03 | Signed-in user can sign out from any page | `supabase.auth.signOut()` available and confirmed. Placement: landing page + join page top bar. In-game: implicit (no sign-out button in game, green dot indicator only). Scope: D-01 limits sign-out UI to landing and join pages. |
| IDEN-02 | Signed-in user joining on a new device recognized via `user_id` lookup — no duplicate row | Lookup pattern: `supabase.from('players').select().eq('room_id', room.id).eq('user_id', uid).maybeSingle()`. Mirrors existing localStorage reconnect pattern in join page (same shape, different key). `players.user_id` nullable FK already added in Phase 2. |

</phase_requirements>

---

## Summary

Phase 4 is a pure UI wiring phase. All the infrastructure was installed in Phase 2: middleware.ts refreshes JWT on every request, `app/auth/callback/route.ts` handles the PKCE code exchange, `players.user_id` nullable FK exists in the DB, and Google OAuth was configured in the Supabase Dashboard. Phase 4 surfaces the auth state in the UI and wires `user_id` into the two player-insert paths.

The implementation is four files, all modifications to existing components:
1. `app/page.tsx` — add auth state hook, sign-in/sign-out chip in top bar, `user_id` in player insert, Google name pre-fill
2. `app/join/page.tsx` — add auth state hook, sign-in/sign-out chip in top bar, IDEN-02 user_id lookup before insert, `user_id` in insert, Google name pre-fill
3. `app/room/[code]/game/page.tsx` — add `isSignedIn` state, pass to `RoundHeader` as prop, render green dot on Quit button
4. `app/room/[code]/lobby/page.tsx` — add `isSignedIn` state, render green dot on lobby Quit button

No new library installs. No schema changes. No new component files. No middleware changes. The anonymous game flow is structurally identical — every new code path is guarded by `if (user)` or `user?.id ?? null`.

**Primary recommendation:** Implement in the order: join page (most logic) → landing page (simpler insert) → game/lobby headers (green dot only). Each file is an independent diff with no shared state between them.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Google OAuth initiation | Browser / Client | — | `signInWithOAuth` called from `'use client'` onClick; SDK handles redirect |
| PKCE code exchange + session cookie | Frontend Server (Route Handler) | — | Already implemented in `app/auth/callback/route.ts`; no change |
| JWT refresh on navigation | Frontend Server (middleware) | — | Already implemented in `middleware.ts`; no change |
| Auth state display in top bar | Browser / Client | — | `getUser()` in useEffect, stored in component state |
| Green dot indicator in game/lobby | Browser / Client | — | `getUser()` called once in page root, passed as `isSignedIn` prop to `RoundHeader` |
| `user_id` injection into player insert | Browser / Client | — | `getUser()` result available at insert time; self-reported value, RLS open |
| IDEN-02 multi-device reconnect | Browser / Client | Database / Storage | Client queries `players WHERE user_id = uid`; DB resolves existing row |
| Google name pre-fill | Browser / Client | — | `user.user_metadata.full_name` read from getUser() result |
| i18n for auth strings | Browser / Client | — | New keys added to `lib/i18n.ts` dictionaries (4 locales), used via `useT()` |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@supabase/supabase-js` | 2.108.1 | `supabase.auth.signInWithOAuth`, `signOut`, `getUser` | Already in `lib/supabase.ts` [VERIFIED: node_modules] |
| `@supabase/ssr` | 0.12.0 | Middleware session refresh (Phase 2, no change) | Already installed [VERIFIED: node_modules] |
| `next` | 16.2.7 | `useRouter`, `router.push` for post-sign-out redirect | Already installed [VERIFIED: package.json] |

### No New Packages

This phase installs nothing. All required auth methods are on the existing `supabase` browser client (`lib/supabase.ts`). No new component libraries, no new type packages.

---

## Package Legitimacy Audit

No new packages are installed in Phase 4. This section is not applicable.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@supabase/supabase-js` | npm | ~5 yrs | ~19.6M/wk | github.com/supabase/supabase-js | Already installed, confirmed legitimate | No action |
| `@supabase/ssr` | npm | ~2.7 yrs | ~4.6M/wk | github.com/supabase/ssr | Already installed, confirmed legitimate | No action |

Note: both packages are flagged `SUS` (too-new) by the legitimacy seam because a minor version was published June 9 2026. With ~20M and ~4.6M weekly downloads respectively and official Supabase org GitHub repos, these are categorically legitimate official packages already in use in the project. The `too-new` signal refers to the latest published version, not the package itself.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser — landing page (app/page.tsx)
  │
  │  mount: useEffect → supabase.auth.getUser() [one network call]
  │  → setUser(data.user) → top bar renders auth chip or sign-in button
  │
  ├─ signed out: render "Se connecter" pill
  │    onClick → supabase.auth.signInWithOAuth({ provider: 'google' })
  │              ↓ browser navigates to Google
  │              ↓ Google → /auth/callback?code=...
  │              ↓ Route Handler exchanges code, sets cookie
  │              ↓ redirect → /  (D-04, already implemented)
  │              ↓ landing mounts again, getUser() returns user
  │
  ├─ signed in: render "[Prénom] · Se déconnecter" chip
  │    onClick → supabase.auth.signOut() + router.push('/')
  │    pseudo input pre-filled: user_metadata.full_name.split(' ')[0]
  │    player insert includes: user_id: user.id
  │
  └─ anonymous: render nothing in auth slot until getUser() resolves
                (prevents flash of signed-in/signed-out state)

Browser — join page (app/join/page.tsx)
  │
  │  Same auth state pattern as landing
  │
  ├─ IDEN-02 path (signed in, arrives at join page):
  │    After room lookup:
  │    check players WHERE room_id = room.id AND user_id = user.id
  │    if row found → setPlayerId(code, row.id) → navigate to game/lobby
  │    if not found → fall through to insert with user_id = user.id
  │
  └─ anonymous path: unchanged (localStorage only)

Browser — game/lobby (RoundHeader component)
  │
  │  Game page root: useEffect → getUser() → setIsSignedIn(!!data.user)
  │  RoundHeader receives isSignedIn: boolean prop
  │  Quit button: position:relative wrapper + conditional green dot span
  │
  └─ anonymous: no dot rendered; layout unchanged
```

### Recommended File Changes (no new files)

```
app/
├── page.tsx                          # MODIFY: auth hook + top bar chip + user_id in insert + pre-fill
├── join/
│   └── page.tsx                      # MODIFY: auth hook + top bar chip + IDEN-02 + user_id in insert + pre-fill
└── room/[code]/
    ├── game/
    │   └── page.tsx                  # MODIFY: isSignedIn state + prop to RoundHeader + green dot
    └── lobby/
        └── page.tsx                  # MODIFY: isSignedIn state + green dot on Quit button
lib/
└── i18n.ts                           # MODIFY: add auth.* keys in fr/en/es/de dictionaries
```

### Pattern 1: Auth State Hook (landing and join pages)

**What:** Single `useEffect` call per page to read auth state after mount. Result stored in component state.
**When to use:** Any `'use client'` component that needs to know the current user.

```typescript
// Source: @supabase/auth-js installed types (GoTrueClient.d.ts) + Phase 2 research
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const [user, setUser] = useState<User | null>(null)
const [authLoading, setAuthLoading] = useState(true)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user)
    setAuthLoading(false)
  })
}, [])
```

`authLoading` prevents rendering the auth slot before `getUser()` resolves — avoids flash of sign-in button to a signed-in user. [ASSUMED: the `authLoading` intermediate state pattern; the getUser() call shape is VERIFIED from installed types]

### Pattern 2: Sign-in Button

**What:** Initiates Google OAuth flow.
**When to use:** Rendered when `user === null && !authLoading`.

```typescript
// Source: @supabase/auth-js GoTrueClient.d.ts — signInWithOAuth signature confirmed
async function handleSignIn() {
  await supabase.auth.signInWithOAuth({ provider: 'google' })
  // browser navigates away — no cleanup needed
}
```

Provider `'google'` is a confirmed valid value of the `Provider` type in the installed `@supabase/auth-js`. [VERIFIED: node_modules/@supabase/auth-js/dist/main/lib/types.d.ts]

### Pattern 3: Sign-out

**What:** Clears session, navigates to home.
**When to use:** Rendered on the signed-in chip click.

```typescript
// Source: @supabase/auth-js GoTrueClient.d.ts
async function handleSignOut() {
  await supabase.auth.signOut()
  router.push('/')
  // setUser(null) is redundant — the page remounts after push
}
```

After `router.push('/')` the landing page remounts and `getUser()` returns `{ user: null }`. No manual `setUser(null)` needed because the component re-runs the `useEffect`. [ASSUMED: relies on router.push triggering remount, which is standard Next.js App Router behaviour]

### Pattern 4: IDEN-02 Multi-device Reconnect

**What:** Signed-in user on a new device (no localStorage entry) is matched to their existing player row by `user_id`.
**When to use:** In `joinRoom()`, after room lookup succeeds, when `user !== null` and `getPlayerId(normalizedCode)` is null.

```typescript
// Source: Mirrors existing join page reconnect pattern (same maybeSingle shape, different WHERE clause)
// CONTEXT.md D-12, D-13, D-14 — locks the behaviour

// Only attempt IDEN-02 when signed in
if (user && !stored) {
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    setPlayerId(normalizedCode, existing.id)
    setLastPseudo(normalizedCode, pseudo.trim())
    const dest = room.status === 'playing'
      ? `/room/${room.code}/game`
      : `/room/${room.code}/lobby`
    router.push(dest)
    return  // skip insert
  }
}
```

Note: `stored` is the result of `getPlayerId(normalizedCode)`. IDEN-02 check is only needed when `!stored` (new device). [CITED: CONTEXT.md D-12 through D-14]

### Pattern 5: user_id in Player Insert

**What:** Add `user_id` to existing player insert payload. Self-reported by the client.
**When to use:** All player insert calls (landing page `createRoom` + join page `joinRoom`).

```typescript
// landing page createRoom — existing insert:
.insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true })
// Phase 4 change:
.insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true, user_id: user?.id ?? null })

// join page joinRoom — existing insert:
.insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false })
// Phase 4 change:
.insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false, user_id: user?.id ?? null })
```

The `players.user_id` column is nullable — `null` for anonymous, `user.id` for signed-in. RLS is open (anon policies on `players` unchanged). [CITED: CONTEXT.md D-10, D-11; supabase/migrations/002-auth.sql]

### Pattern 6: Green Dot on Quit Button

**What:** Conditional green dot indicator showing signed-in status in game/lobby headers.
**When to use:** `RoundHeader` when `isSignedIn === true`.

```typescript
// In game page root:
const [isSignedIn, setIsSignedIn] = useState(false)
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user))
}, [])

// RoundHeader receives isSignedIn as prop:
function RoundHeader({ round, label, accent, isSignedIn }: {
  round: number; label: string; accent: string; isSignedIn?: boolean
}) {
  // Quit button:
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <button onClick={controls.onQuit} className="px-3 h-8 rounded-xl text-xs font-medium"
      style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
      {fr.game.quit}
    </button>
    {isSignedIn && (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: -2, right: -2,
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e',
        }}
      />
    )}
  </div>
```

[CITED: CONTEXT.md Claude's Discretion; 04-UI-SPEC.md Component Spec 3]

### Pattern 7: Pseudo Pre-fill Priority

**What:** Pre-fill pseudo input using stored pseudo (returning player) or Google name (signed in).
**When to use:** Both landing page and join page pseudo inputs.

Priority order (from CONTEXT.md D-08 and UI-SPEC.md):
1. `getLastPseudo(code)` — stored pseudo from previous session (highest priority, SC-4 preserves this after quit)
2. `user.user_metadata.full_name?.split(' ')[0]` — Google first name if signed in and no stored pseudo
3. `user.user_metadata.name?.split(' ')[0]` — fallback if `full_name` absent
4. `user.email?.split('@')[0]` — last resort if no display name
5. Empty — anonymous users

The hint text (`auth.pseudo_prefilled_hint`) only shows when the field value came from Google name (not from stored pseudo, which uses the existing `fr.join.pseudo_prefilled_hint`).

### Pattern 8: Top Bar Auth Slot

**What:** Replace bare `<LangSwitch />` on the right side of the top bar with a flex cluster containing the auth slot and LangSwitch.
**When to use:** Both landing and join pages.

```typescript
// Before (both pages):
<LangSwitch />

// After (Phase 4):
<div className="flex items-center gap-2">
  {/* Auth slot — renders nothing during loading, sign-in button or signed-in chip after */}
  {!authLoading && !user && (
    <button onClick={handleSignIn} className="flex items-center text-xs font-extrabold px-2.5 py-1.5 rounded-xl"
      style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#fff', fontFamily: 'var(--font-body)' }}>
      {fr.auth.sign_in}
    </button>
  )}
  {!authLoading && user && (
    <button onClick={handleSignOut} className="flex items-center text-xs px-2.5 py-1.5 rounded-xl max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap"
      style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}>
      <span style={{ color: '#fff', fontWeight: 800 }}>{truncatedFirstName}</span>
      <span style={{ color: '#555555' }}> · </span>
      <span style={{ color: '#888888' }}>{fr.auth.sign_out}</span>
    </button>
  )}
  <LangSwitch />
</div>
```

[CITED: CONTEXT.md D-02, D-03, D-05; 04-UI-SPEC.md Component Specs 1, 2, 5, 6]

### Anti-Patterns to Avoid

- **Calling `getUser()` in render:** Makes a network call on every render, causes infinite loops. Only call in `useEffect` with an empty dependency array.
- **Using `getSession()` instead of `getUser()`:** `getSession()` reads from storage and can return stale/unvalidated session data. `getUser()` validates against the Auth server. The existing middleware already uses `getUser()` correctly — maintain this pattern on the client.
- **Global auth context for Phase 4:** Only two pages need auth state (`app/page.tsx` and `app/join/page.tsx`). The game page only needs `isSignedIn: boolean`. A global context would add complexity with no benefit at this scope.
- **Awaiting `signInWithOAuth` before redirecting:** The SDK initiates the OAuth redirect automatically. There is no meaningful `await` result to act on — the browser navigates away as part of the call.
- **Flash of signed-out state on page load:** Render the auth slot as null until `authLoading = false`, then render the appropriate state. This prevents a brief flash of "Se connecter" to a signed-in user.
- **Missing `user_id` in the create-room player insert:** The landing page `createRoom` function inserts the player immediately after the room — this insert also needs `user_id: user?.id ?? null`. Do not only patch the join page.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth flow | Custom OAuth redirect + callback handler | `supabase.auth.signInWithOAuth({ provider: 'google' })` | PKCE flow already implemented; callback route already handles code exchange |
| Session persistence across refresh | Custom cookie management | `@supabase/ssr` middleware (already active) | Middleware.ts already handles JWT refresh on every request |
| Auth state validation | Parse JWT locally | `supabase.auth.getUser()` | Network call validates against Auth server, prevents stale state |
| Duplicate player prevention | Custom deduplication logic | `getPlayerId` localStorage + IDEN-02 `user_id` lookup | Both mechanisms already in place |

---

## Common Pitfalls

### Pitfall 1: `user_id` null in Signed-in Player Insert

**What goes wrong:** Player is signed in but their `players` row has `user_id = null`, breaking IDEN-02 on subsequent devices.
**Why it happens:** `getUser()` is async. If the player insert fires before `getUser()` resolves (race condition or calling it after the insert), `user` is still `null`.
**How to avoid:** The CONTEXT.md D-11 decision locks this: call `getUser()` once per page mount (via `useEffect`), store in state. The insert function reads from state, which is set before the user can click the CTA (there is no way to click "Créer" or "Rejoindre" before the page has mounted and the `useEffect` has fired). The auth loading state (`authLoading`) prevents any user action before `getUser()` resolves — or at minimum, the user is still null at that point, which safely falls through to `user_id: null`.
**Warning signs:** Player rows in DB with `user_id = null` for users who were signed in during join.

### Pitfall 2: Auth State Flash

**What goes wrong:** User is signed in but briefly sees the "Se connecter" button before `getUser()` resolves.
**Why it happens:** Component renders with `user = null` (initial state) before the `useEffect` runs.
**How to avoid:** Track `authLoading: true` initially. Render the auth slot as `null` (no element) while loading, then render the appropriate state after. The UI-SPEC.md States table confirms: loading state → nothing rendered. [CITED: 04-UI-SPEC.md States & Transitions]
**Warning signs:** Visible flash of "Se connecter" button on page load for signed-in users.

### Pitfall 3: `getUser()` Called in Game/Lobby on Every Render

**What goes wrong:** Excessive network calls to Supabase Auth server (one per render).
**Why it happens:** Calling `supabase.auth.getUser()` outside a `useEffect`, or inside a `useEffect` with a dependency that changes.
**How to avoid:** In game/lobby pages, `getUser()` is called once on mount with `useEffect(() => { ... }, [])`. Only `isSignedIn: boolean` is derived — the full `User` object is not needed. The game page is long-lived (mounted for the entire session), so one call is sufficient.
**Warning signs:** Supabase Auth API rate limit warnings, noticeable latency in game screens.

### Pitfall 4: Forgetting `user_id` in the `createRoom` player insert (landing page)

**What goes wrong:** Signed-in users who create rooms have `user_id = null` in their player row.
**Why it happens:** Only patching the join page insert and forgetting `app/page.tsx`'s `createRoom` function, which also inserts a player row.
**How to avoid:** The landing page `createRoom()` (line ~83 in current `app/page.tsx`) inserts the room creator as a player with `is_host: true`. This insert also needs `user_id: user?.id ?? null`.
**Warning signs:** Host's player row has `user_id = null` despite being signed in.

### Pitfall 5: IDEN-02 Lookup Before Room Fetch

**What goes wrong:** Querying `players WHERE user_id = uid` without `room_id` scope returns rows from other rooms.
**Why it happens:** Missing `eq('room_id', room.id)` in the lookup query.
**How to avoid:** The lookup always includes both `room_id` and `user_id` in the WHERE clause. The CONTEXT.md D-12 spec documents `WHERE room_id = $room_id AND user_id = $uid`.
**Warning signs:** Player reconnects to the wrong room, or reconnect navigates to a room they are not in.

### Pitfall 6: IDEN-02 Overrides localStorage Reconnect

**What goes wrong:** Signed-in user on a device that already has localStorage entry for this room goes through IDEN-02 lookup unnecessarily.
**Why it happens:** IDEN-02 runs unconditionally when `user !== null`.
**How to avoid:** IDEN-02 only runs when `!stored` (no localStorage entry). When `stored` exists, the existing localStorage reconnect path handles it — same as today. CONTEXT.md D-14 explicitly locks this: "IDEN-02 check is only attempted when the user is signed in AND no localStorage entry exists."
**Warning signs:** Extra Supabase query on every join when localStorage entry is present.

### Pitfall 7: `RoundHeader` `isSignedIn` Prop Threading

**What goes wrong:** `RoundHeader` uses a second internal `getUser()` call, resulting in duplicate auth network calls per round screen.
**Why it happens:** Adding auth state inside `RoundHeader` instead of at the page root.
**How to avoid:** Per CONTEXT.md and UI-SPEC.md Implementation Note 3: call `getUser()` once at the game page root, store as `isSignedIn: boolean`, pass it as a prop to `RoundHeader`. The lobby page does the same for its own Quit button.

---

## Code Examples

### Signed-in Chip with Name Truncation

```typescript
// Source: CONTEXT.md D-05, D-08; 04-UI-SPEC.md Component Spec 2 (max-width, truncation)
function getFirstName(user: User): string {
  const raw =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    '?'
  // Truncate to 12 chars max (UI-SPEC.md: >12 chars → truncate to 11 + '…')
  return raw.length > 12 ? raw.slice(0, 11) + '…' : raw
}
```

### Auth State Hook with Loading Guard

```typescript
// Source: CONTEXT.md Claude's Discretion; verified against @supabase/auth-js getUser() signature
import type { User } from '@supabase/supabase-js'

const [user, setUser] = useState<User | null>(null)
const [authLoading, setAuthLoading] = useState(true)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user)
    setAuthLoading(false)
  })
}, [])
```

### Minimal isSignedIn in Game Page

```typescript
// Source: CONTEXT.md Claude's Discretion; UI-SPEC.md Implementation Note 3
// Game page root (not inside RoundHeader)
const [isSignedIn, setIsSignedIn] = useState(false)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setIsSignedIn(!!data.user)
  })
}, [])

// Pass to all RoundHeader usages:
<RoundHeader round={gs.round} label={typeLabel} accent={accent} isSignedIn={isSignedIn} />
```

### IDEN-02 Inline in joinRoom()

```typescript
// Source: CONTEXT.md D-12 through D-14; mirrors existing getPlayerId + maybeSingle pattern
// Runs AFTER room lookup, BEFORE insert, ONLY when signed in AND no localStorage entry

const stored = getPlayerId(normalizedCode)

// IDEN-02: signed-in user on a new device
if (user && !stored) {
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    setPlayerId(normalizedCode, existing.id)
    setLastPseudo(normalizedCode, pseudo.trim())
    router.push(
      room.status === 'playing'
        ? `/room/${room.code}/game`
        : `/room/${room.code}/lobby`
    )
    setLoading(false)
    return
  }
}
```

### i18n Keys (4 locales)

New keys to add to `lib/i18n.ts` in each locale's dictionary:

```typescript
// fr:
auth: {
  sign_in: "Se connecter",
  sign_out: "Se déconnecter",
  pseudo_prefilled_hint: "Nom Google pré-rempli — modifiable",
}

// en:
auth: {
  sign_in: "Sign in",
  sign_out: "Sign out",
  pseudo_prefilled_hint: "Pre-filled from Google — you can change it",
}

// es:
auth: {
  sign_in: "Iniciar sesión",
  sign_out: "Cerrar sesión",
  pseudo_prefilled_hint: "Nombre de Google completado — puedes cambiarlo",
}

// de:
auth: {
  sign_in: "Anmelden",
  sign_out: "Abmelden",
  pseudo_prefilled_hint: "Google-Name vorausgefüllt — änderbar",
}
```

Note: The `Dict` type in `lib/i18n.ts` enforces key exhaustiveness — all 4 locales must have the same keys. [CITED: CLAUDE.md §i18n; 04-UI-SPEC.md Copywriting Contract]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 | Already migrated in Phase 2 — do not reintroduce auth-helpers |
| `getSession()` for auth state | `getUser()` | 2024 | Already using getUser() in middleware — maintain on client |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google first name is reliably in `user.user_metadata.full_name` for all Google accounts | Pattern 7 (Pseudo Pre-fill) | Some accounts may have only `user.user_metadata.name` — the fallback chain handles this |
| A2 | `router.push('/')` after `signOut()` causes the landing page to remount and re-run the auth `useEffect` | Pattern 3 (Sign-out) | If the router uses soft navigation without remounting, `user` state would not clear. Mitigation: also call `setUser(null)` after `signOut()`. |
| A3 | `authLoading` prevents the user from clicking "Créer" before `getUser()` resolves | Pitfall 1 | If the form renders and user submits before loading completes, `user?.id` will be `null`. Acceptable: creates anonymous row, IDEN-02 handles cross-device later. |

---

## Open Questions (RESOLVED)

1. **Should sign-out also call `setUser(null)` explicitly?**
   - What we know: `supabase.auth.signOut()` clears the server session cookie. `router.push('/')` triggers a navigation.
   - What's unclear: In Next.js App Router, does `router.push('/')` to the current page remount the component (clearing `user` state), or does it skip remount since it's the same route?
   - Recommendation: Defensively add `setUser(null); setAuthLoading(false)` immediately after `signOut()` call, before `router.push('/')`. This guarantees UI clears immediately regardless of remount behaviour. [ASSUMED: remount depends on router implementation]
   - **RESOLVED: add `setUser(null); setAuthLoading(false)` defensively before `router.push('/')` — implemented in plan 04-03 and 04-04 handleSignOut actions.**

2. **Google OAuth redirect URL for local dev vs prod**
   - What we know: `app/auth/callback/route.ts` uses `RAILWAY_PUBLIC_DOMAIN` or `X-Forwarded-Host` for prod, falls back to `request.nextUrl.origin` for local dev.
   - What's unclear: Does the Supabase Dashboard have both `http://localhost:3000/auth/callback` and the prod URL registered?
   - Recommendation: Verify in Supabase Dashboard → Authentication → URL Configuration that both URLs are in the "Redirect URLs" list. This is a manual pre-condition for Phase 4, confirmed done in Phase 2 D-02.
   - **RESOLVED: confirmed registered in Phase 2 D-02 — pre-condition satisfied.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | All auth methods | ✓ | 2.108.1 | — |
| `@supabase/ssr` | Middleware JWT refresh | ✓ | 0.12.0 | — |
| Google OAuth (Supabase Dashboard) | `signInWithOAuth({ provider: 'google' })` | ✓ (configured in Phase 2 D-02) | — | Cannot test sign-in without this |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client | ✓ (set in Railway) | — | — |

---

## Validation Architecture

### Test Framework

No automated test framework is configured in this project. No `jest`, `vitest`, `playwright`, or `cypress` found in `package.json` or project directories.

| Property | Value |
|----------|-------|
| Framework | None — manual/smoke testing only |
| Quick run command | `npm run build` (verifies TypeScript compilation) |
| Full suite command | Manual smoke test (see below) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| AUTH-01 | Sign in with Google completes OAuth and returns to app signed in | Smoke / Manual | — | Requires live Supabase + Google OAuth |
| AUTH-03 | Sign out clears session from landing page | Smoke / Manual | — | Manual verification |
| AUTH-03 | Sign out from join page | Smoke / Manual | — | Manual verification |
| IDEN-02 | Signed-in user on new device reconnects without duplicate row | Smoke / Manual | — | Requires 2 browsers or incognito |
| AUTH-04 | Anonymous flow unaffected | `npm run build` + manual game run | `npm run build` | TypeScript safety + runtime smoke |

### Sampling Rate

- **Per task commit:** `npm run build` — TypeScript compilation must be clean
- **Per wave merge:** Manual smoke: anonymous game creation + join flow unchanged
- **Phase gate:** Full auth smoke test (sign in → create room → join in incognito → verify no duplicate row)

### Wave 0 Gaps

None — no test framework to configure. Phase 4 relies on:
- TypeScript type safety (`npm run build`)
- Manual smoke testing per the 5 success criteria in the ROADMAP

---

## Security Domain

`security_enforcement: true` in `.planning/config.json`, `security_asvs_level: 1`.

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth OAuth (external identity provider — Google) |
| V3 Session Management | Yes | `@supabase/ssr` middleware handles cookie-based session; HTTP-only cookies set server-side |
| V4 Access Control | Partially | RLS stays open for Phase 4 — `user_id` is self-reported. Tighter RLS is Phase 5+ |
| V5 Input Validation | Yes | Pseudo input: existing `maxLength={20}`, trimmed before insert. No new inputs in Phase 4. |
| V6 Cryptography | N/A | PKCE code exchange already handled by `app/auth/callback/route.ts` — not hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged `user_id` in player insert | Tampering | Accepted in Phase 4 (RLS open). Phase 5 will add `CHECK auth.uid() = user_id` policy on players insert |
| Session fixation | Elevation of Privilege | Supabase Auth generates new session on OAuth completion; middleware refreshes on each request |
| OAuth CSRF | Tampering | PKCE flow (already implemented) provides code verifier protection |
| `user_metadata` injection | Tampering | Display only — Google name used for pre-fill only, user can edit freely, DB stores only `pseudo` (user-editable) and `user_id` (UUID, not injectable) |

**Phase 4 security posture:** The phase intentionally ships with `user_id` self-reported by the client (no server-side enforcement). This is documented in CONTEXT.md and matches the Phase 2 design. The mitigation is that `user_id` is used only for IDEN-02 reconnect (convenience feature, not a gating mechanism) and future stats reads. A forged `user_id` allows at most reconnecting to an existing player row in the same room — not a privilege escalation.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@supabase/auth-js/dist/main/GoTrueClient.d.ts` — `signInWithOAuth`, `signOut`, `getUser` exact signatures and JSDoc examples confirmed in installed package [VERIFIED: installed node_modules]
- `node_modules/@supabase/auth-js/dist/main/lib/types.d.ts` — `Provider` type list confirmed; `'google'` is a valid value [VERIFIED: installed node_modules]
- `supabase/migrations/002-auth.sql` — `players.user_id` nullable FK confirmed added in Phase 2 [VERIFIED: codebase]
- `app/auth/callback/route.ts` — PKCE callback already implemented, redirects to `/` [VERIFIED: codebase]
- `middleware.ts` + `lib/supabase/middleware.ts` — JWT refresh on every request already active [VERIFIED: codebase]
- `lib/supabase.ts` — `supabase` browser client export confirmed [VERIFIED: codebase]
- `lib/utils.ts` — `setPlayerId`/`getPlayerId`/`clearPlayerId`/`setLastPseudo`/`getLastPseudo` signatures confirmed [VERIFIED: codebase]
- `app/join/page.tsx` — existing reconnect pattern and insert structure confirmed [VERIFIED: codebase]
- `app/page.tsx` — existing top bar structure and createRoom insert confirmed [VERIFIED: codebase]
- `.planning/phases/02-auth-infrastructure-schema/02-RESEARCH.md` — Phase 2 research confirms all infrastructure decisions [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `.planning/phases/04-signin-ux-player-linking/04-CONTEXT.md` — locked implementation decisions [CITED: project planning docs]
- `.planning/phases/04-signin-ux-player-linking/04-UI-SPEC.md` — visual and interaction contract [CITED: project planning docs]

### Tertiary (LOW confidence)
- None — all claims verified from installed packages or locked CONTEXT.md decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules
- Architecture patterns: HIGH — locked in CONTEXT.md, code confirmed in codebase
- Pitfalls: HIGH — identified from code reading of existing files
- i18n keys: HIGH — exact strings from UI-SPEC.md Copywriting Contract

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (Supabase APIs are stable; no fast-moving dependencies in this phase)
