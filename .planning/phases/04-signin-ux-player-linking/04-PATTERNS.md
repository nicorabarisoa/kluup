# Phase 4: Sign-in UX + Player Linking — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 5
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/page.tsx` | page (form + top bar) | request-response | `app/join/page.tsx` (auth slot pattern) + self (existing insert) | exact — modify in place |
| `app/join/page.tsx` | page (form + reconnect logic) | request-response + CRUD | self (existing reconnect pattern) | exact — modify in place |
| `app/room/[code]/game/page.tsx` | page root + inner component | request-response | self (`RoundHeader` component) | exact — modify in place |
| `app/room/[code]/lobby/page.tsx` | page (top bar quit button) | request-response | `app/room/[code]/game/page.tsx` `RoundHeader` Quit button | role-match |
| `lib/i18n.ts` | config / dictionary | transform | self (existing `fr`/`en`/`es`/`de` dictionary blocks) | exact — add keys |

---

## Pattern Assignments

### `app/page.tsx` — add auth hook + top bar chip + user_id in insert + pseudo pre-fill

**Analog:** `app/join/page.tsx` (useEffect + useState pattern); self for insert and top-bar structure.

---

**Existing import block** (`app/page.tsx` lines 1–8) — add `useEffect` and `User` type:

```typescript
'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'   // add useEffect
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { genId, setPlayerId } from '@/lib/utils'
import { useT, LangSwitch } from '@/lib/locale'
import type { User } from '@supabase/supabase-js'      // add
```

---

**Auth state hook** — insert after existing `useState` declarations inside `Home()`:

```typescript
// Auth state — one network call on mount, result cached in component state.
const [user, setUser] = useState<User | null>(null)
const [authLoading, setAuthLoading] = useState(true)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user)
    setAuthLoading(false)
  })
}, [])

// Google first name for pseudo pre-fill (D-08). Truncate >12 chars (UI-SPEC).
function getFirstName(u: User): string {
  const raw =
    u.user_metadata?.full_name?.split(' ')[0] ||
    u.user_metadata?.name?.split(' ')[0] ||
    u.email?.split('@')[0] ||
    '?'
  return raw.length > 12 ? raw.slice(0, 11) + '…' : raw
}

// Pre-fill pseudo from Google name when user is signed in and field is empty.
useEffect(() => {
  if (user && !pseudo) {
    setPseudo(getFirstName(user))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user])
```

---

**Sign-in / sign-out handlers**:

```typescript
async function handleSignIn() {
  await supabase.auth.signInWithOAuth({ provider: 'google' })
  // browser navigates to Google — no cleanup needed
}

async function handleSignOut() {
  await supabase.auth.signOut()
  setUser(null)
  setAuthLoading(false)
  router.push('/')
}
```

---

**Top bar — existing structure** (`app/page.tsx` lines 109–114) to replace:

```typescript
// BEFORE:
<div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6 pt-5">
  <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
    <span style={{ color: '#FFFFFF' }}>Klu</span><span style={{ color: '#39FF14' }}>up</span>
  </span>
  <LangSwitch />
</div>

// AFTER (auth slot inserted left of LangSwitch):
<div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6 pt-5">
  <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
    <span style={{ color: '#FFFFFF' }}>Klu</span><span style={{ color: '#39FF14' }}>up</span>
  </span>
  <div className="flex items-center gap-2">
    {!authLoading && !user && (
      <button
        onClick={handleSignIn}
        className="text-xs font-extrabold px-2.5 py-1.5 rounded-xl"
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: '#fff', fontFamily: 'var(--font-body)' }}
      >
        {fr.auth.sign_in}
      </button>
    )}
    {!authLoading && user && (
      <button
        onClick={handleSignOut}
        className="flex items-center text-xs px-2.5 py-1.5 rounded-xl max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ background: C.surface, border: `1px solid ${C.border}`, fontFamily: 'var(--font-body)' }}
      >
        <span style={{ color: '#fff', fontWeight: 800 }}>{getFirstName(user)}</span>
        <span style={{ color: C.faint }}> · </span>
        <span style={{ color: C.muted }}>{fr.auth.sign_out}</span>
      </button>
    )}
    <LangSwitch />
  </div>
