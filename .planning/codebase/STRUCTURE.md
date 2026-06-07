# Codebase Structure

**Analysis Date:** 2026-06-07

## Directory Layout

```
kluup/
├── app/                        # Next.js App Router pages (all 'use client')
│   ├── layout.tsx              # Root layout: fonts + LocaleProvider
│   ├── page.tsx                # Landing page (/)
│   ├── globals.css             # Tailwind base + CSS font variables
│   ├── favicon.ico
│   └── room/
│       └── [code]/
│           ├── lobby/
│           │   └── page.tsx    # Lobby: player list, theme picker, start
│           └── game/
│               └── page.tsx    # Entire game: all screens + state machine
├── app/join/
│   └── page.tsx                # Join by code (pseudo entry)
├── lib/                        # Shared pure modules
│   ├── types.ts                # TypeScript types: Player, Room, GameState, GamePhase…
│   ├── game.ts                 # Pure game engine: pick, tally, stats, DB writes
│   ├── i18n.ts                 # Dictionaries fr/en/es/de + Dict type
│   ├── locale.tsx              # LocaleProvider, useT(), useLocale(), LangSwitch
│   ├── usePresence.ts          # Supabase Presence hook: ghost prune + heartbeat
│   ├── supabase.ts             # Supabase client (warns if env vars missing)
│   └── utils.ts                # genId, copyToClipboard, getPlayerId/setPlayerId/clearPlayerId
├── supabase/
│   ├── schema.sql              # SOURCE OF TRUTH — idempotent CREATE TABLE + RLS + realtime
│   ├── seed.sql                # Base question seed
│   ├── seed_themes.sql         # Theme question seed
│   ├── seed_cut.sql            # 78 adult questions (run ONCE — no unique key, re-run = duplicates)
│   ├── lifecycle.sql           # cleanup_dead_rooms() + pg_cron (already executed in prod)
│   ├── migration.sql           # LEGACY — ALTER only, do not use for new provisioning
│   └── rls.sql                 # RLS-only subset of schema.sql (quick fix if needed)
├── public/                     # Static assets
├── .env.example                # Required env var template
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts          # (Tailwind v4 — config may be minimal)
└── package.json
```

## Key Files

