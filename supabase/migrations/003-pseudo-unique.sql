-- supabase/migrations/003-pseudo-unique.sql
-- Phase 03: Unicité du pseudo par room (insensible à la casse).
-- Empêche deux joueurs dans la même room d'avoir le même pseudo,
-- quelle que soit la casse ("Nico" et "nico" sont le même pseudo).
--
-- Utilise CREATE UNIQUE INDEX et non ALTER TABLE car PostgreSQL
-- ne supporte pas les contraintes UNIQUE basées sur des expressions.
-- L'index est scopé à (room_id, LOWER(pseudo)) — deux rooms différentes peuvent
-- chacune avoir un joueur "Nico".
--
-- Idempotent : l'exécuter plusieurs fois ne produit aucune erreur.
-- L'erreur Postgres renvoyée en cas de violation est 23505 (unique_violation).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'players'
      AND indexname = 'idx_players_pseudo_lower'
  ) THEN
    CREATE UNIQUE INDEX idx_players_pseudo_lower
      ON players (room_id, LOWER(pseudo));
  END IF;
END $$;
