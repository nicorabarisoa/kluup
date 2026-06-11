# Phase 5: Stats Persistence + Profile - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 05-stats-persistence-profile
**Areas discussed:** Écriture des stats, CTA + sauvegarde rétroactive, Données par session, Archétype sans tags (v2)

---

## Écriture des stats

| Option | Description | Selected |
|--------|-------------|----------|
| Perdues | Pas d'écran de fin = pas de stats — simple, prévisible | ✓ |
| Write au quit explicite | Le bouton « Quitter » écrit des stats partielles | |
| Récupérable en rejoignant | Retour avant TTL → write standard (nuance conservée gratuitement) | |

**User's choice:** Perdues (quit avant fin = pas de stats pour cette session)

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, toujours | « Terminer la session » mène au même écran de fin — même trajet | ✓ |
| Seulement si ≥3 manches | Seuil minimum anti fausses parties | |
| Non, parties complètes only | Seules les parties au bout des manches comptent | |

**User's choice:** Fin anticipée → stats sauvegardées quand même

---

## CTA + sauvegarde rétroactive

| Option | Description | Selected |
|--------|-------------|----------|
| Retour fin + sauvegarde rétro | next=/room/CODE/game, détection « connecté + ended + pas de row » → sauve la session jouée | ✓ |
| Retour fin, futures only | Revient sur l'écran de fin mais session non sauvée | |
| Retour landing | Comportement D-04 d'origine | |

**User's choice:** Retour écran de fin + sauvegarde rétroactive de la session courante
**Notes:** S'appuie sur le mécanisme `?next=` ajouté à `/auth/callback` le 2026-06-12 (fix CR-03), qui remplace la décision D-04 de la phase 4.

---

## Données par session

| Option | Description | Selected |
|--------|-------------|----------|
| theme + rounds_played | « Unmasked · 7 manches · 12 juin » — deux colonnes légères | ✓ |
| theme seulement | Le thème suffit | |
| Rien | Table actuelle suffisante | |
| theme + rounds + pseudo | Ajouter aussi le pseudo du soir | |

**User's choice:** theme + rounds_played

| Option | Description | Selected |
|--------|-------------|----------|
| 20 dernières | Limite simple sans pagination ; cumul = tout l'historique | ✓ |
| Toutes | Pas de limite | |
| 10 + « voir plus » | Bouton de chargement | |

**User's choice:** 20 dernières sessions affichées

---

## Archétype sans tags (v2)

| Option | Description | Selected |
|--------|-------------|----------|
| Masqué si total = 0 | Colonne + accumulation + affichage livrés, bloc caché tant que vide | ✓ |
| Teaser « à venir » | Bloc grisé créant de l'attente | |
| Avancer la curation | Tagger les questions dès cette phase (scope v3.0) | |

**User's choice:** Masqué si total = 0 — s'allume automatiquement quand la v3.0 taggera les questions

---

## Claude's Discretion

Zones supplémentaires proposées (feedback du write, liaison compte↔joueur, affichage des titres cumulés, Realtime >1h) — réponse « pas de préférence » → tranchées par Claude :
- Feedback write : ligne discrète « Stats sauvegardées ✓ », échec silencieux (jamais bloquant)
- Liaison : `user_id` posé sur la ligne `players` au retour OAuth ; room morte → abandon silencieux
- Titres cumulés : badges distincts ×N dans le cumul, titre par session dans l'historique
- Realtime JWT >1h : silencieux auto, mécanisme exact choisi par le researcher

## Deferred Ideas

- Curation des tags + activation archétype — v3.0
- Pagination au-delà de 20 sessions — si besoin réel
- Stats par thème sur le profil (rendu possible par la colonne `theme`) — v3+
