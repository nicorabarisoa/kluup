-- supabase/migrations/005-stats-columns.sql
-- Additive-only migration. Safe to run on a live prod DB.
-- Existing rows are unaffected: new columns default to NULL.
-- Does NOT modify any RLS rule (avoids the user_session_stats silent-lockout regression).

ALTER TABLE user_session_stats
  ADD COLUMN IF NOT EXISTS theme         text,
  ADD COLUMN IF NOT EXISTS rounds_played int,
  ADD COLUMN IF NOT EXISTS tag_scores    jsonb;
