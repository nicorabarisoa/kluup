# Code Conventions

**Analysis Date:** 2026-06-07

## TypeScript

**Strictness:**
- `strict: true` in `tsconfig.json` — full strict mode enforced
- `noEmit: true`, `isolatedModules: true`
- Target: ES2017

**Type patterns:**
- Types defined centrally in `lib/types.ts` — `Player`, `Question`, `GameState`, `GamePhase`, `Room`, `SessionStats`, `GroupTitleKey`
- Union string literals used for enums (e.g., `'waiting' | 'lobby' | 'playing' | 'ended'`)
- Optional fields marked with `?` for backward compatibility (e.g., `designated?: Record<string, number>`)
- `Record<string, T>` used for maps (e.g., `Record<string, { name: string; emoji: string; desc: string }>`)
- Type imports use `import type` syntax: `import type { Dict } from '@/lib/i18n'`
- Path alias `@/*` maps to repo root (defined in `tsconfig.json`)

**Common interfaces:**
- `Dict` type (from `lib/i18n.ts`) enforces exhaustive i18n key coverage across all 4 locales
- `GameState` (jsonb column) defined in `lib/types.ts` and used throughout game logic

## Component Patterns

**All page components are `'use client'`** — the app uses no server components for pages. Pages are interactive and depend on Supabase Realtime subscriptions.

**Component structure in `app/room/[code]/game/page.tsx`:**
- Design tokens collected at top in a single `const C` object with hex colors
- Theme metadata in `THEME_META: Record<string, { name: string; color: string }>`
- Pure helper functions (non-React) defined before components
- React Context used for cross-component communication without prop drilling (e.g., `GameControlsCtx` exposes `onQuit`/`onPause` to `RoundHeader`)
- Layout wrapper component (`GameScreen`) handles the header/body/footer shell with `maxWidth: 448` centering

**Hooks usage:**
- `useT()` called at component top: `const fr = useT()` — convention uses `fr` as variable name even when locale isn't French
- `useRef` used for stale-closure-safe access in async handlers (e.g., `roomRef.current.game_state`)
- `useEffect` used for subscriptions and cleanup; dependencies array always provided

**`forwardRef` used** where DOM access from parent is needed (e.g., screenshot target).

**Suspense boundary required** around any component using `useSearchParams` (e.g., `app/join/page.tsx` wraps `JoinForm` in `<Suspense>`).

## i18n Convention

**Core rule: zero hardcoded text.** Every user-visible string must be a key in `lib/i18n.ts`.

**How `useT()` works:**
- `LocaleProvider` (in `app/layout.tsx`) wraps the app and detects locale: localStorage > `navigator.language` > `'fr'`
- `useT()` returns the active `Dict` — always the full dictionary for the active locale
- Convention: `const fr = useT()` in every component (the variable is always named `fr` regardless of active locale)
- Usage: `fr.join.room_not_found`, `fr.game.round_of(n, total)`, etc.

**Dict structure (`lib/i18n.ts`):**
- Top-level namespaces: `common`, `home`, `landing`, `join`, `lobby`, `game`, `voting_question`, `designation`, `confession`, `question_ouverte`, `end`, `card`, `titles`
- Values can be strings or functions: `(n: number) => string` for interpolation
- Nested objects allowed: `lobby.themes['hello-stranger'].name`
- The `Dict` TypeScript type enforces all 4 locale dictionaries (`fr`, `en`, `es`, `de`) have identical keys

**Adding a new string:**
1. Add the key+value to the `fr` object in `lib/i18n.ts`
2. The `Dict` type will cause TypeScript errors in `en`, `es`, `de` dictionaries until the same key is added to all three
3. Use in component via `const fr = useT()` then `fr.<namespace>.<key>`

**Non-component helpers** that need translations receive the dict as a parameter (e.g., `momentStat(..., t)`) — they cannot call `useT()` directly.

**Question text** uses locale-keyed object: `q.question[locale]` where `locale` comes from `useLocale().locale`.

## Styling Patterns

**Framework:** Tailwind CSS v4 (PostCSS plugin, no config file — uses CSS variables via `globals.css`)

**Mixed styling approach:** components use both Tailwind utility classes and inline `style={{}}` objects.
- Tailwind for layout/spacing/flex utilities: `className="flex items-center gap-2 mx-auto w-full"`
- Inline style for design token values (colors from `const C`, font families, exact pixel sizes): `style={{ background: C.surface, color: C.muted }}`