</div>
```

---

**Player insert — existing** (`app/page.tsx` lines 83–86) — add `user_id`:

```typescript
// BEFORE:
const { data: player, error: playerError } = await supabase
  .from('players')
  .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true })
  .select()
  .single()

// AFTER (D-10 — add user_id; null for anonymous, user.id when signed in):
const { data: player, error: playerError } = await supabase
  .from('players')
  .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true, user_id: user?.id ?? null })
  .select()
  .single()
```

---

### `app/join/page.tsx` — add auth hook + top bar chip + IDEN-02 + user_id in insert + pseudo pre-fill

**Analog:** self — the existing localStorage reconnect block (lines 80–90) is the direct model for the IDEN-02 `user_id` lookup. Same `.maybeSingle()` shape, different WHERE clause.

---

**Import additions** (line 3 in `app/join/page.tsx`):

```typescript
// BEFORE:
import { Suspense, useEffect, useState } from 'react'
// AFTER:
import { Suspense, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'     // add
```

---

**Auth state hook** — insert after existing `useState` declarations in `JoinForm()`:

```typescript
const [user, setUser] = useState<User | null>(null)
const [authLoading, setAuthLoading] = useState(true)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user)
    setAuthLoading(false)
  })
}, [])
```

---

**Google name pre-fill** — extend the existing `useEffect` that already pre-fills from `getLastPseudo` (lines 19–46). Add Google-name fallback after the remembered-pseudo block:

```typescript
// After the existing remembered-pseudo block, add:
// If no stored pseudo and user is signed in, pre-fill from Google name.
if (!remembered && user) {
  const raw =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    ''
  const firstName = raw.length > 12 ? raw.slice(0, 11) + '…' : raw
  if (firstName) {
    setPseudo(firstName)
    // Do NOT set storedPseudo — this is Google pre-fill, not a remembered game pseudo.
  }
}
```

---

**IDEN-02 block** — insert inside `joinRoom()`, after room lookup succeeds (`!roomError && room`), before the existing localStorage reconnect block (currently line 79):

```typescript
// IDEN-02: signed-in user on a new device — match existing player row by user_id.
// Only attempted when signed in AND no localStorage entry for this room (D-14).
const stored = getPlayerId(normalizedCode)   // already read below; hoist here
if (user && !stored) {
  const { data: existingByUid } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingByUid) {
    setPlayerId(normalizedCode, existingByUid.id)
    setLastPseudo(normalizedCode, pseudo.trim())
    router.push(
      room.status === 'playing'
        ? `/room/${room.code}/game`
        : `/room/${room.code}/lobby`
    )
    setLoading(false)
    return  // skip insert — reconnected silently (D-12)
  }
}
```

Note: the existing `const stored = getPlayerId(normalizedCode)` on line 80 should be hoisted to before this block so both the IDEN-02 guard and the existing localStorage reconnect share the same variable.

---

**Player insert — existing** (`app/join/page.tsx` line 95) — add `user_id`:

```typescript
// BEFORE:
.insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false })
// AFTER:
.insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false, user_id: user?.id ?? null })
```

---

**Top bar — existing structure** (`app/join/page.tsx` lines 123–133):

```typescript
// BEFORE:
<div className="w-full flex justify-between items-center">
  <button ...>{fr.join.back_home}</button>
  <LangSwitch />
</div>

// AFTER:
<div className="w-full flex justify-between items-center">
  <button ...>{fr.join.back_home}</button>
  <div className="flex items-center gap-2">
    {!authLoading && !user && (
      <button
        onClick={handleSignIn}
        className="text-xs font-extrabold px-2.5 py-1.5 rounded-xl"
        style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#fff', fontFamily: 'var(--font-body)' }}
      >
        {fr.auth.sign_in}
      </button>
    )}
    {!authLoading && user && (
      <button
        onClick={handleSignOut}
        className="flex items-center text-xs px-2.5 py-1.5 rounded-xl max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
      >
        <span style={{ color: '#fff', fontWeight: 800 }}>{getFirstName(user)}</span>
        <span style={{ color: '#555555' }}> · </span>
        <span style={{ color: '#888888' }}>{fr.auth.sign_out}</span>
      </button>
    )}
    <LangSwitch />
  </div>
