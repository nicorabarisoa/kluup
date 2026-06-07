# Technology Stack

**Project:** Kluup v2.0 — Auth & Stats milestone
**Researched:** 2026-06-07
**Scope:** Stack additions for Google OAuth via Supabase Auth, while keeping anonymous game flow intact

---

## Existing Stack (DO NOT change)

| Technology | Version | Role |
|------------|---------|------|
| Next.js | 16.2.7 | App Router, client-only pages |
| React | 19.2.4 | UI |
| TypeScript | ^5 | Types |
| Tailwind | ^4 | Styling |
| `@supabase/supabase-js` | ^2.107.0 | Supabase client (current) |
| `modern-screenshot` | ^4.7.0 | Share card |

Current `lib/supabase.ts` creates a bare `createClient(url, anonKey)` — no cookie handling, no auth session management. This is fine for anonymous game flows but insufficient for persistent auth sessions across navigation.

---

## Additions Required

### Core Auth Package

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/ssr` | `^0.10.3` | Browser + server Supabase clients with cookie-based session handling | Supabase Auth stores sessions in cookies, not localStorage. Without `@supabase/ssr`, the session is lost on navigation and Server Components cannot access the user. `@supabase/supabase-js` alone is insufficient for App Router auth. |

`@supabase/supabase-js` is already at `^2.107.0` which satisfies `@supabase/ssr`'s peer dep (`^2.105.3`). No upgrade needed.

**Install:**
```bash
npm install @supabase/ssr
```

No other packages required. Do NOT add:
- `@supabase/auth-helpers-nextjs` — deprecated, replaced by `@supabase/ssr`
- `next-auth` — unnecessary, Supabase Auth handles OAuth natively
- Any JWT library — Supabase handles token management internally

---

## Client Refactor: Two Supabase Clients

The current single `lib/supabase.ts` export must be split into two clients. Both use the same env vars; the difference is how they manage cookies.

### Browser Client — `lib/supabase/client.ts`

Used in `'use client'` components (all existing game pages stay client components).

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Why `createBrowserClient` not `createClient` from `supabase-js`:** `createBrowserClient` syncs the auth session to cookies so middleware can read it on the server side. The existing `createClient` only uses localStorage — fine for anonymous game data but sessions won't survive navigation or be accessible from route handlers.

**Backward compatibility:** All existing game pages import `supabase` from `lib/supabase.ts`. That file can re-export from `lib/supabase/client.ts`, or existing imports can be migrated one by one. The anonymous game flow (room, lobby, game pages) is unaffected — `createBrowserClient` is a superset of `createClient` for anonymous usage.

### Server Client — `lib/supabase/server.ts`

Used only in Route Handlers (the auth callback route). Not needed in Server Components since all game pages are `'use client'`.

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* called from Server Component — safe to ignore */ }
        }
      }
    }
  )
}
```

---

## Middleware — `middleware.ts` (new file at project root)

Required for session token refresh. Without middleware, access tokens expire and users are silently logged out mid-session.

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  // Refresh session — DO NOT remove. Required for token rotation.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
```

**Kluup-specific constraint:** This middleware must NOT redirect unauthenticated users anywhere — auth is optional. Remove the standard "redirect to /login if no user" block entirely. The middleware here purely refreshes the session cookie. All pages remain publicly accessible.

---

## Auth Callback Route — `app/auth/callback/route.ts` (new file)

Required to complete the OAuth PKCE flow. Google redirects back to this route with a `?code=` parameter; the route exchanges it for a session.

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

---

## New Environment Variable

No new env vars needed for the Supabase side — same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` already in `.env`.

One new optional var for the redirect callback:

```bash
NEXT_PUBLIC_SITE_URL=https://kluup.app
```

Used to construct the `redirectTo` URL in `signInWithOAuth`. In development this is `http://localhost:3000`. On Railway, set it in Variables.

---

## Changes to `next.config.ts`

None required. The existing config is:

```typescript
const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.63'],
}
```

`@supabase/ssr` does not require any Next.js config changes.

