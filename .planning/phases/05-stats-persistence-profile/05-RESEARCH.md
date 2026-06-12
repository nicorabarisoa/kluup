# Phase 5: Stats Persistence + Profile — Research

**Researched:** 2026-06-12
**Domain:** Supabase upsert / RLS write, Next.js App Router profile page, Realtime JWT resilience
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Each signed-in client writes **its own row** when it reaches the end screen (`ended` phase). Forced by RLS: `user_session_stats` INSERT policy is `auth.uid() = user_id` — the host cannot write for others. Idempotent via `UNIQUE(user_id, session_id)` (upsert with `onConflict` ignore, or insert + tolerate 23505).

**D-02:** Signed-in player who quits (or closes tab) before the end screen → **stats lost** for that session. No write-on-quit. Free nuance: if they come back to the end screen before the room dies (TTL 30 min), the standard write path runs normally.

**D-03:** Host ends the game early via "Terminer la session" → **stats are saved anyway**. Same end screen, same code path. A played session is a played session — no minimum-rounds rule.

**D-04:** Anonymous player taps "Se connecter" on the end screen → OAuth round-trip with `next=/room/{CODE}/game` (uses the `?next=` mechanism added to `/auth/callback` on 2026-06-12, which superseded Phase 4's D-04 "always redirect to /"). They land back on the end screen.

**D-05:** On return: the client detects "signed in + game ended + no row yet for (user, session)" and **retroactively saves the session they just played**. The CTA's promise ("save YOUR stats") is honored at the hottest conversion moment. Stats are computed from their `player_id` votes, still in DB while the room lives.

**D-06:** Add columns to `user_session_stats`: `theme text` and `rounds_played int` (plus `tag_scores jsonb` per REQ-AR-07). Migration file + `supabase/schema.sql` updated idempotently (Phase 2 convention).

**D-07:** History shows the **last 20 sessions** (no pagination UI). Cumulative block reflects ALL history regardless of the display limit.

**D-08:** Ship the `tag_scores jsonb` column, the accumulation logic, and the profile archetype display — but the block is **hidden while total score = 0**. No teaser, no empty promise. When v3.0 tags the questions, the block lights up without redeploy.

### Claude's Discretion

- **Write feedback:** discreet "Stats sauvegardées ✓" line under the personal stats on the end screen (i18n key, signed-in users only). On write failure: silent (console.error) — stats never block the party, no retry UI. The idempotent write naturally retries on refresh.
- **Account↔player linking on CTA return:** after retroactive sign-in, also set `user_id` on the player's `players` row (enables IDEN-02 for that room). If the room died before the OAuth return → abort silently, the CTA save is lost.
- **Cumulative titles display:** distinct group titles as badges with an occurrence counter (×N) in the cumulative block; the per-session history keeps the title earned that night.
- **Realtime >1h (success criterion 5):** silent automatic approach — `supabase.realtime.setAuth(session.access_token)` on `TOKEN_REFRESHED` via `onAuthStateChange`. No user-facing reconnect prompt.
- Profile page is a client component fetching own rows (`SELECT ... WHERE user_id = auth.uid()` via RLS); redirect to `/` if not signed in (per UI-SPEC interaction contract).

### Deferred Ideas (OUT OF SCOPE)

- Question tag curation + archetype activation — v3.0 (REQ-AR-01/02/03)
- Google avatar on `/profile` — already deferred in REQUIREMENTS.md Out of Scope
- Pagination / "voir plus" beyond 20 sessions — revisit if real users hit the limit
- Per-theme stats breakdown on profile (enabled by the new `theme` column) — nice v3+ addition, not in scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-01 | At game end, each signed-in player's stats for that session are written to their account (designation count, confession reveals, volunteer count, group title earned) | upsert pattern with `onConflict: 'user_id,session_id', ignoreDuplicates: true`; stats sourced from `gs.stats[myId]` already computed in EndScreen |
| STAT-02 | Each session is stored as a separate history row (per-session records, not only cumulative counters) | `game_state.session_uuid` is reset by `startGame()` on every replay → new row guaranteed |
| STAT-03 | Stats writes are idempotent — a `UNIQUE(user_id, session_id)` constraint prevents duplicate entries on replay | Constraint already in schema.sql; upsert with `ignoreDuplicates: true` as client gate |
| PROF-01 | Signed-in user can view their stats history on a `/profile` page | New `app/profile/page.tsx` — client component, RLS scopes SELECT to own rows |
| PROF-02 | Anonymous users see a "sign in to save your stats" CTA on the end screen, shown after session stats are displayed | `SignInSaveCTA` card rendered when `!isSignedIn` — uses `?next=` OAuth pattern from join page |
</phase_requirements>

---

## Summary

Phase 5 is a write-then-read feature: at the end of a game session, each signed-in client upserts one row to `user_session_stats`, then a new `/profile` page reads all rows owned by that user. The table, RLS, and `UNIQUE(user_id, session_id)` constraint already exist from Phase 2. This phase adds three new columns (`theme`, `rounds_played`, `tag_scores`), wires the write to the `ended` phase of the game, and builds the profile page and end-screen CTA.

The most technically novel piece is success criterion 5 (>1h JWT resilience): the Supabase Realtime client does not automatically propagate token refreshes to its channels. The fix is to call `supabase.realtime.setAuth(session.access_token)` inside an `onAuthStateChange` listener on the `TOKEN_REFRESHED` event. This pattern is confirmed by the `RealtimeClient.ts` source code — the method signature is `async setAuth(token: string | null = null): Promise<void>`.

The profile page is a straightforward client component with three data-dependent sections: an archetype block (dormant until `tag_scores` is non-zero), a cumulative 2×2 stats grid, and a session history list (last 20 sessions, newest first). The end-screen CTA uses the `?next=` OAuth redirect pattern already established in `app/join/page.tsx`.

**Primary recommendation:** Wire the upsert in a `useEffect` that fires once when `gs.phase === 'ended'` and `user` is non-null, capture `tag_scores` as `{}` (zeroed, activates in v3.0), then gate the whole profile behind the existing RLS SELECT policy.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stats write at end screen | Browser / Client | Database | RLS forces each user to write their own row; no server action needed |
| Retroactive save after OAuth | Browser / Client | Database | Same write path, triggered by `onAuthStateChange` detecting `SIGNED_IN` + no existing row |
| JWT refresh → Realtime auth | Browser / Client | — | `supabase.realtime.setAuth()` called in client `onAuthStateChange` handler |
| `/profile` data fetch | Browser / Client | Database | RLS SELECT policy scopes rows to `auth.uid()` — pure client fetch, no API route |
| Auth guard on `/profile` | Browser / Client | — | `redirect('/')` after `supabase.auth.getUser()` check at component mount |
| DB schema migration | Database | — | `ALTER TABLE user_session_stats ADD COLUMN IF NOT EXISTS ...` in new migration file |
| i18n keys | Browser / Client | — | Additive to `lib/i18n.ts`; `Dict` type enforces all 4 locales |

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.107.0 (project) / 2.108.1 (latest) [VERIFIED: npm registry] | DB write, auth state, Realtime setAuth | Already the project's data layer |
| `@supabase/ssr` | 0.12.0 (project) [VERIFIED: npm registry] | `createBrowserClient` for cookie-based sessions | Already the project's session layer |
| Next.js | 16.2.7 [ASSUMED] | App Router `'use client'` component for `/profile` | Existing framework |
| React | 19.2.4 [ASSUMED] | `useEffect` for write trigger, `useState` for load states | Existing |

**No new packages to install.** All capabilities are covered by the existing stack.

### Installation

No installation step needed for this phase.

### Version verification

```bash
# Already verified:
npm view @supabase/supabase-js version   # → 2.108.1
npm view @supabase/ssr version           # → (installed in project)
```

---

## Package Legitimacy Audit

> Phase 5 installs no new packages. The audit covers packages already in the project.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@supabase/supabase-js` | npm | 5+ yrs | 19.5M/wk | github.com/supabase/supabase-js | SUS (latest patch too-new) | Approved — existing dependency, 5-year-old package, SUS flag is for the 2026-06-09 patch release only |
| `@supabase/ssr` | npm | 2+ yrs | 4.6M/wk | github.com/supabase/ssr | SUS (latest patch too-new) | Approved — existing dependency, same reasoning |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** both flagged for "too-new" on their latest patch — this is a false positive for established packages with >4M weekly downloads. Both are already installed in the project; no new install action required.

---

## Architecture Patterns

### System Architecture Diagram

```
[EndScreen mounts, phase === 'ended']
        │
        ▼
[getUser() → user present?]
        │ yes                    │ no
        ▼                        ▼
[upsert user_session_stats]  [render SignInSaveCTA]
  ↑ idempotent, UNIQUE           │
  ↑ RLS: auth.uid() = user_id   │ tap CTA
        │                        ▼
        │              [signInWithOAuth → Google]
        │                        │
        │                [/auth/callback?next=/room/{CODE}/game]
        │                        │
        │                [return to EndScreen, now signed in]
        │                        │
        │              [onAuthStateChange SIGNED_IN]
        │                        │
        │              [retroactive upsert (D-05)]
        │                        │
        └────────────────────────┘
                │
                ▼
["/profile" page] ← Link from landing top bar chip
        │
        ▼
[supabase.from('user_session_stats')
 .select('*')
 .order('played_at', { ascending: false })
 .limit(20)]    ← last 20 sessions
        │
        ▼
[Archetype block (tag_scores=0 → hidden)]
[Cumulative stats grid (all rows, no limit)]
[Session history list (20 rows)]
```

```
[Game page Realtime channels — >1h game]
        │
[onAuthStateChange → TOKEN_REFRESHED]
        │
[supabase.realtime.setAuth(session.access_token)]
        │
[All Realtime channels get fresh token silently]
```

### Recommended Project Structure

```
app/
├── profile/
│   └── page.tsx          # New: /profile page (client component)
├── room/[code]/game/
│   └── page.tsx          # Modified: EndScreen + write effect + SignInSaveCTA
├── page.tsx              # Modified: profile chip in top bar
lib/
├── i18n.ts               # Modified: profile.* + save_prompt.* namespaces (13 keys × 4 locales)
supabase/
├── migrations/
│   └── 005-stats-columns.sql  # New: ADD COLUMN theme, rounds_played, tag_scores
├── schema.sql            # Modified: mirror migration (idempotent ADD COLUMN IF NOT EXISTS)
```

### Pattern 1: Stats Write at End Screen (useEffect, idempotent upsert)

**What:** Single `useEffect` fires when `gs.phase === 'ended'` AND `user` is non-null. Performs an upsert with `ignoreDuplicates: true` so a replay or page refresh never double-writes.

**When to use:** Write-once semantics tied to a phase state transition.

**Example:**
```typescript
// Source: supabase.com/docs/reference/javascript/upsert
useEffect(() => {
  if (gs?.phase !== 'ended' || !user || !gs.session_uuid) return
  const totalRounds = gs.stats.rounds_a + gs.stats.rounds_b + gs.stats.rounds_c
  const titleKey = computeGroupTitle(gs.stats, theme, totalRounds)
  const myStats = {
    designated:  (gs.stats.designated  ?? {})[myId ?? ''] ?? 0,
    confessed:   (gs.stats.confessed   ?? {})[myId ?? ''] ?? 0,
    volunteered: (gs.stats.volunteered ?? {})[myId ?? ''] ?? 0,
  }

  supabase
    .from('user_session_stats')
    .upsert(
      {
        user_id:           user.id,
        session_id:        gs.session_uuid,  // UUID from game_state, set by startGame()
        designated_count:  myStats.designated,
        confessed_count:   myStats.confessed,
        volunteered_count: myStats.volunteered,
        group_title:       titleKey,
        theme:             theme,
        rounds_played:     totalRounds,
        tag_scores:        {},               // empty until v3.0 tags questions
      },
      { onConflict: 'user_id,session_id', ignoreDuplicates: true }
    )
    .then(({ error }) => {
      if (error) console.error('[stats write]', error)
      else setSaved(true)
    })
}, [gs?.phase, gs?.session_uuid, user?.id])
// Deliberately minimal deps — fires once when the ended phase lands
```

**Critical constraint:** The effect must use `gs?.session_uuid` as a dependency (alongside `gs?.phase`) to avoid stale closures. The `session_uuid` is set in `game_state` before the phase transitions to `ended`.

### Pattern 2: Retroactive Save after OAuth (CTA return detection)

**What:** After the anonymous→signed-in OAuth round-trip, the client lands back on the end screen. An `onAuthStateChange` listener detects `SIGNED_IN` and triggers the same upsert if no row exists yet.

**When to use:** Post-OAuth conversion flow.

**Example:**
```typescript
// In the EndScreen useEffect (or parent component useEffect)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        // SC-5: keep Realtime channels alive after JWT expiry
        supabase.realtime.setAuth(session.access_token)
      }
      if (event === 'SIGNED_IN' && session?.user && gs?.phase === 'ended') {
        // D-05: retroactive save after CTA sign-in
        // The upsert's ignoreDuplicates:true prevents double-write
        // if the user was already signed in and the effect already ran.
        triggerStatsWrite(session.user)
      }
    }
  )
  return () => subscription.unsubscribe()
}, [gs?.phase, gs?.session_uuid])
```

### Pattern 3: Realtime JWT Refresh (TOKEN_REFRESHED handler)

**What:** Wire `supabase.realtime.setAuth(token)` to the `TOKEN_REFRESHED` event in `onAuthStateChange`. This covers games lasting >1 hour where the JWT expires (default 1h).

**When to use:** Any page that holds open Realtime channels for authenticated users.

**Example:**
```typescript
// Source: github.com/supabase/realtime-js (RealtimeClient.ts)
// Method signature: async setAuth(token: string | null = null): Promise<void>
// Call from onAuthStateChange listener — already present in game page
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED' && session?.access_token) {
    await supabase.realtime.setAuth(session.access_token)
  }
})
```

**Important:** The game page already has an `onAuthStateChange` subscription in the join page. For Phase 5, an additional subscription is needed in the game page root component so it covers the >1h case. The game page does NOT currently call `supabase.auth.getUser()` or set up `onAuthStateChange` — this must be added.

### Pattern 4: Profile Page Fetch (RLS-scoped SELECT)

**What:** Client component fetches all rows for the current user. RLS policy `stats_select_own` (`auth.uid() = user_id`) scopes the result automatically — no manual WHERE clause needed, but adding it is defensive.

**When to use:** Any page rendering user-owned data from Supabase.

**Example:**
```typescript
'use client'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// Auth guard: call getUser() at mount; redirect if null
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) { router.push('/'); return }
    setUser(data.user)
    fetchStats(data.user)
  })
}, [])