</div>
```

Sign-out on join page: `supabase.auth.signOut()` then `router.push('/')` (not `router.refresh()` — consistent with landing page D-07).

---

### `app/room/[code]/game/page.tsx` — add isSignedIn state + prop thread to RoundHeader + green dot

**Analog:** self — existing `RoundHeader` component (lines 122–163) and existing `useEffect` state init patterns scattered in the page root.

---

**isSignedIn state** — add in game page root component alongside other `useState` declarations:

```typescript
// Near the top of the page root component, after existing useState declarations:
const [isSignedIn, setIsSignedIn] = useState(false)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setIsSignedIn(!!data.user)
  })
}, [])
```

---

**RoundHeader signature — existing** (line 122) to modify:

```typescript
// BEFORE:
function RoundHeader({ round, label, accent }: { round: number; label: string; accent: string }) {

// AFTER (add optional isSignedIn prop):
function RoundHeader({ round, label, accent, isSignedIn }: {
  round: number; label: string; accent: string; isSignedIn?: boolean
}) {
```

---

**Quit button — existing** (lines 131–138) to wrap with green dot:

```typescript
// BEFORE:
{controls && (
  <button
    onClick={controls.onQuit}
    className="px-3 h-8 rounded-xl text-xs font-medium flex-shrink-0"
    style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
  >
    {fr.game.quit}
  </button>
)}

// AFTER (relative wrapper + conditional dot):
{controls && (
  <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
    <button
      onClick={controls.onQuit}
      className="px-3 h-8 rounded-xl text-xs font-medium"
      style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
    >
      {fr.game.quit}
    </button>
    {isSignedIn && (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: -2, right: -2,
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e',
          pointerEvents: 'none',
        }}
      />
    )}
  </div>
)}
```

---

**RoundHeader call sites** — all usages of `<RoundHeader ... />` in the page must pass `isSignedIn`:

```typescript
// All usages (the page uses RoundHeader in multiple phase-render branches):
<RoundHeader round={gs.round} label={typeLabel} accent={accent} isSignedIn={isSignedIn} />
```

---

### `app/room/[code]/lobby/page.tsx` — add isSignedIn state + green dot on Quit button

**Analog:** `app/room/[code]/game/page.tsx` RoundHeader Quit button (role-match — same visual pattern, different component).

---

**isSignedIn state** — add in `LobbyPage()` alongside existing `useState` declarations (lines 26–31):

```typescript
const [isSignedIn, setIsSignedIn] = useState(false)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setIsSignedIn(!!data.user)
  })
}, [])
```

---

**Lobby Quit button — existing** (lines 211–218):

```typescript
// BEFORE:
<button
  type="button"
  onClick={onQuit}
  className="text-xs font-medium px-3 h-8 rounded-xl"
  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
>
  {fr.game.quit}
</button>

// AFTER (same wrapper pattern as RoundHeader):
<div style={{ position: 'relative', display: 'inline-block' }}>
  <button
    type="button"
    onClick={onQuit}
    className="text-xs font-medium px-3 h-8 rounded-xl"
    style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
  >
    {fr.game.quit}
  </button>
  {isSignedIn && (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top: -2, right: -2,
        width: 6, height: 6, borderRadius: '50%',
        background: '#22c55e',
        pointerEvents: 'none',
      }}
    />
  )}
</div>
```

---

### `lib/i18n.ts` — add `auth.*` keys to all four locale dictionaries

**Analog:** self — existing dictionary structure. The `Dict` type enforces all four locales have identical keys. New `auth` namespace must appear in `fr`, `en`, `es`, and `de` blocks.

---

**Pattern — existing dict block shape** (lines 1–9 show fr structure):

```typescript
export const fr = {
  common: { ... },
  home: { ... },
  landing: { ... },
  join: { ... },
  // ... other namespaces
}
```

Add `auth` namespace to each locale:

```typescript
// fr:
auth: {
  sign_in: "Se connecter",
  sign_out: "Se déconnecter",
  pseudo_prefilled_hint: "Nom Google pré-rempli — modifiable",
},

