---
phase: 02-auth-infrastructure-schema
plan: "02"
subsystem: auth-plumbing
tags: [auth, supabase-ssr, middleware, pkce, server-client]
dependency_graph:
  requires: []
  provides:
    - "lib/supabase/server.ts → createClient() (async, server-side)"
    - "lib/supabase/middleware.ts → updateSession() (JWT refresh via getUser)"
    - "middleware.ts → Next.js proxy wired with static-asset-excluding matcher"
    - "app/auth/callback/route.ts → GET (PKCE code exchange, silent redirect to /)"
  affects:
    - "All server-side Supabase usage in plan 02-03 and beyond (consumes createClient)"
    - "All authenticated routes (middleware refreshes JWT on every navigation)"
tech_stack:
  added:
    - "@supabase/ssr@0.10.3 (peer-compatible with @supabase/supabase-js 2.107.0)"
  patterns:
    - "createServerClient from @supabase/ssr with getAll/setAll cookie adapter"
    - "let supabaseResponse (reassigned in setAll) for double cookie write"
    - "getUser() for authoritative server-side validation (not deprecated getSession)"
    - "PKCE silent-redirect pattern (D-02): always redirect to / on success or error"
key_files:
  created:
    - lib/supabase/server.ts
    - lib/supabase/middleware.ts
    - middleware.ts
    - app/auth/callback/route.ts
  modified:
    - package.json (added @supabase/ssr)
    - package-lock.json
decisions:
  - "middleware.ts retained (not renamed to proxy.ts): Next.js 16.2.7 emits a deprecation warning but build exits 0 and @supabase/ssr documentation targets this filename; renaming is deferred to Next.js upgrade cycle"
  - "lib/supabase/index.ts NOT created: would shadow lib/supabase.ts and break all existing import { supabase } from '@/lib/supabase' calls"
  - "getUser() used instead of getSession(): authoritative validation against Auth server, detects server-side logout"
  - "D-02 silent-redirect: callback always redirects to / — no OAuth error detail exposed to client"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-10"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
---

# Phase 02 Plan 02: Server-side Auth Plumbing Summary

**One-liner:** @supabase/ssr server client + middleware JWT refresh + PKCE callback route — anonymous requests pass through unchanged.

## What Was Built

This plan installed `@supabase/ssr` and created the four server-side auth-plumbing files required for AUTH-02 (JWT refresh) and the plumbing aspect of AUTH-04 (anonymous flow unchanged):

1. **`lib/supabase/server.ts`** — `async createClient()` factory using `createServerClient` from `@supabase/ssr`. Awaits `cookies()` from `next/headers` (mandatory in Next.js 16). Cookie adapter: `getAll()` + `setAll()` with try/catch for Server Component writes. Reuses existing `NEXT_PUBLIC_*` env vars with the same warning pattern as `lib/supabase.ts`.

2. **`lib/supabase/middleware.ts`** — `async updateSession(request: NextRequest)`. Declared with `let supabaseResponse` (not `const`) so it can be reassigned in `setAll()` when the Supabase client writes refreshed tokens back to the response. Calls `getUser()` (not `getSession()`) for authoritative server-side session validation. Anonymous requests return `{ user: null }` silently — no error, no redirect.

3. **`middleware.ts`** (project root) — Wires `updateSession` with a static-asset-excluding matcher (`/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)`). Runs on all app paths but not on static assets, keeping latency off those requests.

4. **`app/auth/callback/route.ts`** — PKCE `GET` handler. Reads `code` from `searchParams`; silently redirects to `/` when absent. Calls `exchangeCodeForSession(code)`, logs errors server-side only (D-02: never expose OAuth details to client), and redirects to `/` on both success and error.

**Build verification:** `npm run build` exits 0 with all four files compiled and type-checked. The `/auth/callback` Route Handler appears in the build output as a Dynamic route.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `middleware.ts` not renamed to `proxy.ts` | Next.js 16.2.7 deprecated `middleware.ts` in favor of `proxy.ts` (warning at build, not error). `@supabase/ssr` docs target `middleware.ts`; plan spec names `middleware.ts`. Renaming deferred to Next.js upgrade cycle. |
| `lib/supabase/index.ts` NOT created | Would shadow `lib/supabase.ts` and break all existing `import { supabase } from '@/lib/supabase'` calls throughout the codebase. |
| `getUser()` over `getSession()` | `getSession()` is deprecated server-side (reads storage without Auth server validation, cannot detect server-side logout). `getUser()` validates against the Auth server on every call. |
| Silent redirect on all callback outcomes | Decision D-02: missing code, exchange success, and exchange failure all redirect to `/`. No OAuth error detail is surfaced to the client. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `getSession()` string from comment in lib/supabase/middleware.ts**
- **Found during:** Task 2 verification
- **Issue:** Task 2's content-assertion script treats any occurrence of `getSession()` (including in comments) as forbidden. The initial implementation included `getSession()` in an explanatory comment.
- **Fix:** Rewrote the comment to describe the pattern without using the forbidden string.
- **Files modified:** lib/supabase/middleware.ts
- **Commit:** 3a91dff (the file was corrected before the commit; no extra commit needed)

### Observed Non-blocking Warnings

- **Next.js 16.2.7 deprecation:** `The "middleware" file convention is deprecated. Please use "proxy" instead.` — This is a warning, not an error. Build exits 0. Documented in Decisions.
- **npm audit:** 2 moderate severity vulnerabilities in transitive deps — pre-existing, out of scope for this plan.

## Known Stubs

None. This plan delivers pure plumbing files with no UI and no data-rendering paths. No stub patterns introduced.

## Threat Flags

No new security-relevant surface beyond what was planned. All STRIDE mitigations from the plan's threat register are implemented:

| Threat ID | Status |
|-----------|--------|
| T-02-04 | Mitigated — `getUser()` used (not `getSession()`) |
| T-02-05 | Mitigated — `exchangeCodeForSession` is single-use + TTL; code absence → silent redirect |
| T-02-06 | Mitigated — anonymous requests pass through with `{ user: null }`, no redirect; static assets excluded from matcher |
| T-02-07 | Mitigated — error logged server-side only, client always gets redirect to `/` |
| T-02-SC | Accepted — `@supabase/ssr` passed legitimacy audit in RESEARCH.md |

## Self-Check

- [x] lib/supabase/server.ts — FOUND
- [x] lib/supabase/middleware.ts — FOUND
- [x] middleware.ts — FOUND
- [x] app/auth/callback/route.ts — FOUND
- [x] lib/supabase/index.ts — CONFIRMED ABSENT
- [x] Commit e6d2d2e — FOUND (Task 1)
- [x] Commit 3a91dff — FOUND (Task 2)
- [x] Commit 0af3ccb — FOUND (Task 3)
- [x] npm run build — exits 0

## Self-Check: PASSED