async function fetchStats(user: User) {
  // Cumulative: no limit — all rows for total counts
  const { data: allRows } = await supabase
    .from('user_session_stats')
    .select('designated_count, confessed_count, volunteered_count, group_title, tag_scores')
    .order('played_at', { ascending: false })
  
  // History display: last 20 sessions
  const { data: historyRows, error } = await supabase
    .from('user_session_stats')
    .select('*')
    .order('played_at', { ascending: false })
    .limit(20)

  if (error) { setLoadError(true); return }
  setAllRows(allRows ?? [])
  setHistory(historyRows ?? [])
}
```

**Alternative:** Single query with `.limit(20)` for display, plus a separate aggregate query (or client-side aggregation over the 20 rows if the user has ≤20 sessions). For most users (few sessions), computing cumulative totals from all fetched rows client-side is acceptable.

### Pattern 5: Retroactive `user_id` on `players` Row (Account Linking)

**What:** When an anonymous player signs in via the end-screen CTA and returns to their session, also update their `players` row with `user_id`. This enables IDEN-02 reconnect for that room.

**When to use:** Post-CTA sign-in, once we have both `user.id` and `myId` (the player id).

**Example:**
```typescript
// After successful retroactive stats write, if the room is still alive:
const pid = getPlayerId(code)
if (pid) {
  await supabase
    .from('players')
    .update({ user_id: user.id })
    .eq('id', pid)
    // Silent failure: if room died during OAuth, this is a no-op
}
```

### Anti-Patterns to Avoid

- **Writing on unmount / page close:** The game page state is cleaned up on unmount. Writing stats in a cleanup function or `beforeunload` handler is unreliable — the write must happen on mount of the `ended` phase, not on unmount.
- **Checking for existing row before upsert:** A `SELECT` then conditional `INSERT` pattern creates a race condition (two tabs). Use `upsert` with `ignoreDuplicates: true` as the atomic operation.
- **Using `gs.stats` inside an async callback without capturing it:** The `gs` reference in a closure may be stale by the time the async resolves. Capture `gs.stats` and `gs.session_uuid` synchronously at effect run time.
- **Redirecting to raw page URL from OAuth `redirectTo`:** PKCE returns `?code=<uuid>` which collides with `?code=<room>` (documented gotcha in CLAUDE.md). Always use `/auth/callback?next=<path>`.
- **Calling `supabase.auth.getUser()` in a render function or conditional effect:** The existing pattern (`getUser()` once on mount + `onAuthStateChange`) is the established project pattern; don't create parallel auth state.
- **Adding `user_session_stats` to supabase_realtime publication:** STATE.md explicitly records this decision: stats are NOT realtime; they are fetched via query.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent insert | Custom SELECT + INSERT + duplicate check | `upsert({ onConflict, ignoreDuplicates: true })` | Race condition between check and insert; DB handles it atomically |
| JWT expiry for Realtime | Custom timer + reconnect logic | `supabase.realtime.setAuth(token)` in `TOKEN_REFRESHED` handler | Library handles channel updates; manual reconnect would lose presence state |
| Auth guard on profile | Middleware rule or custom hook | `supabase.auth.getUser()` at mount + `router.push('/')` | Matches existing pattern; server components can use `redirect()` |
| Cumulative stats aggregation | Database view or stored procedure | Client-side `reduce()` over fetched rows | RLS already scopes rows to the current user; all rows fit in a single fetch |

**Key insight:** The `upsert` API with `ignoreDuplicates: true` is the single most important pattern here. It makes the write idempotent without any custom logic, covering: page refresh on end screen, replay (new `session_uuid` = new row), and post-OAuth retroactive save.

---

## Common Pitfalls

### Pitfall 1: Write Fires After "Rejouer" Navigation

**What goes wrong:** The `ended` phase useEffect writes stats. Then the host clicks "Rejouer" — this sets `game_state` to a new session (new `session_uuid`, `phase: 'voting_question'`). If the effect's deps include only `gs.phase`, it fires again on the new game's `ended` phase and overwrites nothing (idempotent). BUT if the effect captures the PREVIOUS `session_uuid` in a closure, it writes a row with the wrong `session_uuid`.

**Why it happens:** React stale closure — the effect captures `gs.session_uuid` at the time the effect was registered, not when it runs.

**How to avoid:** Include `gs.session_uuid` in the effect deps array, AND read `gs.session_uuid` inside the effect body (not from a captured closure).

**Warning signs:** Two rows in `user_session_stats` with the same data but different `session_id`s, or the row being written after "Rejouer" contains the stats of the PREVIOUS game.

---

### Pitfall 2: Anonymous Client Attempts Write (RLS Block)

**What goes wrong:** If the `isSignedIn` gate is based on a stale auth state (e.g., the user signed out mid-game but the component hasn't re-rendered), the upsert runs as an anonymous client and is silently rejected by the `stats_insert_own` RLS policy (no error surfaced because the policy check returns 0 rows, not a PostgREST error on insert).

**Why it happens:** RLS INSERT policies with `WITH CHECK (auth.uid() = user_id)` — if `auth.uid()` is null (anon) and `user_id` is a real UUID, the check fails and the insert is rejected without a 4xx error in some configurations.

**How to avoid:** Gate the upsert on `user?.id` being non-null (from `supabase.auth.getUser()` at mount, not from a cached/stale state). Check `if (!user?.id || !gs?.session_uuid) return`.

**Warning signs:** Upsert returns `{ data: null, error: null }` for anonymous clients — check the `data` response, not just `error`.

---

### Pitfall 3: Retroactive Save Fails Silently When Room Is Dead

**What goes wrong:** The anonymous player takes >30 min to sign in (OAuth, coffee, etc.). The room TTL (60s per pg_cron sweep) has already deleted the room and cascade-deleted the `votes` rows. The retroactive save relies on `gs.stats` still being in React state — it doesn't need `votes` rows for the stats we're saving (designation_count, confessed_count, volunteered_count, group_title are already computed in `gs.stats`).

**Why it happens:** The retroactive save uses `gs.stats[myId]` from the React state, NOT a fresh `fetchVotes` call. So the save itself works fine even after room deletion.

**How to avoid:** Use `gs.stats` (already in memory) for the retroactive upsert. The optional `user_id` update on the `players` row (IDEN-02 linking) is the part that will fail silently when the room is dead — handle this with a silent `console.warn`, not an error.

**Warning signs:** If `supabase.from('players').update(...)` returns an error with code `PGRST116` (row not found), the room is dead. This is acceptable and should be swallowed silently.

---

### Pitfall 4: Migration Breaks Existing user_session_stats Rows

**What goes wrong:** `ALTER TABLE user_session_stats ADD COLUMN theme text` fails if it doesn't use `IF NOT EXISTS`, or if executed twice (e.g., running `schema.sql` on a DB where the migration was already applied).

**Why it happens:** PostgreSQL's `ADD COLUMN` is not idempotent by default.

**How to avoid:** Use `ADD COLUMN IF NOT EXISTS` in both the migration file and `schema.sql`. Both `theme` and `rounds_played` columns should be nullable with no DEFAULT constraint on existing rows (they'll be NULL for pre-Phase-5 records — profile page handles NULL gracefully by showing "—" or omitting the chip).

**Warning signs:** Migration runs fine but `schema.sql` re-execution fails on the second `ADD COLUMN`.

---

### Pitfall 5: Realtime setAuth Called Before Channels Are Subscribed

**What goes wrong:** If `supabase.realtime.setAuth(token)` is called in an `onAuthStateChange` handler that fires at mount (the `INITIAL_SESSION` event), before the game page has set up its Realtime channels, the token update has no channels to propagate to.

**Why it happens:** `onAuthStateChange` fires `INITIAL_SESSION` very early in the component lifecycle.

**How to avoid:** Only act on `TOKEN_REFRESHED` (not `INITIAL_SESSION` or `SIGNED_IN`) for the Realtime setAuth call. The initial channel subscription already uses the current token at subscribe time.

**Warning signs:** Channels connect fine but drop after ~1h with `Invalid token` errors despite the handler being present — check that the handler only calls `setAuth` on `TOKEN_REFRESHED`.

---

### Pitfall 6: RLS Silent Lockout After Migration (AUTH-04 Regression)

**What goes wrong:** Running any SQL that touches the `user_session_stats` RLS policies (even as a re-run of `schema.sql`) could accidentally drop/recreate policies. If a DROP + CREATE is interrupted, or if `DROP POLICY IF EXISTS` removes a policy for `rooms` or `players` instead of `user_session_stats`, anonymous players lose SELECT access and "Room introuvable" reappears.

**Why it happens:** `schema.sql` uses `DROP POLICY IF EXISTS` followed by `CREATE POLICY` — safe for `user_session_stats` but the migration file only touches that table. Running `schema.sql` re-declares ALL policies.

**How to avoid:** After every DB migration, run the anonymous game smoke test (AUTH-04 regression check): create a room anonymously, join, play through Type A/B/C, reach end screen.

**Warning signs:** `[join] lookup:` console log returns 0 rows for a room that was just created.

---

## Runtime State Inventory

This phase is not a rename/refactor/migration. Omitted per spec.

---

## Code Examples

### Full upsert call for user_session_stats

```typescript
// Source: supabase.com/docs/reference/javascript/upsert (confirmed API)
const { error } = await supabase
  .from('user_session_stats')
  .upsert(
    {
      user_id:           user.id,                    // from supabase.auth.getUser()
      session_id:        gs.session_uuid,            // UUID in game_state, set by startGame()
      designated_count:  myStats.designated,
      confessed_count:   myStats.confessed,
      volunteered_count: myStats.volunteered,
      group_title:       titleKey,                   // from computeGroupTitle()
      theme:             room.theme,                 // new column
      rounds_played:     totalRounds,                // new column
      tag_scores:        {},                         // new column, dormant (D-08)
    },
    {
      onConflict: 'user_id,session_id',             // matches UNIQUE constraint name
      ignoreDuplicates: true,                        // ON CONFLICT DO NOTHING
    }
  )