// en:
auth: {
  sign_in: "Sign in",
  sign_out: "Sign out",
  pseudo_prefilled_hint: "Pre-filled from Google — you can change it",
},

// es:
auth: {
  sign_in: "Iniciar sesión",
  sign_out: "Cerrar sesión",
  pseudo_prefilled_hint: "Nombre de Google completado — puedes cambiarlo",
},

// de:
auth: {
  sign_in: "Anmelden",
  sign_out: "Abmelden",
  pseudo_prefilled_hint: "Google-Name vorausgefüllt — änderbar",
},
```

The `Dict` type (used by `useT()`) must also gain an `auth` field definition with these three string keys. Find the `type Dict` or `type Translations` declaration in `lib/i18n.ts` and add:

```typescript
auth: {
  sign_in: string
  sign_out: string
  pseudo_prefilled_hint: string
}
```

---

## Shared Patterns

### Auth State Hook (landing + join pages only)

**Apply to:** `app/page.tsx`, `app/join/page.tsx`

```typescript
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

- Never call `getUser()` outside `useEffect` — it makes a network call.
- `authLoading` prevents flash of signed-out state to signed-in users.
- Do NOT use `getSession()` — it reads stale local storage. `getUser()` validates against the Auth server.

---

### isSignedIn Boolean (game + lobby pages)

**Apply to:** `app/room/[code]/game/page.tsx`, `app/room/[code]/lobby/page.tsx`

```typescript
const [isSignedIn, setIsSignedIn] = useState(false)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setIsSignedIn(!!data.user)
  })
}, [])
```

- The full `User` object is not needed in game/lobby — only the boolean.
- Call once at the page root, pass as prop to sub-components. Do not call `getUser()` inside `RoundHeader`.

---

### Green Dot Indicator (game + lobby Quit buttons)

**Apply to:** `RoundHeader` Quit button in `app/room/[code]/game/page.tsx`, Quit button in `app/room/[code]/lobby/page.tsx`

```typescript
<div style={{ position: 'relative', display: 'inline-block' }}>
  <button ...>{fr.game.quit}</button>
  {isSignedIn && (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top: -2, right: -2,
        width: 6, height: 6, borderRadius: '50%',
        background: '#22c55e',
        pointerEvents: 'none',
      }}
    />
  )}
</div>
```

---

### Top Bar Auth Slot (landing + join)

**Apply to:** `app/page.tsx`, `app/join/page.tsx`

The pattern replaces bare `<LangSwitch />` in the right side of the top bar with a flex cluster. Render nothing in the auth slot until `authLoading = false` to prevent state flash.

```typescript
<div className="flex items-center gap-2">
  {/* Nothing rendered while authLoading — prevents flash */}
  {!authLoading && !user && (
    <button onClick={handleSignIn} ...>{fr.auth.sign_in}</button>
  )}
  {!authLoading && user && (
    <button onClick={handleSignOut} ...>
      <span>{getFirstName(user)}</span>
      <span> · </span>
      <span>{fr.auth.sign_out}</span>
    </button>
  )}
  <LangSwitch />
</div>
```

---

### user_id in Player Insert

**Apply to:** `app/page.tsx` (createRoom insert), `app/join/page.tsx` (joinRoom insert)

One-field addition. Always `user?.id ?? null`. RLS is open — self-reported value accepted in Phase 4.

```typescript
.insert({ ..., user_id: user?.id ?? null })
```

---

## No Analog Found

None. All five files have clear analogs (or are self-modifying with direct existing patterns to follow).

---

## Metadata

**Analog search scope:** `app/`, `lib/`
**Key files read:** `app/page.tsx`, `app/join/page.tsx`, `app/room/[code]/game/page.tsx` (RoundHeader + imports), `app/room/[code]/lobby/page.tsx`, `lib/i18n.ts`
**Pattern extraction date:** 2026-06-11
