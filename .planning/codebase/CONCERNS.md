# Codebase Concerns

**Analysis Date:** 2026-06-07

---

## Critical Issues

**`MAX_ROUNDS` hardcoded constant — blocks premium feature:**
- Issue: `const MAX_ROUNDS = 7` at line 39 of `app/room/[code]/game/page.tsx`. Must become a DB-stored field (`rooms.max_rounds`) for the "Configuration des manches" premium feature.
- Files: `app/room/[code]/game/page.tsx` (lines 39, 1781, 1863), `lib/game.ts`
- Impact: Premium round-count feature is architecturally blocked until this is refactored. Changing it now risks a regression in end-of-session logic (3 separate usages to sync).
- Fix approach: Add `max_rounds INTEGER DEFAULT 7` to `rooms` table. Thread it as a param through `onNextRound`, `onEndGame`, and the `nextLabel` calculation. Update `lib/game.ts` functions that could consume `maxRounds`.

**Race condition on multi-client vote resolution:**
- Issue: Any client that reaches `count >= players.length` calls `resolveVotes()` or `resolveTypeCChoice()`. Multiple clients can independently reach threshold at the same moment (e.g. two players vote within the same broadcast cycle). Both call `advance()` which writes `game_state` twice.
- Files: `app/room/[code]/game/page.tsx` (lines 1664, 1733)
- Impact: Writes are last-write-wins on Supabase (no optimistic locking). In practice, both writes produce the same outcome (same tally), so the risk is low but not zero — e.g. if players list changes between the two fetches, tallies could diverge.
- Fix approach: Move vote resolution to a Postgres RPC function (`SECURITY DEFINER`) that holds a row-level lock on the room and checks idempotency before advancing phase.

**`host_id NOT NULL` in production DB — schema drift:**
- Issue: `schema.sql` declares `host_id text` (nullable) but the live production DB has `host_id NOT NULL`. `CREATE TABLE IF NOT EXISTS` does not alter an existing table, so running `schema.sql` on a fresh DB would create a nullable column while prod has a NOT NULL constraint.
- Files: `supabase/schema.sql` (line 23), `app/page.tsx` (room creation code)
- Impact: Any developer provisioning a fresh DB from `schema.sql` gets a diverged schema. Future `INSERT` omitting `host_id` breaks in prod but passes in dev.
- Fix approach: Add `ALTER TABLE rooms ALTER COLUMN host_id SET NOT NULL;` to `schema.sql` and document the divergence explicitly.

---

## Security Concerns

**Fully open RLS — no authentication, all anon:**
- Risk: Every table (`rooms`, `players`, `votes`, `questions`) has `USING (true)` policies. Any anonymous client can read all rooms, delete any player, update any game state, or delete votes belonging to other rooms.
- Files: `supabase/schema.sql` (lines 89–118)
- Current mitigation: MVP-only. No sensitive personal data stored (only pseudos).
- Recommendations: Before adding auth/payments, replace open policies with user-scoped ones. The monetisation plan explicitly requires a `start_game()` SECURITY DEFINER RPC for server-side gating.

**All game logic runs client-side — fully trust-the-client:**
- Risk: Any player can call `advance()`, write arbitrary `game_state`, skip rounds, or end the game by posting directly to the Supabase REST API. The `isHost` check in `onNextRound`/`onEndGame` is UI-only.
- Files: `app/room/[code]/game/page.tsx` (all handler functions), `lib/game.ts` (`updateRoomGameState`)
- Current mitigation: None server-side. Acceptable for an in-person party game where all players are in the same room — social deterrence is the only guard.
- Recommendations: When paywalls are added, move `start_game()` and `advance_phase()` to RPC functions. Keep current architecture for free tier until then.