| File | Responsibility |
|------|---------------|
| `app/page.tsx` | Landing page: hero with create-room form + join, "how it works", theme showcase, CTA. Responsive (`sm:`/`md:` breakpoints). |
| `app/join/page.tsx` | Join flow: code input + pseudo entry. Wrapped in `Suspense` for `useSearchParams`. Redirects to lobby on success. |
| `app/room/[code]/lobby/page.tsx` | Pre-game lobby: real-time player list, host-only theme selector, "Start" button. Redirects to `/join` if player not registered. |
| `app/room/[code]/game/page.tsx` | Entire game experience (~1800 lines). Contains: all screen components, the main `GamePage` component with realtime setup, all vote handlers, and all phase-transition logic. |
| `app/layout.tsx` | Loads fonts (Bricolage Grotesque via `--font-display-face`, DM Sans via `--font-body-face`) and wraps the app in `<LocaleProvider>`. |
| `lib/types.ts` | Canonical TypeScript types: `Player`, `Question`, `GameState`, `GamePhase`, `Room`, `SessionStats`, `GroupTitleKey`. |
| `lib/game.ts` | Pure game engine: `pickCandidates`, `pickType`, `tallyDesignation`, `tallyQuestionSelection`, `accumulateStats`, `computeGroupTitle`, `countVotes`, `countChoiceVotes`, `fetchVotes`, `makeInitialGameState`, `updateRoomGameState`. |
| `lib/i18n.ts` | Translation dictionaries (`fr`, `en`, `es`, `de`) typed against `Dict`. Add new locales here. |
| `lib/locale.tsx` | `LocaleProvider` (Context), `useT()` hook (returns active dict), `useLocale()` hook, `LangSwitch` dropdown component. |
| `lib/usePresence.ts` | `useRoomPresence(roomId, myId)`: Supabase Presence channel, 60 s grace prune, 2 min heartbeat. |
| `lib/supabase.ts` | Single Supabase client instance. Logs a console warning if `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing. |
| `lib/utils.ts` | `genId()`, `copyToClipboard()` (with non-secure context fallback), `getPlayerId(code)` / `setPlayerId(code, id)` / `clearPlayerId(code)` (localStorage key `kluup_pid_{CODE}`). |
| `supabase/schema.sql` | Idempotent source of truth for DB schema, RLS policies, and realtime publication. Run this to provision or repair a database. |

## Module Boundaries

### `lib/types.ts`
Owns all shared TypeScript interfaces. No runtime logic. Every other module imports from here; it imports nothing from the project.

### `lib/game.ts`
Owns game logic and DB writes for game state. Public API:
- `pickCandidates(theme, round, playedIds, lastType?)` → `Promise<Question[]>` — queries Supabase, returns 3 shuffled candidates
- `makeInitialGameState(candidates)` → `GameState`
- `accumulateStats(gs)` → `SessionStats`
- `computeGroupTitle(stats, theme, totalRounds)` → `GroupTitleKey`
- `updateRoomGameState(roomId, gs)` → Supabase update promise
- `countVotes(roomId, round, voteType)` → `Promise<number>`
- `countChoiceVotes(roomId, round)` → `Promise<number>` (Type C: counts volunteer + designation)
- `fetchVotes(roomId, round, voteType)` → vote rows
- `tallyDesignation(votes, playerCount)` → `DesignationResult` (no random tie-break)
- `tallyQuestionSelection(votes)` → winning index (random tie-break)

### `lib/i18n.ts`
Owns translation strings. The `Dict` type enforces key exhaustiveness across all locales. To add a locale: create a new `Dict`-typed object and add an entry to `localeNames`.

### `lib/locale.tsx`
Owns locale detection and switching. Locale priority: localStorage → `navigator.language` → `'fr'`. `useT()` is the only way components should access strings — convention: `const fr = useT()` even in non-French UI.

### `lib/usePresence.ts`
Owns ghost-pruning and room keepalive. Only one hook call per page (`useRoomPresence` in lobby and game). The elected cleaner pattern (smallest player id) prevents races.

### `lib/utils.ts`
Owns identity helpers and clipboard. `getPlayerId(code)` / `setPlayerId` / `clearPlayerId` use localStorage key `kluup_pid_{CODE}`. Never use `sessionStorage.getItem('player_id')` — that pattern was the source of duplicate-player bugs.

## Routing

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing: create room or join |
| `/join` | `app/join/page.tsx` | Enter code + pseudo; accepts `?code=XXX` query param |
| `/room/[code]/lobby` | `app/room/[code]/lobby/page.tsx` | Pre-game lobby (redirects to `/join` if not registered) |
| `/room/[code]/game` | `app/room/[code]/game/page.tsx` | Full game session |

All routes are client-rendered. `[code]` is the 6-character room code (alphabet without ambiguous chars 0/O/1/I).

## Naming Conventions

**Files:** `page.tsx` for App Router pages (Next.js convention), `camelCase.ts` / `camelCase.tsx` for lib modules.

**Components:** PascalCase function components, all co-located in `game/page.tsx` (no separate component files for game screens).

**Hooks:** `use` prefix, camelCase (`useRoomPresence`, `useT`, `useLocale`).

**i18n access:** Always `const fr = useT()` regardless of locale — this is an intentional naming convention; do not rename to `t` or `dict`.

## Where to Add New Code

**New game screen (new phase):**
1. Add the phase to `GamePhase` union in `lib/types.ts`
2. Add the screen component in `app/room/[code]/game/page.tsx` alongside existing screen components
3. Add the `case` to the phase-switch render block in `GamePage`
4. Add transition logic in the relevant `resolveVotes` / `advance` call path

**New game engine function:**
- Implementation: `lib/game.ts`
- Types: `lib/types.ts` if new types are needed

**New i18n strings:**
- Add keys to the `Dict` type and all four locale objects in `lib/i18n.ts`
- The TypeScript compiler will error on missing keys in any locale

**New utility helper:**
- `lib/utils.ts` for pure client-side helpers
- `lib/supabase.ts` only for Supabase client config changes

**New DB table or policy:**
- Update `supabase/schema.sql` (keep it idempotent)
- Add to the `supabase_realtime` publication if real-time is needed
- Never rely on `migration.sql` for new provisioning

## Special Directories

**`supabase/`:**
- Purpose: SQL scripts for DB provisioning, seeding, and lifecycle management
- Generated: No
- Committed: Yes
- Note: `seed_cut.sql` has no unique key on question text — running it twice creates duplicates. Run once only.

**`.planning/codebase/`:**
- Purpose: Codebase analysis documents for GSD planning agents
- Generated: Yes (by mapper agents)
- Committed: Yes

---

*Structure analysis: 2026-06-07*
