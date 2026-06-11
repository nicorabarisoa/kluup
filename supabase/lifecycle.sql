-- Kluup — Room lifecycle / cleanup
-- Run this once in the Supabase SQL editor.
--
-- Strategy (cf. design):
--   1. Immediate cleanup is handled in the APP: when a player quits, if they
--      were the host the role passes to the next joiner; when the last player
--      leaves, the room is deleted. Votes/players cascade away with the room.
--   2. This script is the SAFETY NET for rooms nobody cleaned up explicitly
--      (everyone just closed their tab): abandoned lobbies, crashed games, etc.
--
-- The 4 blocks below are independent — you can run them one at a time if the
-- editor complains about multiple statements.

-- === Block 1 ================================================================
-- Make deleting a room wipe its players too (votes already cascade).
-- Supabase auto-names the FK players_room_id_fkey; recreate it with CASCADE.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_id_fkey;
ALTER TABLE players
  ADD CONSTRAINT players_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

-- === Block 2 ================================================================
-- Track activity so live games are never swept mid-session.
-- Every game action writes game_state (an UPDATE on rooms) → bumped here.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms (last_activity);

CREATE OR REPLACE FUNCTION rooms_bump_activity()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.last_activity = now();
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_rooms_bump_activity ON rooms;
CREATE TRIGGER trg_rooms_bump_activity
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION rooms_bump_activity();

-- === Block 3 ================================================================
-- Sweep: delete rooms with no connected client for ~90 seconds. players + votes
-- cascade away. Connected clients refresh last_activity via the presence
-- heartbeat (HEARTBEAT_MS = 30s in lib/usePresence.ts); 90s = 3× the heartbeat
-- interval, giving a safe 60s margin against delayed heartbeats. Active rooms
-- are never swept mid-session; only truly-abandoned rooms age past the threshold.
-- Returns how many rooms were removed.
--
-- NOTE: The ~60s threshold means SC-3 ("room auto-deleted") has an acceptance
-- window of ~1 min (the pg_cron sweep interval), not >15s. This is the locked
-- approach (user, 2026-06-10): server-side sweep instead of client-side beacon.
CREATE OR REPLACE FUNCTION cleanup_dead_rooms()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  n integer;
BEGIN
  WITH dead AS (
    DELETE FROM rooms
    WHERE COALESCE(last_activity, created_at) < now() - interval '90 seconds'
    RETURNING id
  )
  SELECT count(*) INTO n FROM dead;
  RETURN n;
END
$fn$;

-- === Block 4 ================================================================
-- Expose the sweep so the app can trigger it. The app calls this RPC on room
-- creation (opportunistic cleanup) — no pg_cron / extension required for the
-- opportunistic call; the scheduled sweep below handles the guaranteed cleanup.
GRANT EXECUTE ON FUNCTION cleanup_dead_rooms() TO anon, authenticated;

-- Run the sweep right now (optional sanity check; returns rooms removed):
--   SELECT cleanup_dead_rooms();

-- === Block 5 ================================================================
-- Fully automatic cleanup via pg_cron (REQUIRED for SC-3 guarantee).
-- pg_cron is available on Supabase Postgres — enable it under Database → Extensions
-- before running these statements. Run each statement ONE AT A TIME.
--
-- The cron expression '* * * * *' is every minute — the finest pg_cron
-- granularity. This is why SC-3's guarantee is "~1 min", not ">15s".
--
-- This block is idempotent: the unschedule guard removes a stale job before
-- re-creating it, so re-running this block does not create duplicate cron jobs.

-- Step 1: Enable pg_cron (run alone):
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Idempotent unschedule guard — safe no-op if job does not yet exist (run alone):
SELECT cron.unschedule('cleanup-dead-rooms') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-dead-rooms');

-- Step 3: Schedule the every-minute sweep (run alone):
SELECT cron.schedule('cleanup-dead-rooms', '* * * * *', 'SELECT cleanup_dead_rooms()');
