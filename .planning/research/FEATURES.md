# Feature Landscape: Optional Auth + Cross-Session Stats

**Domain:** Optional authentication and persistent stats in a social/party game web app
**Researched:** 2026-06-07
**Confidence:** HIGH (Supabase docs + official sources + real precedents)

---

## Context: What "Optional" Actually Means Here

Kluup already has an anonymous game loop. This milestone adds a second layer on top: signed-in users get persistence. The core constraint is that **anonymous play must remain 100% unchanged** — adding auth is additive, never a gate.

The right mental model is Duolingo: let users play the full experience first, then surface a "save your stats" nudge at the moment they have something worth saving (end of game). This timing is critical — the nudge lands when the user already has a concrete result to lose, not as a pre-session barrier.

---

## Table Stakes

Features users expect when optional auth is added. Missing any of these makes the auth feel broken or trust-breaking.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Google OAuth one-tap** | No-form sign-in is the standard for web social apps; users will not fill a username/password form for a party game | Low-Med | Supabase Auth handles Google OAuth; requires `app/auth/callback/route.ts` for PKCE code exchange; one env var for Google Client ID/Secret |
| **Sign-in optional, never blocking** | Users must be able to complete the entire game without an account | Low | Auth state check on end screen only; zero auth checks in game loop |
| **Session persistence** (stay logged in) | Users will not re-authenticate every session | Low | Supabase Auth stores tokens in localStorage by default with `supabase-js`; or HTTP-only cookies with `@supabase/ssr` |
| **Stats saved automatically on sign-in** | If user signs in during/after a game, that game's stats are retroactively saved without manual action | Med | `players.user_id` FK is the join; end-screen should flush stats when user sign-in state resolves |
| **Stats profile page** | Users who sign in expect to see their history somewhere | Med | `/profile` route with simple table/card of cumulative stats |
| **Sign out** | Users expect to be able to detach their account | Low | `supabase.auth.signOut()` + clear local state |
| **Anonymous play unchanged** | Zero regression on the existing flow | Critical | No auth check anywhere in game loop; `players.user_id` is nullable (no NOT NULL constraint) |

---

## Differentiators

Features that make sign-up feel valuable rather than just a form. These are the "why would I bother?" answerers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Personality snapshot** | Cumulative stats reframed as identity ("You've been designated 23 times — the group always suspects you") | Low | Pure presentation layer; same data, different copy |
| **Cross-session group titles history** | List of all group titles earned across sessions ("Ruthless × 3, Unclassifiable × 1") | Low | One column `titles_history jsonb[]` in user_stats or store raw per-session rows |
| **Avatar from Google** | User's Google profile photo surfaced in-app (lobby, profile) — instant recognition | Low | `user.user_metadata.avatar_url` returned by Google OAuth; just render it |
| **"Your best game" highlight** | Most designated in a single session, most confessions, etc. — surfaced on profile | Low-Med | Requires per-session row storage (not just cumulative), then a MAX query |
| **End-screen nudge with preview** | Show "You were designated 4 times this session — sign in to track your record" with a glimpse of the stats profile | Low | Only shown when user is anonymous AND has non-zero stats |
| **Lobby sign-in indicator** | Signed-in users show a small avatar badge in the lobby — passive social proof that accounts are real | Low | Only visual; no game behavior change |

---

## Anti-Features

