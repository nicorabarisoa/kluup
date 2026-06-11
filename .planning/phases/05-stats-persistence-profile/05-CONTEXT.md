# Phase 5: Stats Persistence + Profile - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

At game end, each signed-in player's session stats are persisted to `user_session_stats` (table already exists from Phase 2: `designated_count`, `confessed_count`, `volunteered_count`, `group_title`, `played_at`, `UNIQUE(user_id, session_id)`). A new `/profile` page shows cumulative stats, per-session history, group titles earned, and a global archetype block (dormant in v2.0). Anonymous players see a "sign in to save your stats" CTA on the end screen, with retroactive save of the just-played session after OAuth.

**In scope:** stats write at end screen, `tag_scores` + `theme` + `rounds_played` columns, `/profile` page, end-screen CTA + retroactive save, profile entry point (landing chip), Realtime JWT-expiry resilience for >1h games.

**Out of scope:** question tag curation and archetype activation (v3.0, REQ-AR-01/02), premium gating, avatar sync, RLS hardening beyond `user_session_stats`.

</domain>

<decisions>
## Implementation Decisions

### Stats Write (timing & edge cases)
- **D-01:** Each signed-in client writes **its own row** when it reaches the end screen (`ended` phase). Forced by RLS: `user_session_stats` INSERT policy is `auth.uid() = user_id` — the host cannot write for others. Idempotent via `UNIQUE(user_id, session_id)` (upsert with `onConflict` ignore, or insert + tolerate 23505).
- **D-02:** Signed-in player who quits (or closes tab) before the end screen → **stats lost** for that session. No write-on-quit. Free nuance: if they come back to the end screen before the room dies (TTL 30 min), the standard write path runs normally.
- **D-03:** Host ends the game early via "Terminer la session" → **stats are saved anyway**. Same end screen, same code path. A played session is a played session — no minimum-rounds rule.