if (error) console.error('[stats write]', error)
```

### setAuth call in TOKEN_REFRESHED handler

```typescript
// Source: github.com/supabase/realtime-js blob/master/src/RealtimeClient.ts
// Method: async setAuth(token: string | null = null): Promise<void>
// [ASSUMED: method confirmed from source inspection, not from official tutorial]
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    if (event === 'TOKEN_REFRESHED' && session?.access_token) {
      // Propagate refreshed JWT to all open Realtime channels.
      // Without this, channels lose auth after the 1h JWT TTL.
      await supabase.realtime.setAuth(session.access_token)
    }
  }
)
// Clean up in useEffect return
return () => subscription.unsubscribe()
```

### Migration SQL pattern (idempotent)

```sql
-- supabase/migrations/005-stats-columns.sql
-- Add columns for Phase 5: theme, rounds_played, tag_scores
-- Safe to run on a live prod DB (additive, nullable, no data migration needed).
ALTER TABLE user_session_stats
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS rounds_played int,
  ADD COLUMN IF NOT EXISTS tag_scores jsonb;
```

### Profile fetch — single query pattern

```typescript
// One query, used for both cumulative and history (client aggregates cumulative from all rows,
// history is the first 20). Acceptable because user rows are few.
const { data, error } = await supabase
  .from('user_session_stats')
  .select('*')
  .order('played_at', { ascending: false })