Features to explicitly NOT build in v1 of auth.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Email/password signup** | Massive drop-off; party game users will not fill a form mid-session | Google OAuth only; add email later if demanded |
| **Mandatory account for hosting** | Breaks the "no install, no friction" positioning; loses casual hosts | Keep optional for everyone in v2.0; gate hosting behind auth only in v3.0 monetisation milestone |
| **Force re-authenticate if token expires** | Kills sessions silently; users lose data and don't understand why | Handle `onAuthStateChange` gracefully; show soft "reconnect" prompt, not a hard redirect |
| **Public profile / leaderboard** | Privacy violation for a game built on personal confessions; wrong genre for competition | Stats are private by default; add social features only if explicitly requested post-launch |
| **Account linking (anonymous → existing Google account)** | Supabase `linkIdentity()` has a documented bug when linking via OAuth where `user_metadata` returns only `{email_verified: true}` — missing avatar, full_name; conflict resolution with pre-existing accounts is also manual and complex | Do not use `signInAnonymously()` + `linkIdentity()`; use a separate clean `signInWithOAuth()` flow; stats are merged via `players.user_id` FK, not via user merging |
| **Stats visible to other players in the room** | Adds social comparison pressure that contradicts the game's "authentic connection" spirit | Stats stay on user's own profile page |
| **Push notifications / email digests** | Scope creep; users are not installing an app; they're playing a browser game | Out of scope entirely |
| **Username/display name editing** | Adds account settings complexity; Google name is sufficient | Use Google `full_name` as display name; editable display names are v4+ |

---

## Feature Dependencies

```
Google OAuth (Supabase Auth configured)
  → auth/callback route.ts exists (PKCE code exchange)
    → Supabase session stored (localStorage or cookie)
      → players.user_id FK nullable column added to schema
        → End-screen reads auth.user → links player row → flushes stats
          → user_stats table (cumulative) upserted
            → /profile page reads user_stats
              → Personality snapshot copy rendered
```

**Dependency on existing anonymous identity model:**
- `players.user_id` is currently absent; the entire identity is `kluup_pid_{CODE}` in localStorage.
- Adding `user_id` must be nullable with no default — anonymous players stay anonymous.
- On game end: if `supabase.auth.getUser()` returns a user, write `user_id` to the player row and upsert stats; otherwise do nothing.
- `getPlayerId(code)` / `setPlayerId(code, id)` in `lib/utils.ts` must remain the primary identity source for game join/reconnect — auth is a parallel layer, not a replacement.

**No dependency on Supabase Anonymous Sign-ins feature:**
Kluup's anonymous players are NOT Supabase anonymous users (created via `signInAnonymously()`). They are unauthenticated (anon role). Do not conflate. This means `linkIdentity()` is not in play; opt-in means a fresh `signInWithOAuth()` call.

---

## UX Patterns — Nudge Placement and Timing

### The Duolingo Pattern (recommended)
Show the "sign in to save" prompt **after** the user has experienced something worth saving — at the end-of-game screen, after they've seen their personal stats and the group title. Timing: prompt appears below personal stats, above "Replay" and "Quit" buttons.

**Copy pattern:** "You were designated 4 times — sign in to keep your record." (Loss-aversion framing: something concrete to lose.)

**Implementation:** If `!authUser && hasMeaningfulStats` (e.g., any stat > 0), render a dismissible inline card with a single "Sign in with Google" button. One-tap, no form, no modal.

### Session re-entry
If user returns to a new room code and is already signed in (session still valid), `supabase.auth.getUser()` resolves immediately — no additional action needed. Stats accumulate silently.

### What NOT to do (dark patterns)
- Do not show the nudge before or during the game.
- Do not block "Replay" or "Quit" behind sign-in.
- Do not show a countdown ("Your stats will be lost in 30s...").
- Do not add the nudge to the landing page or lobby — wrong moment, wrong context.

---

## Stats That Are Compelling Enough to Motivate Sign-up

The stats must feel like **identity**, not just numbers. Examples from existing session stats (`stats` in `GameState`):

| Stat | Display framing | Compelling? |
|------|-----------------|-------------|
| Times designated (Type A) | "Your group's favourite suspect" | HIGH — social ego, fun to share |
| Confession reveals (Type B roulette) | "Caught in the act N times" | HIGH — memorable personal moment |
| Volunteer count (Type C) | "Stepped up N times" | MEDIUM — virtue signal, some appeal |
| Sessions played | "N sessions played" | LOW alone — only meaningful with other stats |
| Group titles history | "Ruthless × 2, Unclassifiable × 1" | HIGH — identity narrative |
| Total players met | "Played with N people" | MEDIUM — social proof of engagement |

