# Phase 3: Playtest Quality Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 03-playtest-quality-fixes
**Areas discussed:** Pseudo unique, Déconnexion joueur, Timer au refresh, Joueur qui rejoint en plein round

---

## Pseudo Unique

| Option | Description | Selected |
|--------|-------------|----------|
| Bloqué + message clair | "Ce pseudo est déjà pris, choisis-en un autre." | ✓ |
| Auto-suffixe numéroté | "Nico" devient "Nico 2" automatiquement | |
| Case-insensitive uniquement | "Nico" et "nico" comptent comme le même | |

**Validation :**

| Option | Description | Selected |
|--------|-------------|----------|
| Serveur uniquement via Supabase | UNIQUE constraint ou check sur players(room_id, pseudo) | ✓ |
| Client + Supabase comme filet | Vérification rapide côté client + contrainte DB en backup | |

**Casse :**

| Option | Description | Selected |
|--------|-------------|----------|
| Insensible à la casse | Stocker en lowercase en DB ou utiliser LOWER() | ✓ |
| Sensible à la casse | "Nico" et "nico" sont distincts | |

**Notes:** Contrainte scoped à `room_id` — pas de unicité globale.

---

## Déconnexion Joueur / Présence

| Option | Description | Selected |
|--------|-------------|----------|
| Grace period 15s | Retrait en 15s. Verrouillage écran : heartbeat reprend si rouvert à temps | ✓ |
| Grace period 60s (actuelle) | Confort maximal phone-lock | |
| Instant desktop / 30s mobile | Détecter user agent | |

**Suppression room :**

| Option | Description | Selected |
|--------|-------------|----------|
| Suppression immédiate | Plus de joueurs = room supprimée (cascade) | ✓ |
| Suppression après délai (5min) | Fenêtre de rejoin même si tout le monde est parti | |

**Notes:** `cleanup_dead_rooms()` (TTL 30min) reste en place comme filet de sécurité.

---

## Timer au Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Les deux : round_started_at + votes préservés | Ajouter round_started_at dans game_state. Fix complet. | ✓ |
| Votes préservés seulement | Timer repart à 30s (approximatif). Fix partiel. | |

**Notes:** `round_started_at` initialisé à `''` dans `makeInitialGameState()`, rempli à chaque début de phase de vote.

---

## Joueur qui Rejoint en Plein Round

| Option proposée | Description | Selected |
|-----------------|-------------|----------|
| Snapshot du seuil | Threshold calculé au début du round — nouveau joueur n'affecte pas | |
| Bloquer le join | Impossible de rejoindre pendant un vote | |
| Adaptation dynamique | Comportement actuel bugué | |
| **Réponse libre** | Le joueur rejoint mais ne vote pas sur la manche en cours ; attend la suivante | ✓ |

**User's choice (verbatim):** "le joueur rejoint mais ne peux pas voter sur cette manche attendre la prochaine manche pour pouvoir voter et participer à tout. Ajouter aussi une notification à tout les autre joueur comme quoi [pseudo] a rejoint la partie"

**Notes:** Stocker `vote_round_player_count` dans `game_state` au début de chaque phase de vote. Notification broadcast `player_joined` sur le canal existant.

---

## Claude's Discretion

- SQL migration : `supabase/migrations/003-pseudo-unique.sql` + update `schema.sql`
- Placement de `vote_round_player_count` et `round_started_at` dans `GameState`
- Shape du broadcast `player_joined` : `{ type: 'player_joined', pseudo: string }`
- Style de la notification join : toast non-bloquant (~3s)

## Deferred Ideas

Aucune — discussion restée dans le scope de la phase.
