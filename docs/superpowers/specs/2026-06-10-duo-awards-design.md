# Design — Système de relations & duo awards

**Date :** 2026-06-10
**Approche choisie :** B — multi-métriques avec awards nommés
**Statut :** Approuvé, prêt pour implémentation

---

## 1. Contexte

À la fin d'une session, une **slide de duos** révèle les paires les plus marquantes de la soirée — ceux qui se regardent, s'affrontent, pensent pareil ou font les 400 coups ensemble. Affiché sur la **face 1 de la carte de partage** (côté groupe), visible par tous.

Aucune dépendance sur les comptes — fonctionne en session uniquement, calculé côté client depuis les votes de la room.

---

## 2. Métriques par paire

Pour chaque paire (A, B), calculées depuis la table `votes` en fin de partie :

| Métrique | Source | Description |
|---|---|---|
| `mutual_designations` | votes Type A | Rounds où A a désigné B ET B a désigné A |
| `vote_alignment` | votes Type A | Rounds où A et B ont voté pour le même joueur |
| `opposition` | votes Type A | Rounds où A désigne B mais pas l'inverse (ou vice versa) |
| `confession_overlap` | votes Type B (`answer='oui'`) | Questions où A et B ont tous les deux dit "oui" |
| `co_volunteers` | votes Type C (`vote_type='volunteer'`) | Rounds où A et B se sont tous les deux portés volontaires |

### Score composite par award

- **Magnétisme Suspicieux** : `mutual_designations`
- **Même longueur d'onde** : `vote_alignment`
- **Les Ennemis Jurés** : `opposition`
- **Les Complices** : `confession_overlap + co_volunteers`

---

## 3. Awards

| Award | Emoji | Condition |
|---|---|---|
| **Magnétisme Suspicieux** | 🧲 | Paire avec le plus de `mutual_designations` |
| **Même longueur d'onde** | 🧠 | Paire avec le plus de `vote_alignment` |
| **Les Ennemis Jurés** | ⚔️ | Paire avec le plus de `opposition` |
| **Les Complices** | 🔥 | Paire avec le plus de `confession_overlap + co_volunteers` |

### Règles d'attribution

1. **Seuil minimum** : score ≥ 2 pour décerner l'award (évite les faux positifs sur 3 rounds)
2. **Award non affiché** si seuil non atteint (jamais forcé)
3. **Slide omise** si moins de 2 awards décernés
4. **Variété préférée** : si deux paires ont le même score sur un award, préférer celle qui n'a pas encore d'award

---

## 4. Algorithme (côté client, phase `ended`)

```
1. Fetch tous les votes de la room : supabase.from('votes').select().eq('room_id', roomId)
2. Pour chaque paire unique de joueurs (A, B) :
   - Calculer les 5 métriques
3. Pour chaque award :
   - Trouver la paire avec le score max
   - Vérifier seuil minimum
   - Appliquer la règle de variété
4. Construire la liste des awards décernés (0 à 4)
```

Une seule requête Supabase, pas de nouvelle table.

---

## 5. Carte de partage — 2 faces

La carte actuelle devient une carte **2 faces**, basculement par tap/swipe.

### Face 1 — Groupe (identique pour tous)
```
┌─────────────────────────────┐
│  [Titre du groupe]          │
│                             │
│  🧲 Magnétisme Suspicieux   │
│     Nico & Sarah            │
│                             │
│  🧠 Même longueur d'onde    │
│     Léa & Thomas            │
│                             │
│  ⚔️  Les Ennemis Jurés       │
│     Jules & Paul            │
│                             │
│  🔥 Les Complices           │
│     Nico & Léa              │
└─────────────────────────────┘
```

### Face 2 — Perso (par joueur)
```
┌─────────────────────────────┐
│  [Stats perso existantes]   │
│  ─────────────────────────  │
│  LE FARCEUR                 │
│  drôle     ████████░░  45%  │
│  audacieux ██████░░░░  30%  │
│  empathique███░░░░░░░  25%  │
└─────────────────────────────┘
```

### Comportement
- Tap n'importe où sur la carte pour basculer
- `modern-screenshot` capture la face visible → 2 images distinctes si l'utilisateur bascule avant de partager
- Bouton "Partager" exporte la face actuellement affichée
- Face 1 générée une fois pour la room, Face 2 calculée par joueur

---

## 6. i18n

Noms des awards + labels ajoutés aux dictionnaires `fr`/`en`/`es`/`de` dans `lib/i18n.ts` :

| Clé | FR | EN |
|---|---|---|
| `award_magnetisme` | Magnétisme Suspicieux | Suspicious Magnetism |
| `award_longueur_onde` | Même longueur d'onde | Same Wavelength |
| `award_ennemis` | Les Ennemis Jurés | Sworn Enemies |
| `award_complices` | Les Complices | Partners in Crime |
| `awards_title` | Les duos de la soirée | Tonight's Duos |

---

## 7. Cas limites

| Cas | Comportement |
|---|---|
| 2 joueurs seulement | Peu de paires → awards potentiellement limités, slide affichée si ≥ 2 awards |
| Partie très courte (3 rounds) | Seuil minimum filtre les awards peu significatifs |
| Tout le monde vote pareil | `vote_alignment` partagé → règle variété s'applique |
| Un joueur rejoint en cours de partie | Ses votes sont comptés normalement depuis la table |

---

## 8. Livraison

- Migration SQL : aucune (réutilise `votes`)
- Algorithme duo awards côté client
- Refacto carte de partage : 2 faces avec basculement tap
- i18n des 4 awards
- Dépendance avec feature archétypes : les 2 features partagent la Face 2 de la carte — à implémenter ensemble ou en séquence
