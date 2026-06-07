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

**MVP deployed on Railway.** Full game loop playable: landing → room creation/join → lobby (theme selection) → rounds A/B/C → end screen + share card. i18n FR/EN/ES/DE. Room lifecycle managed (presence + cleanup). Two rounds of playtesting integrated.

**Stack:** Next.js 16 (App Router, client-only), React 19, TypeScript, Tailwind v4, Supabase (Postgres + Realtime), Railway hosting.

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
- ✓ `GET /api/health` returning `{"status":"ok","uptime":<seconds>}` — implemented

### Active

(None — first milestone complete)

### Out of Scope

- Auth / accounts — post-MVP (monetisation milestone)
- Payment / Stripe — post-MVP
- Custom Theme mode — validated direction, not yet built
- Configurable round count — validated direction, not yet built
- In-app chat — deliberately excluded (WhatsApp does it better)
- Automatic sanctions / dare pack — post-v1 optional mode

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Host is always a player | Simplifies roster logic, better social dynamic | Locked |
| Confession (Type B) = single roulette | Playtest #3 feedback — B1/B2 split added friction | Locked |
| Intensity ignored at question selection | Theme already bounds spice; randomness = unpredictability | Locked |
| Broadcast `phase_changed` as primary convergence | `postgres_changes` can be stale; refetch after broadcast is reliable | Locked |
| `modern-screenshot` not `html2canvas` | html2canvas distorted custom fonts on share card | Locked |
| Player identity per room in localStorage | Reconnect without duplicate row; global sessionStorage caused bugs | Locked |
| Health endpoint at `/api/health` (not `/health`) | Next.js App Router convention; rewrites available if needed | Locked |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after initialization*