// Cumulative totals (all rows, no limit applied before this reduce):
const allRows = data ?? []
const cumulative = allRows.reduce(
  (acc, r) => ({
    sessions: acc.sessions + 1,
    designated: acc.designated + r.designated_count,
    confessed: acc.confessed + r.confessed_count,
    volunteered: acc.volunteered + r.volunteered_count,
  }),
  { sessions: 0, designated: 0, confessed: 0, volunteered: 0 }
)
// History (first 20 for display):
const history = allRows.slice(0, 20)
```

### End-screen CTA sign-in (correct redirectTo)

```typescript
// Pattern from app/join/page.tsx handleSignIn — DO NOT use window.location.href directly
async function handleCTASignIn() {
  const code = params.code  // room code from useParams
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/room/${code}/game`)}`,
    },
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Realtime channels lose auth after JWT expiry | `supabase.realtime.setAuth(token)` on TOKEN_REFRESHED | Ongoing gap (as of 2026) | Must add explicit handler; no auto-refresh |
| Upsert with manual SELECT+INSERT logic | `upsert({ onConflict, ignoreDuplicates: true })` | supabase-js v2 | Single atomic operation, no race condition |
| Profile page as server component with cookies | Profile page as client component (matches project pattern) | Project decision | Consistent with all existing pages — `'use client'` + `getUser()` on mount |

