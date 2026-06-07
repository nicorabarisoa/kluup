# Testing

**Analysis Date:** 2026-06-07

## Test Setup

**No test framework is configured.** The `package.json` contains no test script, no test runner dependency, and no test configuration file. There is no `jest.config.*`, `vitest.config.*`, or equivalent in the repository root.

**Available scripts:**
```bash
npm run dev      # Next.js dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint only
```

There is no `npm test` command.

## Test Coverage

**Automated test coverage: 0%.** No test files exist in the application source tree (`app/`, `lib/`, `supabase/`). All test files found in the repository are inside `node_modules/` (third-party packages).

**What is covered (manually):**
- Two rounds of live playtest sessions with real users have been completed (referenced in `CLAUDE.md`)
- Playtest findings drove design changes: Type C redesign, Type B roulette-only refactor, replay vote purge fix, timer advancer fix

**What is not covered (no automated tests):**
- `lib/game.ts` pure functions: `pickCandidates`, `pickType`, `tallyDesignation`, `tallyQuestionSelection`, `accumulateStats`, `computeGroupTitle`, `countVotes`, `countChoiceVotes`
- Vote resolution logic (threshold detection, tie-breaking)
- Room lifecycle (reconnection, ghost pruning, cleanup)
- i18n dictionary completeness across locales
- Realtime subscription logic
- UI components

## Testing Patterns

No established testing patterns exist — there are no test files to reference.

## Quality Gaps

**High-risk untested areas:**

**`lib/game.ts` pure functions:**
- `tallyDesignation` — determines Type A winner(s), tie detection, and the `designation_tie_all` flag. Regression here directly breaks game outcomes.
- `tallyQuestionSelection` — selects which question to play based on votes. Off-by-one or tie errors would cause wrong questions.
- `pickType` — weighted random type selection with exclusion of previous type. The "no two same types in a row" rule is untested.
- `computeGroupTitle` — maps session stats to a `GroupTitleKey`. Threshold logic determines which end-screen title appears.
- `accumulateStats` — accumulates per-player stats (`designated`, `confessed`, `volunteered` maps). Errors here corrupt the stats shown on end screen and share card.
- Files: `lib/game.ts`

**Vote counting / threshold resolution (`app/room/[code]/game/page.tsx`):**
- `countVotes` and `countChoiceVotes` determine when a round auto-advances. If the threshold check has a bug, rounds can never resolve or resolve prematurely.
- The advancer election (smallest `player.id`) that fires `onForce` on timer expiry is untested race-condition logic.

**Reconnection logic (`lib/utils.ts`, `app/join/page.tsx`):**
- `getPlayerId`/`setPlayerId`/`clearPlayerId` with `kluup_pid_<CODE>` localStorage keys
- The "reuse existing row vs. insert new player" branch in `joinRoom` is critical to preventing duplicate player rows

**Replay (purge votes before restart):**
- The `votes.delete().eq('room_id', ...)` call in `startGame` must run before new votes are inserted. Missing it causes UNIQUE constraint failures that silently break the next game. This regression has already happened once.

**i18n completeness:**
- The `Dict` TypeScript type enforces key parity at compile time, but function-valued keys (e.g., `(n: number) => string`) could have incorrect logic in non-FR locales without any test catching it.

**Manual testing approach (current state):**
- Run `npm run build` to catch TypeScript and lint errors
- Manual end-to-end test: create room, join on multiple devices/tabs, play through all round types
- Next recommended test session: 3–4 real players (noted as priority in `CLAUDE.md`)

**Recommended first tests to add (highest ROI):**
1. Unit tests for `lib/game.ts` pure functions — no Supabase dependency, pure input/output
2. Unit tests for `lib/utils.ts` (`genId`, `getPlayerId`/`setPlayerId` localStorage logic)
3. Integration test for vote threshold logic using a mocked Supabase client

---

*Testing analysis: 2026-06-07*
