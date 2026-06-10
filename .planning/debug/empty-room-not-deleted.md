---
status: diagnosed
trigger: "SC-3 failed: room with zero connected players should be auto-deleted after grace period. Actual: room still joinable after 15s, host role not transferred, player not removed from roster."
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. When ALL clients leave by closing tabs, no surviving client runs the elected-pruner setTimeout callback in lib/usePresence.ts. The prune+room-delete logic lives entirely inside surviving-client setTimeout callbacks. There is NO beforeunload/pagehide handler doing a DB write on tab close, and the only server-side reaper (cleanup_dead_rooms) is opportunistic (fires only on room creation) and uses a 30-minute threshold, not 15s. SC-3 (tab-close path) is NOT achievable client-side.
test: Done — read usePresence.ts, both onQuit paths, lifecycle.sql, grep for tab-close handlers + cleanup_dead_rooms callers.
expecting: Confirmed.
next_action: Return diagnosis (find_root_cause_only mode — do not fix).

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: In a 2-player game, both players quit/close tabs. After >15s the room no longer exists (join attempt on the code fails / DB row gone).
actual: "not passed — room still joinable after 15s, host role not transferred, player not removed from the roster" (UAT test 3)
errors: None reported
reproduction: Test 3 in .planning/phases/03-playtest-quality-fixes/03-UAT.md — 2-player game, both close tabs, wait >15s, attempt to join code.
started: Discovered during Phase 03 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-10T00:05:00Z
  checked: lib/usePresence.ts lines 43-57 (presence 'leave' handler + prune callback)
  found: On a peer's 'leave' event, a SURVIVING client schedules setTimeout(GRACE_MS=15000). The callback (lines 46-56) deletes the ghost player row, then if count===0 deletes the room. The callback runs inside the scheduling client's JS runtime. The handler explicitly `return`s for `key === myId` (line 44) — a client never schedules its own prune.
  implication: The prune is driven by OTHER clients observing my departure. The last departing client has no observer left to run its prune.

- timestamp: 2026-06-10T00:06:00Z
  checked: lib/usePresence.ts lines 72-79 (effect cleanup / unmount)
  found: On unmount the only actions are clearInterval(hb), clearTimeout of all pending prunes, timers.clear(), and supabase.removeChannel(channel). NO DB delete of the player row or room happens on teardown.
  implication: Navigating away / unmounting does NOT remove the player from the DB. Local cleanup only.

- timestamp: 2026-06-10T00:07:00Z
  checked: grep for beforeunload|pagehide|visibilitychange|addEventListener across all .ts/.tsx
  found: NO beforeunload, pagehide, or visibilitychange handler exists anywhere in the app. The only addEventListener is a mousedown listener in lib/locale.tsx (LangSwitch dropdown) — unrelated.
  implication: Closing a tab triggers ZERO database writes. No player-row removal, no room deletion, no host transfer on tab close.

- timestamp: 2026-06-10T00:08:00Z
  checked: supabase/lifecycle.sql cleanup_dead_rooms() (lines 45-58) + grep for cleanup_dead_rooms callers
  found: cleanup_dead_rooms() deletes rooms WHERE last_activity < now() - interval '30 minutes'. It is only invoked from app/page.tsx:55 (createRoom) as fire-and-forget opportunistic maintenance. There is no pg_cron schedule active (commented out, lines 68-71). So the sweep only runs when SOMEONE creates a room from the landing page, and only reclaims rooms idle 30+ minutes.
  implication: The server-side safety net (a) does not run on any short interval, and (b) uses a 30-min threshold. It can never satisfy a ">15s the room is gone" expectation. After 15s the room is fully intact and joinable.

- timestamp: 2026-06-10T00:09:00Z
  checked: onQuit in app/room/[code]/game/page.tsx (1879-1900) and app/room/[code]/lobby/page.tsx (124-142)
  found: The explicit "Quitter" button path DOES correctly handle everything: deletes own player row, and if remaining===0 deletes the room, else if wasHost promotes the earliest remaining joiner. SC-3 expectation is fully met IF players click Quitter.
  implication: The mechanism works only on explicit quit. Test 3 ("both players quit/close tabs") fails specifically on the tab-CLOSE variant, which exercises the presence path, not onQuit. SC-2 passing (single tab close pruned by a surviving peer) is consistent: there a peer survived to run the prune; SC-3 has no survivor.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  The room/ghost cleanup for the tab-close path is entirely client-side and driven by SURVIVING peers. In lib/usePresence.ts the prune+room-delete logic runs inside a setTimeout(GRACE_MS) scheduled by an OTHER connected client when it observes a peer's presence 'leave' (the handler returns early for key===myId, so a client never schedules its own prune). When ALL clients leave (both tabs closed, as in SC-3), there is no surviving JS runtime to fire any prune timeout, so: (1) the departed player rows are never deleted, (2) is_host is never transferred, and (3) the room row is never deleted — exactly the three reported symptoms. Compounding this, there is NO beforeunload/pagehide/visibilitychange handler anywhere, so tab close performs zero DB writes. The only server-side reaper, cleanup_dead_rooms(), is opportunistic (only fires when a new room is created from app/page.tsx) and uses a 30-minute idle threshold — it cannot satisfy a ">15s the room is gone" expectation. CONCLUSION: SC-3's tab-close scenario is NOT achievable with the current client-only design. It requires a server-side mechanism running on a short interval (e.g. cleanup_dead_rooms via pg_cron at ~minutely, after lowering its threshold to match the grace window), and/or a best-effort beforeunload/pagehide handler to remove the row on close.
fix: (not applied — find_root_cause_only mode; gap planning handles the fix)
verification: (n/a — diagnosis only)
files_changed: []
