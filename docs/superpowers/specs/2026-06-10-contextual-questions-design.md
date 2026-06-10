# Design — Mémoire de session & questions contextuelles

**Date :** 2026-06-10
**Approche choisie :** B — table séparée `contextual_questions` avec FK parent
**Statut :** Approuvé, prêt pour implémentation

---

## 1. Contexte

Entre deux manches, le jeu peut poser une **question contextuelle** — un follow-up sur un événement qui vient de se passer (une désignation, une confession, un volontariat). Ça donne l'impression d'un maître du jeu intelligent qui suit la partie.

La question contextuelle ne compte pas comme une manche. Elle s'affiche entre deux rounds, la personne ciblée répond à voix haute, l'hôte appuie "Continuer" pour relancer.

Fonctionne en session uniquement — aucune dépendance sur les comptes.

---

## 2. Data model

### 2.1 Table `contextual_questions`

```sql
CREATE TABLE contextual_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  template   jsonb NOT NULL  -- {fr: "...", en: "...", es: "...", de: "..."}
);
```

**Variables de template :**
- `{pseudo}` — pseudo du joueur ciblé
- `{question}` — texte de la question parent (dans la locale active)

Exemple :
```json
{
  "fr": "{pseudo}, tout à l'heure tout le monde t'a désigné — t'as quelque chose à nous avouer ?",
  "en": "{pseudo}, everyone just pointed at you — anything to confess?"
}
```

Plusieurs sous-questions possibles par question parent — une seule est tirée aléatoirement au déclenchement.

### 2.2 Nouveaux champs dans `GameState`

```ts
last_contextual_round: number | null   // round où la dernière contextuelle a été déclenchée
contextual_question: {
  template: string       // texte déjà résolu dans la locale active
  target_player_id: string
} | null
```

### 2.3 Nouvelle `GamePhase`

```ts
'contextual_question'  // insérée entre reveal et voting_question du round suivant
```

---

## 3. Logique de déclenchement

Déclenchement au moment où l'hôte appuie "Manche suivante" sur un écran de révélation.

### Courbe de probabilité

| Round | Probabilité |
|---|---|
| 1 | 0% |
| 2 | 10% |
| 3 | 20% |
| 4 | 30% |
| 5 | 40% |
| 6 | 50% |
| 7 | 60% |

Formule : `round === 1 ? 0 : (round - 1) * 0.10`

### Algorithme

```
1. prob = round === 1 ? 0 : (round - 1) * 0.10
2. Si last_contextual_round === round → prob = 0 (déjà déclenché)
3. Math.random() < prob ?
   OUI :
     - Parmi les questions jouées ayant des contextual_questions en base → pick aléatoire
     - Identifier le joueur ciblé (cf. tableau ci-dessous)
     - Tirer aléatoirement une sous-question parmi celles du parent
     - Résoudre le template : remplacer {pseudo} et {question}
     - Phase → 'contextual_question'
     - game_state.last_contextual_round = round actuel
     - game_state.contextual_question = { template résolu, target_player_id }
   NON :
     - Phase → 'voting_question' (round suivant normal)
```

### Joueur ciblé par type de question parent

| Type | Source | Joueur ciblé |
|---|---|---|
| A | `designated_player_ids[0]` | Premier désigné (ou unique) |
| B | `designated_player_id` | Gagnant de la roulette |
| C volontaires | `volunteer_player_ids[0]` | Premier volontaire |
| C roulette | `designated_player_id` | Désigné par roulette |

Si le joueur ciblé a quitté la room → skip, pas de question contextuelle.

---

## 4. Écran `contextual_question`

Visible identique sur tous les écrans (hôte + joueurs).

```
┌─────────────────────────────┐
│  ✨ Le jeu reprend la parole │
│                             │
│  "Thomas, tout à l'heure    │
│   tout le monde t'a désigné │
│   comme le plus mystérieux  │
│   — t'as quelque chose à    │
│   nous avouer ?"            │
│                             │
│         [Continuer →]       │
│         (hôte only)         │
└─────────────────────────────┘
```

- Pseudo du joueur ciblé mis en évidence (gras ou couleur)
- Bouton "Continuer" hôte-only → déclenche le round suivant (`voting_question`)
- Pas de timer
- Pas de vote ni d'interaction — purement social, résolution hors-app

---

## 5. Curation des sous-questions

Tâche de curation : review de la base de questions, identification de celles qui ouvrent naturellement un follow-up intéressant ou fun.

**Critères de sélection :**
- La question a produit un résultat révélateur (désignation claire, confession, volontariat marquant)
- Une relance crée un moment social fort ("et alors ? c'est vrai ?")
- Questions trop plates ou trop génériques → pas de sous-question

**Volume attendu :** 30-50% des questions auront au moins une sous-question.

---

## 6. i18n

Clés ajoutées dans `lib/i18n.ts` :

| Clé | FR | EN |
|---|---|---|
| `contextual_header` | Le jeu reprend la parole | The game speaks up |
| `contextual_continue` | Continuer | Continue |

Les templates eux-mêmes sont stockés multilingues en base (champ `template jsonb`).

---

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Aucune question jouée n'a de sous-question | Skip silencieux, round suivant normal |
| Joueur ciblé a quitté la room | Skip silencieux |
| Deux contextuelles dos-à-dos | Impossible — `last_contextual_round` bloque jusqu'au round suivant |
| Partie de 3 rounds seulement | Max 1-2 déclenchements possibles selon la chance |