**Deprecated/outdated:**
- `supabase.auth.setAuth()` (v1 API): renamed/removed in v2. Not applicable — the project uses v2.
- `sessionStorage` for player identity: replaced by localStorage in Phase 3. Do NOT use for any new state in Phase 5.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.realtime.setAuth(token)` accepts the `access_token` string from `session.access_token` and propagates it to all open channels | Code Examples, Pitfall 5 | The >1h JWT refresh (SC-5) silently fails; channels drop auth |
| A2 | The `onConflict` value `'user_id,session_id'` in the JavaScript upsert call matches the DB constraint `user_session_stats_unique UNIQUE (user_id, session_id)` | Code Examples | Upsert falls through to update instead of no-op, or throws error |
| A3 | `gs.session_uuid` in React state at the `ended` phase equals the UUID that was written to the DB `game_state.session_uuid` — i.e., it has not been reset to `''` (the factory default) before the write | Pitfall 1 | Stats row written with `session_id = ''`, violates NOT NULL or FK, or creates wrong row |
| A4 | Calling `setAuth()` without needing to unsubscribe/resubscribe channels — the method updates the token in-place without reconnecting | Pattern 3 | Channels may need to be recreated, which would require tracking all channel refs |

**A1 is the most critical assumption.** It is confirmed by the `RealtimeClient.ts` source code inspection (the `setAuth` method exists and calls `_performAuth` which updates all channels), and by the GitHub Discussion #37002 which explicitly names `supabase.realtime.setAuth('fresh-token')` as the correct workaround. [ASSUMED: verified by source code inspection, not by official Supabase docs tutorial]

**A3 note:** `makeInitialGameState()` sets `session_uuid: ''`. `startGame()` in the lobby page overwrites it with `crypto.randomUUID()` before writing to DB. By the time `phase === 'ended'`, the `session_uuid` in React state reflects the DB value. The concern is only if the write effect captures the initial `''` from the factory state — which is prevented by including `gs.session_uuid` in effect deps and checking `if (!gs.session_uuid) return`.

---

## Open Questions

1. **Does `supabase.realtime.setAuth()` without an argument work via the `accessToken` callback?**
   - What we know: The method signature is `async setAuth(token: string | null = null): Promise<void>`. When `token` is null, it falls back to the `accessToken` callback if one was configured.
   - What's unclear: The project's `createBrowserClient` from `@supabase/ssr` may configure an `accessToken` callback automatically (cookies-based session). If so, `supabase.realtime.setAuth()` (no args) might work.
   - Recommendation: Use `supabase.realtime.setAuth(session.access_token)` explicitly on `TOKEN_REFRESHED` — the token is available in the event payload and this avoids any ambiguity about whether the callback is configured.

2. **Should the profile page be server component + client component split, or fully client?**
   - What we know: All existing pages are `'use client'`. A server component could `redirect()` more reliably and avoid the auth flash.
   - What's unclear: The project pattern is all-client. A server component would require `createServerClient` from `@supabase/ssr`, which is only used in `app/auth/callback/route.ts` and `middleware.ts` currently.
   - Recommendation: Stay all-client per project pattern (D-41 in 05-CONTEXT). Auth guard with `getUser()` + `router.push('/')`. The flash is acceptable for MVP.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build | Yes | v22.11.0 | — |
| npm | build | Yes | 11.4.1 | — |
| Supabase project | data layer | Yes (prod: dmxjspnrrgcixzcthgwf) | — | — |
| `user_session_stats` table + RLS | stats write | Yes (Phase 2) | — | — |
| `user_session_stats` new columns | D-06 | No (pending migration) | — | Migration + schema.sql update |

**Missing dependencies with no fallback:** none (all exist or are created in this phase).

**Missing dependencies with fallback:** `theme`, `rounds_played`, `tag_scores` columns — created by the Phase 5 migration (005-stats-columns.sql). The migration must be applied to prod before deploying the app code that writes these columns.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework installed in project |
| Config file | none |
| Quick run command | `npm run build` (type check + build only) |
| Full suite command | `npm run build && npm run lint` |

**No automated test framework (jest/vitest/playwright) is installed.** The project has only `npm run build` and `npm run lint` in package.json scripts. All "tests" for this phase are manual smoke tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-01 | Stats written to user_session_stats at end screen for signed-in user | manual | — | — |
| STAT-02 | Replaying creates a new row (different session_uuid) | manual | — | — |
| STAT-03 | Refreshing the end screen does not duplicate the row | manual | — | — |
| PROF-01 | /profile page renders session history for signed-in user | manual | — | — |
| PROF-02 | Anonymous user sees sign-in CTA on end screen; signed-in user sees none | manual | — | — |
| SC-5 | >1h game keeps Realtime channels alive | manual (long-running) | — | — |
| SC-6 | tag_scores column exists in user_session_stats | `npm run build` (TypeScript type check) | ❌ requires migration |

### Sampling Rate

- **Per task commit:** `npm run build` — catches TypeScript errors in i18n Dict completeness, type mismatches
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Manual smoke test: (a) anonymous game → end screen → CTA → sign in → return → confirm stats row in Supabase dashboard; (b) /profile page shows history; (c) replay → confirm new row not duplicate

### Wave 0 Gaps

- [ ] No test framework — manual testing is the only validation path for behavioral requirements
- [ ] Auth-04 regression smoke test must be run manually after migration (anonymous game full flow)

*(No test files to create — the project has no test infrastructure. Build acts as the type-safety gate.)*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` — authoritative server validation (not `getSession()`) |
| V3 Session Management | yes | `@supabase/ssr` cookie-based sessions + token refresh via `onAuthStateChange` |
| V4 Access Control | yes | RLS `stats_select_own` / `stats_insert_own`: `auth.uid() = user_id` — users can only read/write their own rows |
| V5 Input Validation | low | No user-submitted data written to `user_session_stats` — all values computed from game state |
| V6 Cryptography | no | No new crypto operations; session tokens handled by Supabase Auth |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Player writes stats for another player | Tampering | RLS `stats_insert_own` blocks inserts where `user_id != auth.uid()` |
| Inflate own stats (client-side game_state manipulation) | Tampering | Low risk for MVP (no rewards tied to stats); RLS enforces own-row-only write |
| Unauthenticated access to /profile | Elevation of Privilege | `getUser()` + `router.push('/')` client-side guard; RLS SELECT policy is a second layer |
| OAuth redirect pollution (`?next=` param) | Spoofing | `/auth/callback` already validates `next` starts with `/` and not `//` (same-origin check) |
| Stats row deletion | Tampering | No DELETE RLS policy exists on `user_session_stats` (per STATE.md decision) — rows are append-only |

