---
phase: 03-playtest-quality-fixes
plan: "02"
subsystem: i18n + presence
tags: [i18n, presence, constants, strings]
dependency_graph:
  requires: []
  provides: [pseudo_taken, pseudo_prefilled_hint, player_joined, players_hint_updated, GRACE_MS_15s, HEARTBEAT_MS_30s, room_deletion_on_last_prune]
  affects: [lib/i18n.ts, lib/usePresence.ts]
tech_stack:
  added: []
  patterns: [function-valued i18n key, Dict exhaustiveness enforcement]
key_files:
  modified:
    - lib/i18n.ts
    - lib/usePresence.ts
decisions:
  - GRACE_MS reduced to 15s (D-04/D-06) to cover phone screen-lock scenarios without keeping ghost players for 60s
  - HEARTBEAT_MS reduced to 30s for fresher presence signal
  - Room auto-deletion added to prune callback (D-05) per PLAN.md instruction — fires when count === 0 after player delete
  - player_joined uses function-valued key pattern `(pseudo: string) => string` consistent with existing lobby.need_players
  - players_hint updated to recommended/conseillé phrasing (D-15) — string-only change, app/page.tsx unchanged
metrics:
  duration: "~7 min"
  completed: "2026-06-10T15:47:04Z"
  tasks_completed: 3
  files_modified: 2
---

# Phase 03 Plan 02: i18n Strings + Presence Constants Summary

String-only and constant-only leaf changes: 3 new i18n keys across 4 language dictionaries, updated `players_hint` copy, and reduced presence grace/heartbeat constants with last-player room deletion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add new i18n keys (D-02, D-10, D-14) | 16f49aa | lib/i18n.ts |
| 2 | Update landing players_hint copy (D-15) | 16f49aa | lib/i18n.ts |
| 3 | Reduce presence grace/heartbeat + room deletion (D-04, D-06, D-05) | 94b4b01 | lib/usePresence.ts |

## Changes Summary

### lib/i18n.ts

Three new keys added to all 4 language dictionaries (`fr`, `en`, `es`, `de`):

**join.pseudo_taken** — error shown when a player attempts to join with a pseudo already in use in the room (triggers on Postgres error code 23505). Used by Plan 04 (join page).

**join.pseudo_prefilled_hint** — hint shown below the pseudo input when the player's previous name is pre-populated. Used by Plan 04 (join page).

**game.player_joined** — function-valued key `(pseudo: string) => string`, follows the existing `lobby.need_players` pattern. Used by Plan 05 (game page toast).

**landing.players_hint** — updated from "3 à/to/a/bis 10" phrasing to "Conseillé/Recommended/Recomendado/Empfohlen" phrasing (SC-9). No change to `app/page.tsx` — it renders `fr.landing.players_hint` via the i18n hook.

### lib/usePresence.ts

- `GRACE_MS`: 60_000 → 15_000 — covers phone screen-lock + unlock within 15s without pruning; closed tab pruned after 15s (D-04/D-06)
- `HEARTBEAT_MS`: 120_000 → 30_000 — fresher presence signal
- Room auto-deletion block added inside prune setTimeout callback: after deleting a ghost player row, checks remaining player count and deletes the room if `count === 0` (D-05)

## Deviations from Plan

### Auto-added: Room auto-deletion in usePresence.ts

The PLAN.md task 3 explicitly requested room deletion when the last player is pruned (D-05). The PATTERNS.md suggested placing this in `onQuit` instead, but the PLAN.md task description is authoritative and was followed. The implementation uses the roomId closure variable already available in the hook, with a `count: 'exact', head: true` query to check remaining players before deleting the room.

## Known Stubs

None — this plan contains no UI stubs. All strings are fully translated in all 4 languages.

## Threat Flags

None — this plan modifies only string constants and timing constants. No new network endpoints, auth paths, or trust boundary changes.

## Self-Check: PASSED

- lib/i18n.ts exists: FOUND
- lib/usePresence.ts exists: FOUND
- Commit 16f49aa: FOUND
- Commit 94b4b01: FOUND
- `pseudo_taken` appears 4 times in lib/i18n.ts: VERIFIED
- `pseudo_prefilled_hint` appears 4 times in lib/i18n.ts: VERIFIED
- `player_joined` appears 4 times in lib/i18n.ts: VERIFIED
- `3 à 10 joueurs` no longer in lib/i18n.ts: VERIFIED
- `GRACE_MS = 15_000` in lib/usePresence.ts: VERIFIED
- `HEARTBEAT_MS = 30_000` in lib/usePresence.ts: VERIFIED
- `60_000` / `120_000` absent from lib/usePresence.ts: VERIFIED
- `count === 0` room deletion in prune callback: VERIFIED
- `npm run build` passed: VERIFIED
