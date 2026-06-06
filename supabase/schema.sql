-- Kluup — SCHÉMA CANONIQUE (source de vérité, idempotent)
-- ============================================================================
-- Exécute CE fichier dans le SQL editor Supabase pour (re)provisionner une base
-- propre, OU pour réparer une base où "Room introuvable" apparaît à la jonction.
--
-- Pourquoi : l'ancien migration.sql ne CRÉAIT pas rooms/players (il supposait
-- qu'elles existaient déjà) et n'activait jamais leur RLS / realtime. Résultat :
-- si RLS est activé sur rooms sans policy SELECT anon (défaut courant du
-- dashboard quand on toggle RLS), le SELECT anon renvoie 0 ligne SANS erreur →
-- la room "existe puis disparaît". Ce fichier rend tout l'état explicite.
--
-- 100 % idempotent : sûr à ré-exécuter. N'insère AUCUNE question (cf seed.sql).
-- ============================================================================

-- === Tables ================================================================

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',   -- 'waiting' (lobby) | 'playing' | 'ended'
  theme text DEFAULT 'hello-stranger',
  game_state jsonb,
  host_id text,                             -- text (pas uuid) : genId() peut renvoyer un fallback non-uuid en contexte non-sécurisé (HTTP LAN)
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  pseudo text NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme text NOT NULL,
  type text NOT NULL CHECK (type IN ('A', 'B', 'C')),
  intensity int NOT NULL DEFAULT 1 CHECK (intensity BETWEEN 1 AND 3),
  question jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  round int NOT NULL DEFAULT 1,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  vote_type text NOT NULL, -- 'question_selection' | 'designation' | 'confession' | 'volunteer'
  target_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  answer boolean,
  question_index int,
  created_at timestamptz DEFAULT now(),
  UNIQUE (room_id, round, player_id, vote_type)
);

-- === Contraintes / defaults (réparation d'une base existante) ==============

-- Aligne le default de status sur 'waiting' (l'ancien migration mettait 'lobby').
ALTER TABLE rooms ALTER COLUMN status SET DEFAULT 'waiting';
UPDATE rooms SET status = 'waiting' WHERE status = 'lobby';

-- Garantit l'unicité du code de room (sinon .maybeSingle() casse sur doublon).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_code_key') THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_code_key UNIQUE (code);
  END IF;
END $$;

-- FK players → rooms en CASCADE (au cas où une base ancienne ne l'aurait pas).
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_id_fkey;
ALTER TABLE players
  ADD CONSTRAINT players_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

-- === RLS — MVP ouvert (anon a tous les droits) =============================
-- ⚠️ C'EST LE CORRECTIF DE "Room introuvable" : sans policy SELECT, anon ne
-- voit rien même si la row existe.

ALTER TABLE rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE players   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes     ENABLE ROW LEVEL SECURITY;

-- rooms
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (true);

-- players
DROP POLICY IF EXISTS "players_select" ON players;
DROP POLICY IF EXISTS "players_insert" ON players;
DROP POLICY IF EXISTS "players_update" ON players;
DROP POLICY IF EXISTS "players_delete" ON players;
CREATE POLICY "players_select" ON players FOR SELECT USING (true);
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_update" ON players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "players_delete" ON players FOR DELETE USING (true);

-- questions (lecture seule pour anon)
DROP POLICY IF EXISTS "questions_read" ON questions;
CREATE POLICY "questions_read" ON questions FOR SELECT USING (true);

-- votes
DROP POLICY IF EXISTS "votes_insert" ON votes;
DROP POLICY IF EXISTS "votes_select" ON votes;
DROP POLICY IF EXISTS "votes_delete" ON votes;
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (true);

-- === Realtime (postgres_changes) ==========================================
-- Lobby & jeu écoutent les changements de rooms ET players. Sans ça, les
-- joueurs n'apparaissent pas en temps réel et la navigation auto ne se fait pas.

DO $$
BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index utile au balayage de cycle de vie.
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms (last_activity);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players (room_id);

-- === Vérif rapide (décommente pour diagnostiquer) =========================
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('rooms','players','votes','questions');
--   SELECT * FROM pg_policies WHERE tablename IN ('rooms','players','votes','questions');
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