---

## Sources

### Primary (MEDIUM confidence)
- supabase.com/docs/reference/javascript/upsert — confirmed `.upsert()` API with `onConflict` and `ignoreDuplicates` params
- supabase.com/docs/reference/javascript/auth-onauthstatechange — confirmed `TOKEN_REFRESHED` event exists
- github.com/supabase/realtime-js blob/master/src/RealtimeClient.ts — confirmed `setAuth(token: string | null)` method signature

### Secondary (LOW confidence)
- github.com/orgs/supabase/discussions/37002 — confirms `supabase.realtime.setAuth('fresh-token')` as the manual workaround; flagged as a limitation not an official feature
- github.com/supabase/realtime-js/issues/274 — confirms Realtime channels do not auto-refresh JWT; manual intervention required

### Tertiary (LOW confidence — training knowledge / project inspection)
- `supabase/schema.sql` lines 67-78 — existing `user_session_stats` table structure, UNIQUE constraint, RLS policies
- `supabase/migrations/002-auth.sql` — migration file convention to follow for new columns
- `app/join/page.tsx` handleSignIn — the canonical `?next=` OAuth pattern to replicate in end-screen CTA
- `app/room/[code]/game/page.tsx` EndScreen — existing personal stats computation; source of `gs.stats[myId]` pattern
- `lib/game.ts` — `computeGroupTitle` and `accumulateStats` already compute all values needed for the write
- `.planning/STATE.md` — `user_session_stats NOT added to supabase_realtime publication` (explicit decision)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing stack fully capable
- upsert API: MEDIUM — confirmed from official docs
- setAuth API: LOW — confirmed from source code inspection, not official tutorial
- Architecture patterns: HIGH — all follow established project conventions

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable APIs; setAuth pattern may get official doc coverage sooner)