---

## Google OAuth Setup Requirements

### 1. Google Cloud Console
- Create or select a project at console.cloud.google.com
- Enable "Google+ API" or "Google Identity" (OAuth 2.0)
- Create OAuth 2.0 credentials (Web application type)
- Add Authorized Redirect URIs:
  - `https://<supabase-project-ref>.supabase.co/auth/v1/callback` (Supabase handles the OAuth exchange)
  - Do NOT add the Kluup app URL here — Google redirects to Supabase, Supabase redirects to Kluup
- Copy Client ID and Client Secret

### 2. Supabase Dashboard
- Authentication → Providers → Google → Enable
- Paste Google Client ID and Client Secret
- Add Site URL: `https://kluup.app`
- Add Redirect URLs (allowed list):
  - `https://kluup.app/auth/callback`
  - `http://localhost:3000/auth/callback` (development)
  - Railway preview URL if applicable

### 3. No Google Client SDK needed
Supabase's `signInWithOAuth({ provider: 'google' })` handles the redirect flow entirely. No `@react-oauth/google` or Google GSI script needed.

---

## Anonymous Flow Compatibility

The anonymous game flow is fully preserved:

| Concern | Impact | Reason |
|---------|--------|--------|
| Room join via code | None | Uses Supabase DB, not auth |
| localStorage player identity | None | `kluup_pid_<CODE>` keys untouched |
| Realtime (broadcast, presence) | None | Uses anon key, no auth required |
| Existing game pages (`'use client'`) | None | `createBrowserClient` is backward compatible with anonymous usage |
| Auth is always optional | Enforced | Middleware has no redirects; `getUser()` returning null is the normal case for most users |

The only behavioral addition: when a user is signed in (has a Supabase Auth session), `getUser()` returns their user object. When anonymous, it returns `null`. Game logic never needs to call `getUser()`.

---

## What NOT to Add

| Package / Approach | Why Not |
|-------------------|---------|
| `@supabase/auth-helpers-nextjs` | Deprecated — superseded by `@supabase/ssr` |
| `next-auth` | Adds complexity; Supabase Auth already handles Google OAuth |
| `jsonwebtoken` / `jwt-decode` | Not needed — use `supabase.auth.getUser()` |
| Custom session store | Supabase handles sessions via cookies in `@supabase/ssr` |
| Google One-Tap widget | Over-engineered for MVP auth; standard OAuth popup is sufficient |
| Server Components for game pages | All game pages are already `'use client'`; no reason to split |
| Supabase Auth anonymous sign-in (`signInAnonymously()`) | Kluup's anonymous identity is localStorage-based per room, not a Supabase Auth anonymous user. Do NOT conflate the two. Adding Supabase anonymous users adds a parallel identity system with no benefit. |

---

## Migration Path for Existing `lib/supabase.ts`

The safest approach: keep `lib/supabase.ts` as a re-export shim during migration.

```typescript
// lib/supabase.ts — backward compat shim
export { createClient as createBrowserClient } from './supabase/client'
// Keep the named export `supabase` for all existing imports
import { createClient } from './supabase/client'
export const supabase = createClient()
```

This means zero changes required in the existing game pages during this milestone.

---

## Sources

- Context7 / Supabase docs: `@supabase/ssr` install, `createBrowserClient`, `createServerClient`, middleware pattern, PKCE callback route — HIGH confidence
- npm registry: `@supabase/ssr@0.10.3` (latest), `@supabase/supabase-js@2.107.0` peer dep verified — HIGH confidence
- Context7 / Supabase docs: Google OAuth provider setup, redirect URL configuration — HIGH confidence
- Context7 / Supabase docs: `signInWithOAuth`, PKCE flow, `exchangeCodeForSession` — HIGH confidence
- Supabase key naming note: docs show `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in some newer examples (replacing `ANON_KEY`). The existing Supabase project on `dmxjspnrrgcixzcthgwf` uses the legacy `anon key` naming. Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both work, no migration needed for this milestone.
