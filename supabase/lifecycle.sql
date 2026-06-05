-- Kluup — Room lifecycle / cleanup
-- Run this once in the Supabase SQL editor.
--
-- Strategy (cf. design):
--   1. Immediate cleanup is handled in the APP: when a player quits, if they
--      were the host the role passes to the next joiner; when the last player
--      leaves, the room is deleted. Votes/players cascade away with the room.
--   2. This script is the SAFETY NET for rooms nobody cleaned up explicitly
--      (everyone just closed their tab): abandoned lobbies, crashed games, etc.

-- ---------------------------------------------------------------------------
-- 1. Make deleting a room wipe its players too (votes already cascade).
--    Supabase auto-names the FK players_room_id_fkey; recreate it with CASCADE.
-- ---------------------------------------------------------------------------
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_id_fkey;
ALTER TABLE players
  ADD CONSTRAINT players_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Track activity so live games are never swept mid-session.
--    Every game action writes game_state (an UPDATE on rooms) → bumped here.
-- ---------------------------------------------------------------------------
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION rooms_bump_activity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_activity = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rooms_bump_activity ON rooms;
CREATE TRIGGER trg_rooms_bump_activity
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION rooms_bump_activity();

-- ---------------------------------------------------------------------------
-- 3. Sweep: delete rooms idle for more than 3h. players + votes cascade away.
--    Returns how many rooms were removed (handy when running it by hand).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_dead_rooms()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  n integer;
BEGIN
  WITH dead AS (
    DELETE FROM rooms
    WHERE COALESCE(last_activity, created_at) < now() - interval '3 hours'
    RETURNING id
  )
  SELECT count(*) INTO n FROM dead;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Schedule it hourly with pg_cron.
--    If the CREATE EXTENSION line errors, enable pg_cron first via
--    Dashboard → Database → Extensions, then re-run from the cron.schedule line.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-running with the same job name updates the existing schedule.
SELECT cron.schedule('cleanup-dead-rooms', '0 * * * *', $$SELECT cleanup_dead_rooms()$$);

-- To run the sweep immediately once:  SELECT cleanup_dead_rooms();
-- To inspect scheduled jobs:          SELECT * FROM cron.job;
-- To remove the schedule:             SELECT cron.unschedule('cleanup-dead-rooms');
