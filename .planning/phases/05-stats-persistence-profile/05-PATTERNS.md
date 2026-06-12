# Phase 5: Stats Persistence + Profile - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 5 (3 modified, 2 created)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `supabase/migrations/005-stats-columns.sql` | new | migration | DDL / batch | `supabase/migrations/002-auth.sql` | exact (additive ALTER) |
| `supabase/schema.sql` | mod | config (DB source of truth) | DDL / batch | self (lines 67-78 + 141-155) | exact |
| `app/profile/page.tsx` | new | page (client component) | request-response (RLS read) | `app/join/page.tsx` (auth+fetch) / `EndScreen` (stat-chip render) | role+flow match |
| `app/room/[code]/game/page.tsx` | mod | page (write effect + CTA inside `EndScreen`) | event-driven write + request-response | self (`EndScreen` l.1302+) / `app/join/page.tsx` (`handleSignIn`) | exact (in-place) |
| `lib/i18n.ts` | mod | config (i18n dictionaries) | static | self (existing `end`/`archetypes`/`auth` namespaces) | exact |
| `app/page.tsx` | mod | page (landing top-bar chip) | navigation | self (top bar l.156-184) | exact |

> Note: per UI-SPEC Component Inventory, `SignInSaveCTA`, `ArchetypeBlock`, `CumulativeStatsGrid`, `SessionHistoryList`, `SessionRow` are all **inline** components (no shared `components/` folder — established project convention).

---

## Pattern Assignments

### `supabase/migrations/005-stats-columns.sql` (migration, additive)

**Analog:** `supabase/migrations/002-auth.sql`

**Pattern — additive idempotent ALTER** (002-auth.sql lines 1-11): header comment block stating "additive-only, safe on live prod, existing rows unaffected (NULL default)", then `ADD COLUMN IF NOT EXISTS`. The new file does ONLY the three columns (D-06), touches no policy (avoids the Pitfall 6 RLS regression):
```sql
-- supabase/migrations/005-stats-columns.sql
-- Additive-only migration. Safe to run on a live prod DB.
-- Existing rows unaffected: new columns default to NULL.
-- Does NOT touch any RLS policy (avoids the user_session_stats lockout regression).
ALTER TABLE user_session_stats
  ADD COLUMN IF NOT EXISTS theme         text,
  ADD COLUMN IF NOT EXISTS rounds_played int,
  ADD COLUMN IF NOT EXISTS tag_scores    jsonb;
```
Columns are **nullable, no DEFAULT** (pre-Phase-5 rows stay NULL; profile renders "—" / omits chip — Pitfall 4).

---

### `supabase/schema.sql` (DB source of truth)

**Analog:** self — `user_session_stats` block at lines 68-78.

**Pattern — mirror the migration into the canonical CREATE TABLE block.** Phase 2 convention (CLAUDE.md): every migration is mirrored idempotently into `schema.sql`. Add the three columns inside the existing `CREATE TABLE IF NOT EXISTS user_session_stats (...)` (lines 68-78) AND add a matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` after it (so re-running on an old DB that already has the table picks up the columns — `CREATE TABLE IF NOT EXISTS` is a no-op on an existing table, per the CLAUDE.md `host_id NOT NULL` gotcha).

Do NOT touch the RLS policy block (lines 141-155) — it is already correct (`stats_select_own` / `stats_insert_own` / `stats_update_own` = `auth.uid() = user_id`).

---

### `app/profile/page.tsx` (new page, client component, RLS-scoped read)

**Analogs:** `app/join/page.tsx` (auth state + guard + fetch), `EndScreen` in `game/page.tsx` (stat-chip render + token block `C`).

**Imports pattern** (from `app/join/page.tsx` lines 1-8):
```typescript
'use client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useT, LangSwitch } from '@/lib/locale'
import { getGoogleFirstName } from '@/lib/utils'
```

**Auth state + guard** (copy `app/join/page.tsx` lines 49-63; add the `router.push('/')` guard per D-41 / UI-SPEC interaction contract — stay all-client, do NOT introduce a server component / `createServerClient`):
```typescript
const [user, setUser] = useState<User | null>(null)
const [authLoading, setAuthLoading] = useState(true)
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) { router.push('/'); return }   // auth guard (UI-SPEC Surface B)
    setUser(data.user)
    setAuthLoading(false)
    fetchStats(data.user)
  })
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
    setUser(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}, [])
```

**RLS-scoped fetch** (RESEARCH Pattern 4 / Code Examples — single query, client-aggregate cumulative, slice 20 for history; D-07):
```typescript
const { data, error } = await supabase
  .from('user_session_stats')
  .select('*')
  .order('played_at', { ascending: false })