**No rate limiting on inserts:**
- Risk: A malicious client (or browser bug) can spam vote inserts. The UNIQUE constraint on `(room_id, round, player_id, vote_type)` prevents duplicate votes but does not prevent flooding the `rooms` table with room creation requests.
- Files: `app/page.tsx` (room creation), `supabase/schema.sql`
- Current mitigation: UNIQUE constraint on votes. No protection on rooms.
- Recommendations: Add Supabase Edge Function rate limiting or RLS-level insert throttle when going beyond MVP.

---

## Technical Debt

**`app/room/[code]/game/page.tsx` is 1898 lines — monolithic:**
- Issue: The entire game page (state machine, all screen components, all handlers, roulette animations, share card, end screen, timer) lives in one file.
- Files: `app/room/[code]/game/page.tsx`
- Impact: High cognitive load for any change. Adding a new game phase requires reading ~2000 lines to understand all side effects. Risk of introducing regressions in adjacent screens.
- Fix approach: Extract each screen into `app/room/[code]/game/screens/` components. Extract animation logic (roulette timers) into `lib/roulette.ts`. Extract the share card into `components/ShareCard.tsx`.

**Inline design tokens — no design system:**
- Issue: The color constants object `C` at line 27 in `game/page.tsx` is a local variable, not shared. `app/page.tsx` and lobby use ad-hoc Tailwind classes, not the same tokens. Colors like `#FF3C6F`, `#7B2FFF`, `#FFD600` are repeated in multiple places.
- Files: `app/room/[code]/game/page.tsx` (line 27–37), `app/room/[code]/lobby/page.tsx`
- Impact: Visual inconsistency risk when modifying theme colors; no single source of truth.
- Fix approach: Move `C` and `THEME_META` to `lib/tokens.ts` and import everywhere.

**`shuffle()` uses `Math.random() - 0.5` — biased sort:**
- Issue: `lib/game.ts` line 8: `[...arr].sort(() => Math.random() - 0.5)`. This is a statistically biased shuffle (not a Fisher-Yates). Elements at the start of the array are underrepresented.
- Files: `lib/game.ts` (line 8)
- Impact: Questions at the beginning of the DB result set are chosen less often. Low severity for a party game, but analytically incorrect.
- Fix approach: Replace with Fisher-Yates: `for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }`.

**`rounds_b1` / `rounds_b2` stats fields retained after B1 removal:**
- Issue: `lib/game.ts` `emptyStats()` still initialises `rounds_b1: 0`. `accumulateStats()` still has a branch for `gs.b_subtype === 'B1'` (lines 123–127). B1 mode was removed in playtest #3 — this code is dead.
- Files: `lib/game.ts` (lines 73–76, 122–129), `lib/types.ts`
- Impact: Dead code increases maintenance surface. `title_transparent` and `title_daring` in `computeGroupTitle` can never be triggered (they depended on B1 stats). The `computeGroupTitle` function doesn't handle all 10 documented titles.
- Fix approach: Remove `rounds_b1`, `rounds_b2` from `SessionStats`. Remove dead B1 branch in `accumulateStats`. Reconcile `computeGroupTitle` with the 10-title table in CLAUDE.md (currently only 7 titles are reachable).

**`computeGroupTitle` only covers 7 of the 10 documented titles:**
- Issue: `lib/game.ts` lines 154–160 returns one of: `title_nofilter`, `title_unfathomable`, `title_brave`, `title_cautious`, `title_ruthless`, `title_accomplices`, `title_unclassifiable`. Three titles (`title_transparent`, `title_mysterious`, `title_daring`) are defined in i18n but unreachable.
- Files: `lib/game.ts` (lines 147–161), `lib/i18n.ts`
- Impact: Content defined in i18n is never shown to users.

**`window.confirm()` used for quit confirmation:**
- Issue: `app/room/[code]/game/page.tsx` line 1858: `window.confirm(fr.game.quit_confirm)`. Native browser dialogs are unstyled, block the JS thread, and behave inconsistently across mobile browsers.
- Files: `app/room/[code]/game/page.tsx` (line 1858)
- Fix approach: Replace with an in-app modal overlay matching the game's dark theme.

