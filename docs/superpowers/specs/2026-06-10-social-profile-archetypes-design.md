# Design — Système de profil social & archétypes

**Date :** 2026-06-10
**Approche choisie :** C — livraison en 2 temps (session maintenant, cross-session en Phase 5)
**Statut :** Approuvé, prêt pour implémentation

---

## 1. Contexte

À la fin d'une partie Kluup, chaque joueur reçoit un **archétype personnel** calculé depuis ses comportements en jeu (désignations reçues, confessions, volontariats). L'archétype et la répartition de ses traits s'affichent sur la carte de partage.

Les joueurs sans compte voient leur archétype de session uniquement. Les joueurs avec compte accumulent un archétype global cross-session (Phase 5).

---

## 2. Data model

### 2.1 Champ `tags` sur `questions`

```sql
ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb;
```

Format : tableau d'objets `{"tag": string, "points": number}`. Les points peuvent être **négatifs**.

```json
[{"tag": "drôle", "points": 2}, {"tag": "fiable", "points": -1}]
```

### 2.2 Les 6 traits

| Clé | FR | EN | ES | DE |
|---|---|---|---|---|
| `drole` | Drôle | Funny | Gracioso | Lustig |
| `fiable` | Fiable | Reliable | Confiable | Zuverlässig |
| `audacieux` | Audacieux | Bold | Audaz | Mutig |
| `empathique` | Empathique | Empathetic | Empático | Einfühlsam |
| `mysterieux` | Mystérieux | Mysterious | Misterioso | Geheimnisvoll |
| `romantique` | Romantique | Romantic | Romántico | Romantisch |

### 2.3 Extension Phase 5 — `user_session_stats`

Lors de la Phase 5 (stats persistence), ajouter un champ `tag_scores jsonb` à `user_session_stats` :

```json
{"drole": 5, "fiable": 3, "audacieux": -1, "empathique": 4, "mysterieux": 0, "romantique": 2}
```

L'archétype global = somme des `tag_scores` sur toutes les sessions du compte.

---

## 3. Attribution des points par type de question

| Type | Qui reçoit les points |
|---|---|
| A | Joueur(s) dans `designated_player_ids` (tie inclus) |
| B | Joueur ayant voté "oui" (lu depuis ses propres votes en base) |
| C volontaires (`round_c_volunteers_reveal`) | Joueurs dans `volunteer_player_ids` |
| C roulette (`round_c_roulette`) | Joueur dans `designated_player_id` |

Les points peuvent être positifs ou négatifs. Un joueur ne peut pas voir les traits des autres.

---

## 4. Algorithme de calcul (session, côté client)

1. En phase `ended`, fetch `votes WHERE player_id = myId AND room_id = roomId`
2. Pour chaque question dans `game_state.played_question_ids` :
   - Récupérer les tags de la question (chargés avec les candidates)
   - Déterminer si le joueur était "acteur" du round (cf. tableau ci-dessus)
   - Si oui : ajouter les points de chaque tag au score du joueur
3. Par trait : `floor(score, 0)` (les scores négatifs passent à 0 pour l'affichage)
4. Total = somme de tous les scores positifs
5. Si total = 0 → archétype "Une simple personne"
6. Sinon : calculer le % de chaque trait → déterminer l'archétype (cf. section 5)

---

## 5. Archétypes

### 5.1 Seuils

- **Simple** : un trait représente > 50 % du total
- **Hybride** : les 2 premiers traits sont à moins de 15 % d'écart ET tous deux > 25 %
- **Fallback** : aucune des conditions ci-dessus → "Une simple personne"

### 5.2 Table complète

#### Archétypes simples (trait unique dominant)

| Trait dominant | Archétype | Ton |
|---|---|---|
| drole | Le Farceur | Espiègle, complice |
| fiable | Le Confident | Chaleureux, rassurant |
| audacieux | Le Leader | Direct, charismatique |
| empathique | Le Diplomate | Doux, à l'écoute |
| mysterieux | Le Mystérieux | Énigmatique, intrigant |
| romantique | Le Romantique | Tendre, idéaliste |

#### Archétypes hybrides (deux traits co-dominants)

| Traits | Archétype | Ton |
|---|---|---|
| drole + audacieux | L'Agitateur | Provocateur, électrique |
| drole + empathique | L'Âme de la fête | Chaleureux, magnétique |
| drole + mysterieux | Le Joker | Imprévisible, déconcertant |
| drole + fiable | Le Clown Fidèle | Fun mais toujours là |
| drole + romantique | Le Séducteur Maladroit | Attendrissant, sincère |
| fiable + empathique | Le Pilier | Ancrage du groupe |
| fiable + audacieux | Le Capitaine | Fiable sous pression |
| fiable + romantique | L'Amoureux Loyal | Solide, profond |
| audacieux + mysterieux | Le Loup Solitaire | Indépendant, magnétique |
| audacieux + romantique | Le Séducteur | Assumed, intense |
| audacieux + empathique | Le Protecteur | Fort mais attentionné |
| empathique + romantique | Le Rêveur | Sensible, poète |
| empathique + mysterieux | L'Ombre Bienveillante | Discret mais présent |
| mysterieux + romantique | L'Inaccessible | Fascinant, distant |
| mysterieux + fiable | Le Gardien | Sûr mais impénétrable |

#### Fallback

| Condition | Archétype |
|---|---|
| Profil équilibré / trop peu de points | Une simple personne |

### 5.3 i18n

Chaque clé d'archétype est ajoutée aux dictionnaires `fr`/`en`/`es`/`de` dans `lib/i18n.ts`.
Format : `archetype_le_farceur`, `archetype_lagitateur`, etc.

---

## 6. Affichage — carte de partage

Bloc ajouté sous les stats perso existantes :

```
─────────────────────────────
LE FARCEUR
drôle      ████████░░  45%
audacieux  ██████░░░░  30%
empathique ███░░░░░░░  25%
```

- Afficher les **3 traits les plus élevés** (avec % et barre)
- Afficher uniquement si total de points > 0
- Nom de l'archétype en majuscules, typographie display (Bricolage Grotesque)
- Barres colorées selon le trait (palette à définir lors de l'implémentation)

---

## 7. Tagging des questions existantes

Tâche de curation : relire toutes les questions en base et assigner les tags appropriés.
À faire par Claude avant l'implémentation du feature (script SQL ou update manuel).

Règles de tagging :
- 1 à 3 tags par question
- Les points reflètent l'intensité du trait (1 = léger, 2 = modéré, 3 = fort)
- Les points négatifs pour les questions qui "contredisent" un trait (ex. une question sur la maladresse sociale enlève des points `fiable`)
- Les questions Type A taguent le trait projeté sur la personne désignée
- Les questions Type B taguent le trait que le joueur s'attribue à lui-même
- Les questions Type C taguent le courage/l'empathie des volontaires

---

## 8. Livraison

### Phase actuelle (Approche C — étape 1)
- Migration SQL : `ALTER TABLE questions ADD COLUMN tags`
- Tagging des questions existantes (curation)
- Algorithme de calcul côté client (fin de partie)
- Ajout de l'archétype + traits sur la carte de partage
- i18n de tous les archétypes (FR/EN/ES/DE)

### Phase 5 (étape 2 — différé)
- Champ `tag_scores jsonb` dans `user_session_stats`
- Calcul et écriture des scores au moment de la sauvegarde des stats
- Page `/profile` : archétype global + évolution par session
- CTA "connecte-toi pour voir ton archétype évoluer" sur l'écran de fin (joueurs anonymes)