// RLS stats_select_own already scopes to auth.uid() — no manual WHERE needed.
const allRows = data ?? []                 // cumulative = ALL rows
const history = allRows.slice(0, 20)       // display = last 20
```

**Stat-chip render** — copy verbatim from `EndScreen` (`game/page.tsx` lines 1432-1447): the `SessionRow` stat chips reuse the EXACT badge style (`text-xs px-2 py-0.5 rounded-full`, `${C.a}22`/`${C.b}22`/`${C.c}22` bg, only shown if `> 0`, `fr.end.stat_designated/confessed/volunteered` keys).

**`C` design-token block** — copy the `const C = {...}` from the top of `game/page.tsx` (UI-SPEC Color section confirms it is the canonical token reference: `bg #0D0D0D`, `surface #1A1A1A`, `a #FF3C6F`, `b #7B2FFF`, `c #FFD600`, `border #252525`, `muted #888`, `faint #555`).

**Reused primitives — copy inline, do NOT import** (UI-SPEC Component Inventory): `PrimaryBtn` (lines 191-214), `GhostBtn` (lines 229-239), `PlayerAvatar` (lines 172-189, use `size={56}` for the hero per UI-SPEC). They are defined per-file in this codebase — redefine them inline in `profile/page.tsx`.

**Top bar** — copy from `app/page.tsx` lines 156-184 (logo `Klu`+green `up`, auth chip, `LangSwitch`).

**Archetype block (dormant, D-08):** hide the trait bars while `tag_scores` total is 0; show fallback `fr.archetypes.archetype_fallback` ("Une simple personne"). The `archetypes` i18n namespace ALREADY EXISTS (`lib/i18n.ts` lines 186-216: all 6 traits, 21 archetypes, `card_title`, `archetype_fallback`) — no new archetype keys needed, reuse them.

---

### `app/room/[code]/game/page.tsx` (modified — write effect, "✓ saved" line, CTA inside `EndScreen`)

**Analogs:** self (`EndScreen` lines 1302-1461; invocation line 2105), `app/join/page.tsx` `handleSignIn` (lines 65-78).

**1. Add auth state at game-page root** — the game page currently has NO auth state (confirmed: no `getUser`/`onAuthStateChange` in the file). Add the `getUser` + `onAuthStateChange` block from `app/join/page.tsx` lines 53-63 to the root game component, and pass `user` / `isSignedIn` down to `EndScreen` (extend its props — current signature line 1302-1306). The SAME `onAuthStateChange` listener carries the `TOKEN_REFRESHED` Realtime fix and the `SIGNED_IN` retroactive-save trigger.

**2. Stats write effect** (RESEARCH Pattern 1 — fires once on `ended` + `user` present; deps include `gs.session_uuid` to avoid Pitfall 1 stale closure). `session_uuid` is `GameState.session_uuid` (lib/types.ts l.79-81; set by `startGame()` in lobby, `''` in `makeInitialGameState` lib/game.ts l.103). `titleKey` from existing `computeGroupTitle(gs.stats, theme, totalRounds)` (already computed in EndScreen l.1311). `myStats` from existing `gs.stats` accessors (EndScreen l.1318-1322):
```typescript
useEffect(() => {
  if (gs?.phase !== 'ended' || !user?.id || !gs.session_uuid) return  // gate on user.id (Pitfall 2)
  const totalRounds = gs.stats.rounds_a + gs.stats.rounds_b + gs.stats.rounds_c
  supabase.from('user_session_stats').upsert({
    user_id: user.id,
    session_id: gs.session_uuid,
    designated_count:  (gs.stats.designated  ?? {})[myId ?? ''] ?? 0,
    confessed_count:   (gs.stats.confessed   ?? {})[myId ?? ''] ?? 0,
    volunteered_count: (gs.stats.volunteered ?? {})[myId ?? ''] ?? 0,
    group_title: computeGroupTitle(gs.stats, theme, totalRounds),
    theme,
    rounds_played: totalRounds,
    tag_scores: {},  // dormant until v3.0 (D-08)
  }, { onConflict: 'user_id,session_id', ignoreDuplicates: true })
    .then(({ error }) => { if (error) console.error('[stats write]', error); else setSaved(true) })
}, [gs?.phase, gs?.session_uuid, user?.id])
```

**3. Retroactive save + Realtime token refresh** (RESEARCH Patterns 2 & 3) — single `onAuthStateChange` listener: `TOKEN_REFRESHED` → `supabase.realtime.setAuth(session.access_token)` (SC-5; only on `TOKEN_REFRESHED`, never `INITIAL_SESSION` — Pitfall 5); `SIGNED_IN` + `gs.phase === 'ended'` → re-run the write (D-05, idempotent via `ignoreDuplicates`). Also update `players.user_id` for the room (D-05 discretion / RESEARCH Pattern 5), silent on failure (room may be dead — Pitfall 3, swallow `PGRST116`):
```typescript
const pid = getPlayerId(code)
if (pid) await supabase.from('players').update({ user_id: user.id }).eq('id', pid)  // silent fail OK
```

**4. CTA + "✓ saved" line inside `EndScreen`** (UI-SPEC Surface A — rendered after the players/stats list at line 1457, before `fr.end.thanks` line 1459-1461). `{!isSignedIn && <SignInSaveCTA />}` card uses `rounded-2xl p-4`, `background: C.surface`, `border: 1px solid ${C.a}33`. CTA button = `PrimaryBtn accent={C.a}` → `handleCTASignIn`. The "✓ saved" line = one muted line under the stats when `isSignedIn && saved`.