**Minimum compelling profile:** designation count + confession reveals + group titles history. A profile with only "sessions played: 1" will not drive sign-up motivation.

---

## MVP Recommendation

**Phase 1 (v2.0 as specified):**
1. Google OAuth via Supabase Auth — `signInWithOAuth({ provider: 'google' })`
2. `app/auth/callback/route.ts` for PKCE code exchange
3. `players.user_id` nullable FK — migration, no NOT NULL
4. `user_stats` table: `user_id PK, sessions_played, times_designated, confession_reveals, volunteer_count, titles_history jsonb, updated_at`
5. End-screen: flush stats to `user_stats` via upsert if signed in
6. End-screen: show nudge if not signed in AND stats > 0
7. `/profile` page: cumulative stats display (designation count, confessions, volunteers, sessions, titles)

**Defer:**
- Avatar in lobby — nice to have, adds complexity to lobby realtime (player row needs avatar_url synced)
- Per-session history rows (for "best game" stat) — requires additional table, not worth it in v1
- `total_players_met` — requires set tracking, not a simple counter; defer
- Personality snapshot copy — easy add in a follow-up, not blocking

---

## Technical Constraints and Risks

### Risk 1: Current app is entirely `'use client'` — no server components
**Impact:** The standard Supabase SSR cookie-based auth (`@supabase/ssr` with middleware) requires server components and middleware. The current architecture has none.

**Resolution:** Use `supabase-js` client-side auth with `localStorage` token storage (the default). This works perfectly for a client-only app. Create `app/auth/callback/route.ts` as a minimal Next.js Route Handler (this IS a server route, not a server component — no conflict). PKCE code exchange happens in this route handler.

**Confidence:** HIGH — this is the documented path for client-only + App Router.

### Risk 2: `NEXT_PUBLIC_*` vars inlined at build time
**Impact:** Any new env vars for Google OAuth (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` already exist; Google Client ID/Secret go in Supabase dashboard, not in Next.js env). No additional `NEXT_PUBLIC_*` vars needed for Google OAuth when using Supabase Auth — Supabase handles the OAuth handshake server-side.

**Resolution:** Configure Google provider in Supabase dashboard (Authentication → Providers → Google). Rebuild Railway after adding Google credentials to Supabase.

### Risk 3: RLS is fully open (anon has all permissions)
**Impact:** `user_stats` table should NOT be fully open — users should only read/write their own stats.

**Resolution:** Enable RLS on `user_stats` with policy `auth.uid() = user_id`. This is safe because the table requires an authenticated user — anonymous (unauthenticated) users simply cannot insert. This does NOT affect the game tables which remain open.

### Risk 4: `user_metadata` incomplete when using linkIdentity
**Impact:** If we ever try to link an anonymous Supabase user to Google, the returned metadata is `{ email_verified: true }` only — avatar_url and full_name are missing (known Supabase bug, Discussion #37797).

**Resolution:** Avoid `linkIdentity()` entirely. Use a clean `signInWithOAuth()`. The "anonymous" in Kluup's context is not a Supabase anonymous user — it's an unauthenticated session. No linking required.

---

## Sources

- Supabase Anonymous Sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Auth with Next.js Quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase user_metadata Google fields (community): https://github.com/orgs/supabase/discussions/4047
- linkIdentity missing metadata bug: https://github.com/orgs/supabase/discussions/37797
- Google OAuth Next.js App Router guide (DEV): https://dev.to/mohamed3on/how-to-add-google-oauth-to-nextjs-app-router-with-supabase-auth-f0e
- Duolingo gradual engagement / "sign in to save" pattern: https://goodux.appcues.com/blog/duolingo-user-onboarding
- Social login conversion rates (+20-60%): https://www.dogtownmedia.com/social-login-for-mobile-apps-google-apple-linkedin-boosting-sign-up-conversion-by-removing-friction/
- Progressive profiling UX: https://www.descope.com/learn/post/progressive-profiling
- Dark patterns vs nudges in UX: https://uxplanet.org/dark-patterns-versus-behavioural-nudges-in-ux-e79633970b3f
