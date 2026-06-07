# Phase 2: Auth Infrastructure + Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 2-Auth Infrastructure + Schema
**Areas discussed:** session_id derivation, Supabase Dashboard manual steps

---

## session_id derivation

### Where should session_id live?

| Option | Description | Selected |
|--------|-------------|----------|
| In game_state jsonb | Add session_uuid to rooms.game_state; already reset on replay; no new DB columns | ✓ |
| New column on rooms table | Add current_session_id UUID to the rooms table; more explicit but adds a migration column | |

**User's choice:** In game_state jsonb (recommended option)
**Notes:** Fits naturally alongside played_question_ids and stats already stored in game_state. Auto-reset on replay is a side-effect of startGame resetting the whole game_state.

### What format for session_id?

| Option | Description | Selected |
|--------|-------------|----------|
| UUID v4 via crypto.randomUUID() | Zero collision risk, no server round-trip, available in modern browsers and Node | ✓ |
| You decide | Any format that's unique per playthrough | |

**User's choice:** UUID v4 via crypto.randomUUID() (recommended option)
**Notes:** Consistent with genId() pattern already in lib/utils.ts.

---

## Supabase Dashboard Manual Steps

| Option | Description | Selected |
|--------|-------------|----------|
| Include in Phase 2 | Manual BLOCKING task: enable Google provider, add redirect URL; enables PKCE smoke test in Phase 2 | ✓ |
| Defer to Phase 3 | Test only the no-code path in Phase 2; full OAuth test when sign-in button ships | |

**User's choice:** Yes — include in Phase 2 (recommended option)
**Notes:** Allows verifying the full PKCE callback flow before Phase 3 adds the sign-in button. Only 5 minutes of manual Dashboard work.

---

## Claude's Discretion

- **SQL migration approach:** create `supabase/migrations/002-auth.sql` as a standalone migration file with only the new changes. Also update `supabase/schema.sql` to keep it as the idempotent source of truth.
- **Auth client library:** `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`)
- **Middleware matcher scope:** all paths except static assets
- **Callback error handling:** redirect to `/` on error or missing `code`

## Deferred Ideas

None — discussion stayed within phase scope.
