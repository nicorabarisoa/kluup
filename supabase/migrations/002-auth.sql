-- supabase/migrations/002-auth.sql
-- Additive-only migration. Safe to run on a live prod DB.
-- Existing rows are unaffected: new columns default to NULL.
-- Does NOT alter any existing policy on rooms, players, or votes.
-- Does NOT modify the host_id column.

-- IDEN-01: nullable user_id FK on players
-- Allows linking a player row to a Supabase Auth user (optional — stays NULL for anon players).
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- STAT-03 (Phase 4): user_session_stats table
-- Persists per-user game stats across sessions for signed-in players.
-- session_id sources from game_state.session_uuid (set in plan 02-03).
CREATE TABLE IF NOT EXISTS user_session_stats (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id        uuid        NOT NULL,
  designated_count  int         NOT NULL DEFAULT 0,
  confessed_count   int         NOT NULL DEFAULT 0,
  volunteered_count int         NOT NULL DEFAULT 0,
  group_title       text,
  played_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_session_stats_unique UNIQUE (user_id, session_id)
);

ALTER TABLE user_session_stats ENABLE ROW LEVEL SECURITY;

-- Scoped RLS: each user can only read/write their own stats rows.
DROP POLICY IF EXISTS "stats_select_own" ON user_session_stats;
DROP POLICY IF EXISTS "stats_insert_own" ON user_session_stats;
DROP POLICY IF EXISTS "stats_update_own" ON user_session_stats;

CREATE POLICY "stats_select_own" ON user_session_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "stats_insert_own" ON user_session_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stats_update_own" ON user_session_stats
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
