# Design — Cartes pouvoir (Target & Reveal)

**Date :** 2026-06-10
**Statut :** Approuvé, prêt pour implémentation

---

## 1. Contexte

Deux cartes pouvoir secrètes peuvent être attribuées à des joueurs volontaires au fil de la partie. Elles s'utilisent uniquement après une révélation Type B (confession roulette) pour créer un moment spectaculaire. Chaque carte est à usage unique par joueur par partie.

---

## 2. Les deux cartes

### Carte Target 🎯
Permet à son détenteur de vérifier publiquement si un autre joueur spécifique a dit "oui" lors de la confession en cours.

### Carte Reveal 💥
Permet à son détenteur de forcer la révélation d'un deuxième joueur parmi ceux ayant dit "oui" (si au moins un autre "oui" non révélé existe).

---

## 3. Attribution

### Éligibilité (par type de carte)
Un joueur est éligible si :
1. Il s'est porté **volontaire au moins une fois** dans la partie
2. Il ne **tient pas déjà** cette carte
3. Il n'a **pas encore utilisé** cette carte cette partie

### Roll d'attribution
Déclenché à la fin de chaque round (après resolve, avant `voting_question` suivant) :

```
Pour chaque type (target, reveal) indépendamment :
  éligibles = joueurs satisfaisant les 3 critères ci-dessus
  Si éligibles vide → skip

  Poids de chaque joueur = nombre de volontariats dans la partie
  Tirage pondéré → 1 gagnant
  game_state.power_cards[type] = gagnant.id
```

La carte reste avec le joueur tant qu'il ne l'utilise pas. Elle n'est visible que sur son propre écran.

### Simultanéité
Une carte Target ET une carte Reveal peuvent coexister chez deux joueurs différents.

---

## 4. Fenêtre d'utilisation

Les cartes sont utilisables **uniquement sur `round_b2_roulette`**, après la révélation du gagnant.

- Le bouton "Manche suivante" de l'hôte est **bloqué 5 secondes** après la révélation
- Pendant ces 5 secondes, les détenteurs de cartes voient un bouton "Utiliser ma carte" sur leur écran uniquement
- Après 5 secondes le bouton hôte se déverrouille — les cartes restent utilisables jusqu'à ce que l'hôte appuie

**Cartes désactivées si :**
- Écran moutons 🐑 (100% oui — tout le monde est déjà révélé, rien à cibler/révéler)
- Carte Reveal : aucun "oui" non révélé restant (total yes = 1, déjà affiché)

---

## 5. Mécanique Target

```
1. Joueur ouvre sa carte → liste des autres joueurs (sans lui-même)
2. Choisit une cible
3. Annonce publique sur tous les écrans :
   "🎯 {pseudo} sort la carte Target et braque son radar sur {pseudo_cible}...
    Le verdict tombe !"
4. Vérifier dans votes WHERE player_id = pseudo_cible AND answer = 'oui'
5. Résultat public :
   OUI → "{pseudo_cible} était dans l'ombre — oui, il/elle a confessé."
   NON → "{pseudo_cible} est clean — pas de confession de son côté."
6. Carte consommée → game_state.used_cards.target.push(player_id)
               → game_state.power_cards.target = null
```

---

## 6. Mécanique Reveal

```
1. Joueur utilise sa carte Reveal
2. Annonce publique sur tous les écrans :
   "💥 {pseudo} joue la carte Révélation — une âme sort de l'ombre..."
3. Fetch votes WHERE room_id AND round AND vote_type='confession' AND answer='oui'
   Exclure : already revealed_player_ids + designated_player_id (déjà révélé par roulette)
4. Tirage aléatoire parmi les "oui" restants → nouveau revealed player
5. Roulette animée sur tous les pseudos → s'arrête sur le nouveau révélé
6. Carte consommée → game_state.used_cards.reveal.push(player_id)
               → game_state.power_cards.reveal = null
   → game_state.revealed_player_ids.push(nouveau révélé)
```

---

## 7. GameState

Nouveaux champs :

```ts
power_cards: {
  target: string | null   // player_id détenteur de la carte Target
  reveal: string | null   // player_id détenteur de la carte Reveal
}
used_cards: {
  target: string[]        // player_ids ayant déjà utilisé Target
  reveal: string[]        // player_ids ayant déjà utilisé Reveal
}
```

Nouvelles `GamePhase` :
```ts
'card_target_result'    // affiche le résultat de la carte Target
'card_reveal_roulette'  // roulette supplémentaire (carte Reveal)
```

---

## 8. Anti-race condition

Le roll d'attribution est exécuté par l'**hôte élu** (plus petit `player_id` présent) — même pattern que le timer advancer. L'attribution est écrite dans `game_state` via `updateRoomGameState` → broadcast `phase_changed` → tous refetch.

---

## 9. i18n

| Clé | FR | EN |
|---|---|---|
| `card_target_name` | Carte Target | Target Card |
| `card_reveal_name` | Carte Révélation | Reveal Card |
| `card_use_button` | Utiliser ma carte | Use my card |
| `card_target_announce` | 🎯 {pseudo} sort la carte Target et braque son radar sur {pseudo_cible}... Le verdict tombe ! | 🎯 {pseudo} plays the Target card and locks on {pseudo_cible}... The verdict drops! |
| `card_target_yes` | {pseudo_cible} était dans l'ombre — oui, il/elle a confessé. | {pseudo_cible} was hiding in the shadows — yes, they confessed. |
| `card_target_no` | {pseudo_cible} est clean — pas de confession de son côté. | {pseudo_cible} is clean — no confession on their end. |
| `card_reveal_announce` | 💥 {pseudo} joue la carte Révélation — une âme sort de l'ombre... | 💥 {pseudo} plays the Reveal card — another soul steps into the light... |

---

## 10. Cas limites

| Cas | Comportement |
|---|---|
| Détenteur quitte la room | Carte perdue, power_cards[type] = null |
| Aucun "oui" restant pour Reveal | Carte grisée, non utilisable ce round |
| Moutons 🐑 (100% oui) | Les deux cartes désactivées |
| Partie termine sans utilisation | Carte expirée silencieusement |
| Deux joueurs veulent utiliser en même temps | Premier arrivé, premier servi — le second voit "déjà utilisé ce round" |