**Color system:** `const C` in `app/room/[code]/game/page.tsx` defines all game colors as hex strings. Never hardcode hex values in JSX — reference `C.bg`, `C.surface`, `C.border`, `C.text`, `C.muted`, `C.faint`, `C.a`, `C.b`, `C.c`.

**Type accent colors:** Type A = `#FF3C6F`, Type B = `#7B2FFF`, Type C = `#FFD600` (pink/purple/yellow). The `accentForType()` helper returns the right color.

**Font variables:**
- `var(--font-display)` — Bricolage Grotesque, used for headings/labels
- `var(--font-body)` — DM Sans, used for body text and UI controls
- Applied via inline `style={{ fontFamily: 'var(--font-display)' }}` or `style={{ fontFamily: 'var(--font-body)' }}`

**Layout centering pattern (mandatory):**
- Game page: `GameScreen` wrapper constrains content to `maxWidth: 448` (≈`max-w-md`)
- Lobby: `max-w-md mx-auto`
- Landing: `max-w-4xl mx-auto` with responsive grids
- Never use full-width layouts — always center in a constrained column

**Responsive breakpoints:**
- Mobile-first; breakpoints: `sm:` (640px), `md:` (768px)
- Landing uses `md:grid-cols-4` (themes), `md:grid-cols-3` (types/steps)
- Game page has no responsive grid — single centered column at all sizes

**Border radius tokens:** `rounded-xl` (12px) for buttons/surfaces, `rounded-full` for pills/avatars/badges.

**Opacity pattern for disabled/secondary states:** `opacity-40` (e.g., unselected question candidates during voting).

## Naming Conventions

**Files:**
- Page files: `app/<route>/page.tsx` — lowercase kebab-case directories, file always `page.tsx`
- Lib files: `lib/<name>.ts` or `lib/<name>.tsx` — camelCase (e.g., `lib/usePresence.ts`, `lib/game.ts`)
- SQL files: `supabase/<name>.sql` — snake_case

**React components:** PascalCase functions (e.g., `GameScreen`, `RoundHeader`, `TypeBadge`, `VoteTimer`)

**Hooks:** camelCase prefixed with `use` (e.g., `useRoomPresence`, `useT`, `useLocale`)

**Variables/functions:** camelCase (e.g., `pickCandidates`, `tallyDesignation`, `countVotes`)

**Constants:** SCREAMING_SNAKE_CASE for module-level constants (e.g., `MAX_ROUNDS`, `THEME_META`, `AVATAR_COLORS`, `TYPE_WEIGHTS`)

**Database columns:** snake_case (e.g., `room_id`, `player_id`, `game_state`, `is_host`, `host_id`)

**i18n keys:** snake_case (e.g., `room_not_found`, `vote_sent`, `waiting_host_advance`)

**Supabase channel names:** template literals with kebab prefix (e.g., `lobby-${code}`, `game-${code}`, `presence-${roomId}`, `votes-broadcast-${id}`)

## Error Handling

**Pattern: inline with `alert()` for user-facing errors.** No toast or notification system — errors surface via native browser `alert()`.

**Console logging for diagnostics:** diagnostic `console.log` calls are intentionally left for RLS/env debugging (e.g., `console.log('[join] lookup:', { code, found: !!room, error: roomError?.message })`). These are not accidental — they help diagnose production issues without a monitoring tool.

**Supabase error handling pattern:**
```typescript
const { data: room, error: roomError } = await supabase.from('rooms')...
if (roomError) {
  console.error('[joinRoom] room lookup failed:', roomError)
  alert(fr.join.join_error)
  setLoading(false)
  return
}
if (!room) {
  alert(fr.join.room_not_found)
  setLoading(false)
  return
}
```

**Stale closure avoidance:** `onPause`/`onResume` read `roomRef.current.game_state` instead of React state to avoid desync. Refs synchronized in effects, not during render.

**Deduplication:** Supabase unique constraint violations (`23505`) are caught and retried (e.g., room code generation). `23502` (NOT NULL) caught in docs as a known gotcha to prevent regression.

**No error boundaries** — no `<ErrorBoundary>` components detected. Errors propagate uncaught or are handled inline.

---

*Convention analysis: 2026-06-07*