### End-Screen CTA + Retroactive Save
- **D-04:** Anonymous player taps "Se connecter" on the end screen → OAuth round-trip with `next=/room/{CODE}/game` (uses the `?next=` mechanism added to `/auth/callback` on 2026-06-12, which superseded Phase 4's D-04 "always redirect to /"). They land back on the end screen.
- **D-05:** On return: the client detects "signed in + game ended + no row yet for (user, session)" and **retroactively saves the session they just played**. The CTA's promise ("save YOUR stats") is honored at the hottest conversion moment. Stats are computed from their `player_id` votes, still in DB while the room lives.

### Per-Session Data
- **D-06:** Add columns to `user_session_stats`: `theme text` and `rounds_played int` (plus `tag_scores jsonb` per REQ-AR-07). Migration file + `supabase/schema.sql` updated idempotently (Phase 2 convention).
- **D-07:** History shows the **last 20 sessions** (no pagination UI). Cumulative block reflects ALL history regardless of the display limit.

### Archetype Block (v2.0 dormant)
- **D-08:** Ship the `tag_scores jsonb` column, the accumulation logic, and the profile archetype display — but the block is **hidden while total score = 0**. No teaser, no empty promise. When v3.0 tags the questions, the block lights up without redeploy.

### Claude's Discretion
- **Write feedback:** discreet "Stats sauvegardées ✓" line under the personal stats on the end screen (i18n key, signed-in users only). On write failure: silent (console.error) — stats never block the party, no retry UI. The idempotent write naturally retries on refresh.
- **Account↔player linking on CTA return:** after retroactive sign-in, also set `user_id` on the player's `players` row (enables IDEN-02 for that room). If the room died before the OAuth return → abort silently, the CTA save is lost.
- **Cumulative titles display:** distinct group titles as badges with an occurrence counter (×N) in the cumulative block; the per-session history keeps the title earned that night.
- **Realtime >1h (success criterion 5):** silent automatic approach — researcher picks the precise mechanism (e.g. `supabase.realtime.setAuth()` on token refresh via `onAuthStateChange`). No user-facing reconnect prompt.
- Profile page is a client component fetching own rows (`SELECT ... WHERE user_id = auth.uid()` via RLS); redirect to `/` if not signed in (per UI-SPEC interaction contract).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Contract (locked)
- `.planning/phases/05-stats-persistence-profile/05-UI-SPEC.md` — approved UI contract: profile layout (`max-w-md`), name-chip→`/profile` entry, display-only history rows, archetype block hidden at 0, 13 i18n keys in `profile.*`/`save_prompt.*`, end-screen CTA placement. A-01/02/03 are user-confirmed locked decisions.

### DB Schema
- `supabase/schema.sql` — source of truth, idempotent; `user_session_stats` already created (lines ~67-78); new columns must land in BOTH a migration file and schema.sql (Phase 2 convention)
- `supabase/migrations/002-auth.sql` — migration file pattern to follow for the Phase 5 migration
- `CLAUDE.md` §"Modèle de données (Supabase)" — RLS posture; `user_session_stats` RLS is `auth.uid() = user_id` (select/insert/update)

### Prior Phase Decisions
- `.planning/phases/02-auth-infrastructure-schema/02-CONTEXT.md` — D-01: `session_uuid` in `game_state` (written by `startGame` via `crypto.randomUUID()`) is THE `session_id` for stats rows
- `.planning/phases/04-signin-ux-player-linking/04-CONTEXT.md` — D-09: pseudo = game identity, account = stats identity (independent); D-04 (post-OAuth always `/`) is SUPERSEDED by the `?next=` param (2026-06-12)

### OAuth Round-Trip (just fixed)
- `app/auth/callback/route.ts` — `?next=<path>` support (same-origin only); the end-screen CTA must use `redirectTo: {origin}/auth/callback?next=/room/{CODE}/game`
- `app/join/page.tsx` `handleSignIn()` — reference implementation of the next-param sign-in pattern; NEVER `redirectTo` a raw page URL (PKCE `?code=` collision — see CLAUDE.md gotcha "OAuth redirectTo")

### Game Engine / End Screen
- `app/room/[code]/game/page.tsx` — `ended` phase / EndScreen: where the stats write, the "✓ saved" line, and the CTA live; `onEndGame` (early end) leads here too (D-03)
- `lib/game.ts` — `accumulateStats` / `computeGroupTitle`: existing client-side stats computation the write reuses; `fetchVotes` for per-player retroactive computation

### Requirements
- `.planning/REQUIREMENTS.md` §Stats Persistence (STAT-01/02/03) + §Stats Profile (PROF-01/02) + REQ-AR-07 (tag_scores hook)
- `.planning/ROADMAP.md` §Phase 5 — 6 success criteria are the acceptance targets

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `user_session_stats` table + RLS — already provisioned (Phase 2), only needs 3 new columns (`theme`, `rounds_played`, `tag_scores`)
- `game_state.session_uuid` — already generated per game by `startGame`; reset on replay so each replay = new history row (STAT-02 free)
- `lib/game.ts` `accumulateStats`/`computeGroupTitle` — the end screen already computes everything the write needs
- `app/join/page.tsx` `handleSignIn` — copy the `?next=` OAuth pattern for the end-screen CTA
- Landing auth chip (`app/page.tsx`) — becomes the `/profile` entry per UI-SPEC A-02

### Established Patterns
- All pages `'use client'`; auth state via `supabase.auth.getUser()` + `onAuthStateChange` (join page pattern, WR-01)
- Zero hardcoded text — `Dict` type forces all 4 locales (fr/en/es/de)
- Every migration mirrored into idempotent `schema.sql`
- "RLS silent lockout" warning (Phase 2): run the full anonymous game regression after ANY migration touching RLS/schema

### Integration Points
- EndScreen (`ended` phase in game/page.tsx): stats write effect + "✓ saved" line + CTA card (UI-SPEC Surface A)
- `app/profile/page.tsx` (new): UI-SPEC Surface B
- `app/page.tsx` top bar: chip → Link `/profile`
- `lib/i18n.ts`: `profile.*` + `save_prompt.*` namespaces (13 keys × 4 locales per UI-SPEC)

### Potential Pitfalls
- Replay resets `game_state` (incl. `session_uuid`) — the write must capture stats BEFORE the host triggers "Rejouer" navigates everyone back to lobby (write on `ended` mount, not on unmount)
- Retroactive save needs the room + votes rows still alive — TTL 30 min covers a normal OAuth round-trip; handle the dead-room case silently
- `user_session_stats` has no anon policies — anonymous clients must never attempt the write (gate on `user` presence, not on try/catch)
- JWT expiry (1h default) kills Realtime auth for signed-in players — wire `supabase.realtime.setAuth` on `TOKEN_REFRESHED` (researcher confirms exact API)

</code_context>

<specifics>
## Specific Ideas

- History row reads like "Unmasked · 7 manches · 12 juin" (theme + rounds_played + date) — theme name via existing localized theme keys
- "Stats sauvegardées ✓" must feel like a receipt, not a feature — one muted line, no toast

</specifics>

<deferred>
## Deferred Ideas

- Question tag curation + archetype activation — v3.0 (REQ-AR-01/02/03)
- Google avatar on `/profile` — already deferred in REQUIREMENTS.md Out of Scope
- Pagination / "voir plus" beyond 20 sessions — revisit if real users hit the limit
- Per-theme stats breakdown on profile (enabled by the new `theme` column) — nice v3+ addition, not in scope

</deferred>

---

*Phase: 05-stats-persistence-profile*
*Context gathered: 2026-06-12*
