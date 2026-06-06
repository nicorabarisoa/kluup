-- Kluup — RLS policies for rooms & players (MVP: fully open for anon)
-- Run this in the Supabase SQL editor if join says "Room introuvable"
-- despite the room having just been created.
--
-- Symptom: SELECT on rooms returns 0 rows for anon users → RLS is active
-- but no SELECT policy exists. INSERT/UPDATE/DELETE have the same problem.
--
-- === rooms ================================================================

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;

CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (true);

-- === players ==============================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_select" ON players;
DROP POLICY IF EXISTS "players_insert" ON players;
DROP POLICY IF EXISTS "players_update" ON players;
DROP POLICY IF EXISTS "players_delete" ON players;

CREATE POLICY "players_select" ON players FOR SELECT USING (true);
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_update" ON players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "players_delete" ON players FOR DELETE USING (true);
