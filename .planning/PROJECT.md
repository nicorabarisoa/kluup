# Kluup

## What This Is

A web-based party game (kluup.app) designed to break the ice and create authentic human connections at social gatherings. Format: host + players on their phones. The host launches a session; players join via a room code from their browser — no install required.

- Technical reference: Jackbox Games
- Content reference: We're Not Really Strangers
- Positioning: "the game that reveals your group"

## Who It's For

Groups of 3–10 players at social gatherings (apéros, parties, team events). The host owns the experience; players are frictionless participants.

## Core Value

Creating genuine human moments through structured social questions — the app triggers the moment, the group handles the dynamic.

## Context

**v2.0 shipped 2026-06-12 on Railway.** Full game loop + optional Google OAuth accounts + cross-session stats profile. Anonymous flow unchanged — accounts never required. i18n FR/EN/ES/DE. 134 files changed, 20 544 insertions across v2.0 milestone.

**Stack:** Next.js 16 (App Router, client-only), React 19, TypeScript, Tailwind v4, Supabase (Postgres + Realtime + Auth), Railway hosting.

## Requirements

### Validated

- ✓ Room creation with unique 6-char code — existing
- ✓ Player join via code (frictionless, no account) — existing
- ✓ Real-time lobby with theme selection (host) — existing
- ✓ Game loop: question vote → Type A/B/C rounds → reveal — existing
- ✓ Timer (30 s) with elected advancer for vote phases — existing
- ✓ Host-only controls: next round, skip, end game, return to lobby — existing
- ✓ Pause/resume (open to all players) — existing
- ✓ Room lifecycle: presence tracking, ghost pruning, cleanup — existing
- ✓ End screen: group title + personal stats + share card — existing
- ✓ i18n FR/EN/ES/DE with locale detection — existing
- ✓ Responsive layout (mobile-first, desktop-centered columns) — existing
- ✓ `GET /api/health` returning `{"status":"ok","uptime":<seconds>}` — v2.0 Phase 1
- ✓ Optional Google OAuth sign-in (host or player) via Supabase Auth — v2.0 Phase 4
- ✓ Player rows linkable to user account (`players.user_id` nullable FK) — v2.0 Phase 2
- ✓ Cross-device reconnect via `user_id` lookup (IDEN-02) — v2.0 Phase 4
- ✓ Personal stats persisted per account across sessions (`user_session_stats`) — v2.0 Phase 5
- ✓ Stats profile page at `/profile` (history, cumulative grid, group titles) — v2.0 Phase 5
- ✓ Anonymous end-screen CTA + stats survive slow OAuth (PendingStatsFlusher) — v2.0 Phase 5

### Active (v3.0)

- [ ] Social archetypes: trait scores from in-game behaviour + 21 named archetypes on share card
- [ ] Duo awards: 4 named awards for most notable player pairs, 2-faced share card
- [ ] Contextual questions: adaptive follow-ups between rounds triggered by in-game events
- [ ] Power cards: secret cards to volunteers, usable during Type B roulette for extra reveals

### Out of Scope

- Premium feature gating / quota — v3.0 monetisation milestone
- Payment / Stripe — v3.0
- Custom Theme mode — validated direction, not yet built
- Configurable round count — validated direction, not yet built
- In-app chat — deliberately excluded (WhatsApp does it better)
- Automatic sanctions / dare pack — post-v1 optional mode
- Magic link / email+password auth — Google OAuth only for v2.0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Host is always a player | Simplifies roster logic, better social dynamic | ✓ Locked |
| Confession (Type B) = single roulette | Playtest #3 feedback — B1/B2 split added friction | ✓ Locked |
| Intensity ignored at question selection | Theme already bounds spice; randomness = unpredictability | ✓ Locked |
| Broadcast `phase_changed` as primary convergence | `postgres_changes` can be stale; refetch after broadcast is reliable | ✓ Locked |
| `modern-screenshot` not `html2canvas` | html2canvas distorted custom fonts on share card | ✓ Locked |
| Player identity per room in localStorage | Reconnect without duplicate row; global sessionStorage caused bugs | ✓ Locked |
| Health endpoint at `/api/health` | Next.js App Router convention; rewrites available if needed | ✓ Locked |
| `@supabase/ssr` with `getUser()` not `getSession()` | Authoritative server-side validation; detects server-side logout | ✓ Locked |
| `session_uuid` generated in `startGame()` not `makeInitialGameState()` | Ensures fresh UUID on replay (factory default `''` overwritten each launch) | ✓ Locked |
| OAuth `redirectTo` always via `/auth/callback?next=<path>` | PKCE `?code=<uuid>` must be exchanged server-side; raw URL causes silent failure | ✓ Locked |
| `PendingStatsFlusher` as global layout component | Stats survive room lifecycle independently of game page; idempotent flush | ✓ Locked |
| `status='ended'` 30-min TTL in `cleanup_dead_rooms()` | Defense-in-depth: OAuth round-trip can take minutes; primary mechanism is localStorage stash | ✓ Locked |

---
*Last updated: 2026-06-12 after v2.0 milestone*