---

## Performance Risks

**`pickCandidates` makes up to 3 sequential Supabase queries per round:**
- Issue: `lib/game.ts` lines 51–68: iterates `typeOrder` (up to 3 types) and issues a separate `select` query for each until a non-empty pool is found. In the common case, 1 query. In exhausted-pool edge cases, 2–3 sequential round-trips.
- Files: `lib/game.ts` (lines 40–71)
- Impact: Round transition latency spikes when a theme is nearly exhausted. At 7 rounds with 78 questions per theme, this is unlikely but grows as content is added.
- Fix approach: Fetch all unplayed questions in one query and filter by type client-side, or use a single SQL query with conditional type ordering.

**No query result caching — `players` list re-fetched on every `postgres_changes` event:**
- Issue: The `players` state in `game/page.tsx` is updated via individual INSERT/DELETE/UPDATE events from Realtime, which is correct. However `init()` does a full `select` on mount, and `refetchRoom()` re-queries the room on every `phase_changed` broadcast. With many players or rapid broadcasts, this creates many parallel requests.
- Files: `app/room/[code]/game/page.tsx` (lines 1520–1523)
- Impact: Low at current user scale (2–10 players). Could become noticeable with many concurrent rooms on the free Supabase tier.

**`modern-screenshot` captures a full off-screen DOM clone at 540×540:**
- Issue: Share card generation is done via `modern-screenshot` which clones the DOM. On low-end phones, this may cause a visible jank or OOM during the end screen.
- Files: `app/room/[code]/game/page.tsx` (EndScreen component, ~line 1259)
- Impact: Low for typical use; worth monitoring in real-device testing.

---

## Scalability Limits

**Supabase free tier Realtime connection limit:**
- Issue: Each room consumes 3 Realtime channels (`game-{code}`, `votes-broadcast-{id}`, `presence-{roomId}`). Supabase free tier caps concurrent connections at 200. At 3 channels/room, that's ~66 concurrent rooms before hitting the ceiling.
- Files: `app/room/[code]/game/page.tsx` (lines 1532, 1548), `lib/usePresence.ts` (line 25)
- Impact: Fine for MVP/beta. Needs paid Supabase plan before any marketing push.

**No pg_cron — dead room cleanup is opportunistic only:**
- Issue: `cleanup_dead_rooms()` is called only at room creation time (opportunistic). Rooms with no active players accumulate until a new room is created.
- Files: `supabase/lifecycle.sql` (cleanup RPC)
- Impact: DB size grows unboundedly between creation events. Not a real risk at small scale.
- Fix: Enable pg_cron (commented out in `lifecycle.sql`) or schedule via Railway cron job.

**`played_question_ids` stored in `game_state` jsonb grows with session:**
- Issue: `game_state.played_question_ids` is a JSON array appended to each round and written back to the `rooms` row. At 7 rounds this is trivial. With custom themes or high round counts (premium feature: 15 rounds), this grows.
- Files: `lib/game.ts` (`makeInitialGameState`, `pickCandidates`), `app/room/[code]/game/page.tsx` (`onNextRound`)
- Impact: Negligible at current scale. Worth noting when `max_rounds` becomes configurable.

---

## Missing Infrastructure

**No test suite whatsoever:**
- Issue: Zero test files exist (`package.json` has no test runner — no Jest, Vitest, Playwright). No unit tests for `lib/game.ts` logic (tally functions, type weights, group title computation). No integration tests for vote resolution flows.
- Files: `package.json`, `lib/game.ts`, `lib/utils.ts`
- Impact: Every regression must be caught manually via playtest. The fix-commit history (`fix: purge votes au replay`, `fix: régression host_id NOT NULL`, `fix: sync pause`) shows recurring regressions in core logic.
- Priority: High. `lib/game.ts` is pure logic with no side effects (except `pickCandidates` / `fetchVotes` / `updateRoomGameState`) — it is straightforwardly testable.