**5. CTA sign-in (correct `redirectTo`)** — copy `handleSignIn` from `app/join/page.tsx` lines 65-78, but `next` MUST be the game path (D-04): NEVER pass a raw page URL (PKCE `?code=` collision gotcha):
```typescript
const next = `/room/${code}/game`
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
})
```

---

### `lib/i18n.ts` (modified — additive keys)

**Analog:** self — existing `end` (l.143-156), `archetypes` (l.186-216), `auth` (l.237-242) namespaces.

**Pattern:** add `profile` + `save_prompt` namespaces to ALL 4 locale objects (`fr` ~l.143, `en` ~l.388, `es` ~l.631, `de` ~l.874). The `Dict` type (line 244: `export type Dict = typeof fr`) forces exhaustiveness — build fails if any locale misses a key. 13 keys total (UI-SPEC Copywriting Contract; some are arrow-function plurals like `profile.sessions_played`, mirroring the existing `end.rounds_played` / `end.stat_designated` function-value pattern at l.146/152). `dictionaries` satisfies (line 975) needs no change. Reuse the EXISTING `archetypes.*` keys for the archetype block (do not duplicate).

---

### `app/page.tsx` (modified — profile entry chip)

**Analog:** self — top bar lines 156-184.

**Pattern (UI-SPEC Surface C, A-02 locked = name chip navigates to `/profile`):** in the signed-in branch (lines 171-181), make the firstName span a `/profile` link (`router.push('/profile')` or wrap in `Link`), keep the `fr.auth.sign_out` span as the trailing sign-out tap target. Reuse the existing chip dimensions (`px-2.5 py-1.5 rounded-xl`, `C.surface` bg, `C.border` border) and `getGoogleFirstName(user)`. Gate on the existing `authLoading` guard (already present, line 162/171).

---

## Shared Patterns

### Auth state (getUser + onAuthStateChange) — WR-01
**Source:** `app/join/page.tsx` lines 53-63
**Apply to:** `app/profile/page.tsx`, `app/room/[code]/game/page.tsx` (new at root)
```typescript
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => { setUser(data.user); setAuthLoading(false) })
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
    setUser(session?.user ?? null); setAuthLoading(false)
  })
  return () => subscription.unsubscribe()
}, [])
```
Use `supabase.auth.getUser()` (server-validated), never `getSession()` (ASVS V2).

### OAuth round-trip (`?next=` redirectTo) — CR-03
**Source:** `app/join/page.tsx` `handleSignIn` lines 65-78; `app/auth/callback/route.ts` (`?next=` handler)
**Apply to:** end-screen CTA in `game/page.tsx`
**Rule:** ALWAYS `redirectTo: ${origin}/auth/callback?next=<path>`. NEVER a raw page URL (PKCE `?code=<uuid>` collides with `?code=<room>` — CLAUDE.md "OAuth redirectTo" gotcha).

### Supabase client
**Source:** `lib/supabase.ts` — single shared `supabase = createBrowserClient(...)`. Import `{ supabase } from '@/lib/supabase'` everywhere. Do NOT create a second client.

### i18n usage
**Source:** `lib/locale.tsx` — `const fr = useT()` in every component (CLAUDE.md convention; `fr.xxx` usage regardless of active locale). `LangSwitch` in top bars.
**Apply to:** profile page, CTA card, all new copy. Zero hardcoded text.

### Design tokens (`const C`)
**Source:** `const C = {...}` block at top of `app/room/[code]/game/page.tsx` (and `app/page.tsx`). Canonical per UI-SPEC.
**Apply to:** profile page (copy the block), CTA card.

### Stat-chip badge
**Source:** `EndScreen` `game/page.tsx` lines 1432-1447
**Apply to:** profile `SessionRow` — identical style, same `fr.end.stat_*` keys, render only when `> 0`, `flex-wrap`.

---

## No Analog Found

| File | Role | Data Flow | Reason / Disposition |
|------|------|-----------|----------------------|
| (none) | — | — | Every Phase 5 file has a strong in-repo analog. |

**Net-new patterns (no analog, sourced from RESEARCH instead of codebase):**
- `supabase.realtime.setAuth(token)` on `TOKEN_REFRESHED` (SC-5) — no existing usage in the codebase; follow RESEARCH Pattern 3 / Code Examples. The game page has no current `onAuthStateChange`, so this listener is brand new.
- `upsert({ onConflict, ignoreDuplicates: true })` — first idempotent-write in the repo; follow RESEARCH Pattern 1. (Existing writes use `insert` + tolerate `23505`, e.g. join page line 225 — acceptable alternative but `upsert` is the recommended pattern here.)

---

## Metadata

**Analog search scope:** `app/` (join, page, room/[code]/game), `lib/` (i18n, supabase, locale, game, types, utils), `supabase/` (schema.sql, migrations/002-auth.sql)
**Files scanned:** 8
**Pattern extraction date:** 2026-06-12