**No error monitoring or alerting:**
- Issue: No Sentry, LogRocket, or equivalent. Errors are only visible via `console.error()` in client-side code. Production failures are invisible until a user reports them.
- Files: All handler functions in `app/room/[code]/game/page.tsx` (errors logged with `console.error`)
- Fix approach: Add Sentry browser SDK (free tier sufficient for MVP). At minimum, wrap `advance()`, `submitVote()`, and `resolveVotes()` in try/catch with structured error reporting.

**No CI pipeline:**
- Issue: No GitHub Actions or equivalent. `package.json` has `lint` script but no automated run. Type errors and lint regressions are only caught locally.
- Fix approach: Add a minimal GitHub Actions workflow: `npm run lint && npm run build` on every PR.

---

## Known Fragile Patterns

**`resolveOnShrinkRef.current` assigned during render:**
- Issue: `app/room/[code]/game/page.tsx` line 1840: `resolveOnShrinkRef.current = () => { ... }` is assigned directly in the render body (not inside `useEffect`). This captures the current closure (including `gs`, `players`, `isHost`) at render time. It is called from a `useEffect` watching `players.length`. This pattern works but is fragile — if a render is batched or deferred, the ref may hold a stale closure briefly.
- Files: `app/room/[code]/game/page.tsx` (lines 1840–1854)
- Impact: Low in practice (React 19 batching is deterministic in event handlers). Hard to reason about during debugging.

**`isCleaner()` in `usePresence.ts` checks presence state at call time — race window:**
- Issue: `lib/usePresence.ts` line 31: `isCleaner()` reads `channel.presenceState()` synchronously. Between the `leave` event and the 60-second timeout callback, the presence state can change (reconnection, new join). The check at line 48 mitigates this, but there is a window where two clients both pass `isCleaner()` if their presence keys arrive simultaneously after a leave.
- Files: `lib/usePresence.ts` (lines 31–50)
- Impact: Could cause two clients to delete the same ghost player row concurrently. Postgres `DELETE WHERE id = $1` is idempotent, so no data corruption, but it produces a spurious error log.

**Vote count broadcast can arrive before the DB write completes:**
- Issue: In `submitVote()` (line 1660), `vote_count` broadcast is sent immediately after `countVotes()`. However `countVotes()` runs a `SELECT COUNT(*)` that may not reflect the just-inserted row if Supabase's read replica lags. On the receiving client, `setVoteCount` could briefly show an outdated count.
- Files: `app/room/[code]/game/page.tsx` (lines 1657–1662)
- Impact: Visual only — the counter shows a stale value for <100ms. The authoritative `count >= players.length` check uses the same query, so resolution correctness is not affected.

**`onQuit` deletes own player row before fetching remaining players:**
- Issue: `app/room/[code]/game/page.tsx` lines 1823–1826: `await supabase.from('players').delete().eq('id', myId)` then `await supabase.from('players').select().eq('room_id', room.id)`. The second query correctly excludes the deleted player, but between the two awaits, another player could also quit — making the remaining count transiently inaccurate for host transfer logic.
- Files: `app/room/[code]/game/page.tsx` (lines 1823–1833)
- Impact: Edge case (two players quitting within ~100ms). Worst case: host transfer goes to the wrong player. Not a data loss scenario.

**`eslint-disable-next-line react-hooks/exhaustive-deps` used twice:**
- Issue: Lines 1595 and 1605 suppress the exhaustive-deps lint rule. The main `useEffect` at line 1463 intentionally only runs on `code` change (correct), but suppressing the lint warning means future additions to the effect body won't be flagged for missing deps.
- Files: `app/room/[code]/game/page.tsx` (lines 1595, 1605)
- Impact: Low now; risk increases as the effect grows.

---

*Concerns audit: 2026-06-07*
