# Kluup — Document de référence projet v3
> Social party game | kluup.app | Mis à jour session daily 04/06/2026

---

## 🎯 Concept

Kluup est un **social party game** conçu pour révéler les gens et créer des connexions humaines authentiques. Il fonctionne en mode **hôte + joueurs sur leurs phones** : l'hôte lance la session, les joueurs rejoignent via un code de room depuis leur navigateur, sans installation.

**Contextes d'usage** : soirées entre amis, team building, afterwork, vacances en groupe, speed dating, famille.

**Positionnement** : "le jeu qui révèle votre groupe" — universel, fonctionne dans tous les marchés cibles (FR, EN, ES, DE).

Référence de format : **Jackbox Games** (technique). Référence de contenu : **We're Not Really Strangers** (esprit).

---

## 🏗️ Architecture technique

- **Format** : PWA / Web app (pas d'installation, pas d'App Store)
- **Stack** : Next.js + Supabase (Realtime pour le websocket)
- **Hosting** : Railway ou Render (~10€/mois au MVP)
- **i18n** : intégré dès le départ, zéro texte hardcodé
- **Langues** : FR d'abord → EN, ES, DE
- **Architecture** : modulaire — core engine (room manager, websocket, vote system) séparé des game modes

### État du build (juin 2026)
- ✅ Projet Next.js + Supabase configuré
- ✅ Création de room avec pseudo hôte
- ✅ Rejoindre une room via code
- ✅ Lobby temps réel multi-joueurs
- ✅ Identification hôte / joueur avec persistance
- ✅ Bouton "Lancer la partie" hôte only
- 🔜 Page de jeu `/room/[code]/game`

---

## 📐 Structure d'une session

- **1 manche = 7 questions**
- Après 7 questions → l'hôte choisit de **relancer une nouvelle manche** ou de **terminer la session**
- Si relance → 7 nouvelles questions, pas d'écran intermédiaire
- Si fin → l'app affiche l'écran de fin de session (stats + titre + carte de partage) sur l'ensemble de la session
- Pas de limite de manches — le groupe décide

> Le nombre impair (7) évite les ex-aequo dans les stats. Une manche dure ~20-30 minutes.

---

## 🎮 Flow global d'une session

```
App propose 3 questions
       ↓
Joueurs votent pour choisir laquelle jouer  [vote anonyme]
       ↓
Round de la question (Type A, B ou C)
       ↓
Refus possible — pas de conséquence imposée par l'app
(la dynamique sociale du groupe gère)
       ↓
Round suivant
```

> **Principe core** : Kluup est un catalyseur social, pas un jeu de règles. L'app crée le moment, le groupe gère la dynamique.

---

## 📋 Types de questions

> **Distinction fondamentale** : Type A = on juge les autres. Type B = on s'expose soi-même. Type C = question ouverte, quelqu'un se sacrifie ou le groupe choisit.

### Type A — Désignation ("le plus susceptible de…")
> Le groupe désigne **quelqu'un d'autre** — jugement externe porté sur autrui.

1. Question affichée sur tous les écrans
2. Chaque joueur vote anonymement pour désigner une autre personne du groupe
3. Révélation : qui a été le plus désigné
4. Cette personne répond à voix haute (refus libre, pas de conséquence imposée)

> Usage progressif selon thème : dominant en No Filter / Unmasked (groupe qui se connaît), rare en Hello Stranger.

---

### Type B — Confession collective *(mis à jour 04/06/2026)*
> Chaque joueur se désigne **lui-même** s'il se sent concerné — confession personnelle, pas jugement.

Chaque joueur vote secrètement pour lui-même (oui/non). Au moment de la révélation, le sous-mode est **tiré aléatoirement** :

#### B1 — Révélation totale
Tous ceux qui ont répondu "oui" sont révélés simultanément → moment de groupe, tout le monde voit qui est concerné.

#### B2 — Pourcentage + Roulette
1. Affichage du pourcentage du groupe ("67% se sont reconnus")
2. Roulette qui tourne et désigne **une seule personne** parmi ceux qui ont répondu "oui"
3. Cette personne est révélée / doit assumer — les autres restent anonymes

> B1 et B2 sont la même mécanique de base (auto-désignation), mais B2 préserve l'anonymat collectif tout en créant une tension individuelle.

**Ratio par défaut selon thème :**
| Thème | B1 (révélation totale) | B2 (roulette) |
|---|---|---|
| Hello Stranger | 30% | 70% |
| Apéro | 30% | 70% |
| No Filter | 70% | 30% |
| Unmasked | 70% | 30% |

> À calibrer lors des sessions de test réelles.

---

### Type C — Question ouverte *(redesigné 04/06/2026)*
> Question ouverte — quelqu'un se sacrifie volontairement, sinon le groupe envoie quelqu'un.

1. Question affichée sur tous les écrans
2. **Le jeu se met en pause** — pas de timer, pas de pression, les joueurs discutent librement
3. Deux scénarios :

**Si quelqu'un se manifeste (ou plusieurs)**
- Ils se débrouillent entre eux hors app
- L'hôte appuie sur "Continuer" une fois la réponse donnée → round suivant

**Si personne ne se manifeste**
- L'hôte appuie sur "Lancer le vote" depuis son panel hôte
- Vote anonyme du groupe → quelqu'un est désigné
- Cette personne répond (refus libre, pas de conséquence imposée)
- L'hôte appuie sur "Continuer" → round suivant

> L'hôte est arbitre et chef d'orchestre sur ce type — rôle actif naturel sans surcharge technique.
> La tension vient du dilemme : "Est-ce que je lève la main ou j'attends que quelqu'un d'autre le fasse ?"

---

## 🎭 Anonymat des votes *(clarifié 04/06/2026)*

| Action | Anonyme ? |
|---|---|
| Vote pour choisir la question | ✅ Fixe — toujours anonyme |
| Vote de désignation Type A | ✅ Fixe — toujours anonyme |
| Vote de désignation Type C | ✅ Fixe — toujours anonyme |
| Réponses Type B | Dépend du sous-mode tiré (B1 = révélé, B2 = roulette) |

> **Toggle anonyme/révélé supprimé** — il n'avait d'utilité que sur le Type B, déjà géré par le mécanisme B1/B2. Le thème gère tout automatiquement, l'hôte n'a rien à toggler.

---

## 🎨 Thèmes (v1)

| Thème | Ambiance | Ratio B1/B2 |
|---|---|---|
| Hello Stranger | Léger, safe | 30% B1 / 70% B2 |
| Apéro | On se réchauffe | 30% B1 / 70% B2 |
| No Filter | Sans filtre | 70% B1 / 30% B2 |
| Unmasked | Révélations profondes | 70% B1 / 30% B2 |

- **Contenu** : 68 questions écrites sur les 4 thèmes

---

## 🎯 Système de gages — hors scope v1

Les gages sont retirés du core game. L'app ne sanctionne pas les refus — la dynamique sociale suffit.

> **Post-v1** : un mode optionnel "Dare pack" pourra être activé par l'hôte pour les groupes qui veulent cette dimension. Les 28 gages écrits sont conservés pour ce futur mode.

---

## 🏁 Écran de fin de session *(ajouté 04/06/2026)*

Trois moments enchaînés à la fin de chaque session :

**Moment 1 — Stats du groupe**
Chiffres générés automatiquement à partir des votes de la session :
- "X a été désigné Y fois ce soir"
- "Z% du groupe a avoué avoir déjà..."
- "La question la plus votée était..."

Toujours personnalisé, toujours contextuel, toujours drôle.

**Moment 2 — Titre du groupe**
L'app génère un titre basé sur les patterns réels de la session :
- Taux de désignation élevé → "Les Impitoyables", "Les Juges"
- Beaucoup de confessions Type B → "Les Transparents", "Les Honnêtes"
- Questions No Filter dominantes → "Les Sans Filtre", "Les Téméraires"
- Session calme / Hello Stranger → "Les Mystérieux", "Les Discrets"

Court, mémorable, screenshot-able. Toujours cohérent car basé sur ce qui s'est vraiment passé.

> **MVP** : logique locale basée sur les stats de session (Option A) — zéro coût, zéro dépendance API.
> **Post-v1** : remplacement par génération IA (Option B) pour plus de créativité et de variété.

**Moment 3 — Carte de partage**
Carte visuelle générée automatiquement :
- Pseudos des joueurs + titre du groupe
- Une stat marquante de la soirée
- Logo Kluup + kluup.app

Format carré, optimisé Instagram/WhatsApp. Vecteur viral naturel — les gens partagent leur soirée, Kluup est dessus.

> **Technique** : génération via **html2canvas** — screenshot d'un élément HTML/CSS côté client, export PNG. Zéro coût, zéro serveur.
> **Post-v1** : basculer sur Canvas natif si problèmes de rendu.

> **Principe** : pas de classement — ça crée de la compétition là où le jeu est conçu pour la connexion.

---

## 🔮 Modes post-v1

### Mode Dating — Speed Interview
Format 1 vs 1, inspiré du speed dating physique. L'app pose les questions et gère le timer, les deux personnes sont face à face et se répondent à voix haute.

**Mécanique**
```
App affiche la question pour A
A répond à voix haute (timer 10-15s)
App affiche la question pour B  
B répond à voix haute (timer 10-15s)
Question suivante → alterner jusqu'à la fin
```

**Principes**
- Format 1 vs 1 uniquement
- Questions alternées, pas simultanées
- Timer court (10-15s) — force l'authenticité, pas le temps de réfléchir
- Pas de vote, pas de désignation — juste la question et la réponse
- L'app est le moteur, la conversation se passe entre les deux personnes
- Techniquement léger — pas de websocket complexe, juste affichage + timer + alternance

> **Architecture** : le design modulaire du core engine permet d'ajouter ce mode sans refactoring. À implémenter quand le core game est validé.

---

### Dare Pack — Mode optionnel
Les 28 gages écrits pour la v1 sont conservés pour un mode optionnel activable par l'hôte. À designer et implémenter post-v1.

---

## 💰 Monétisation

### MVP — Gratuit total
Les 4 thèmes sont gratuits au lancement. Zéro friction, pas de système de paiement, pas de compte requis. L'objectif est de valider le concept avec de vrais utilisateurs.

### Post-MVP — Thèmes premium
Après validation, introduction de thèmes premium payants selon ce que les utilisateurs demandent :
- Thèmes saisonniers (Noël, Nouvel An...)
- Thème Team Building (questions pro, safe corporate)
- Thème Couples (format 1 vs 1)
- Thème 18+ (pour les groupes qui veulent vraiment aller loin)
- Autres selon retours utilisateurs

**Pricing envisagé** :
- Thème seul → 1,99€
- Pack 3 thèmes → 3,99€

**Stack paiement** : Stripe — à intégrer uniquement quand les premiers thèmes premium sont prêts.

### Feuille de route
```
MVP        → 4 thèmes gratuits, pas de compte requis
Post-MVP   → thèmes premium + Stripe
             + comptes optionnels pour historique de sessions
Post-v1    → B2B licensing événementiel (à explorer si projet validé)
```

---

## 🎲 Algorithme de sélection des questions *(ajouté 04/06/2026)*

**Distribution sur 7 questions (3A / 3B / 1C)**

| Position | Type | Intensité |
|---|---|---|
| Q1 | B | 1 |
| Q2 | A | 1 |
| Q3 | B ou C | 2 |
| Q4 | A | 2 |
| Q5 | C | 2 |
| Q6 | A ou B | 3 |
| Q7 | A | 3 |

**Progression d'intensité**
Les questions ont un niveau 1 à 3 défini dans le contenu. La session monte progressivement — jamais de niveau 3 en début de session.

**Anti-répétition**
Chaque question jouée est taguée dans la session et ne peut pas être reproposée. Pas de mémoire entre sessions en MVP.

**Logique de pioche**
```
Pour chaque slot → type imposé + niveau imposé
→ pioche aléatoire dans le pool correspondant
→ si pool vide sur ce niveau → prend le niveau le plus proche
```

---

## 📊 Analytics interne

Suivi par question : taux de sélection, taux de completion, taux de skip → rotation automatique pour éviter la staleness.

---

## 📱 UX

- Mobile-first, responsive tous écrans
- Domaine : kluup.app

---

## 🖥️ Écrans de la page de jeu *(mappés 04/06/2026)*

### Paramètre hôte
Avant de créer un lobby, l'hôte choisit s'il joue ou non.
- **Hôte joueur** : voit l'écran joueur normal + un bouton discret pour accéder aux contrôles hôte (Option B)
- **Hôte arbitre** : voit uniquement le panel hôte

---

### Écrans communs à tous les types

**Écran 1 — Sélection de la question**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | 3 questions + compteur de votes en temps réel | 3 questions à voter |
| Action | Attendre (ou voter si hôte joueur) | Voter pour une question |
| Transition | Automatique quand tous ont voté | — |

**Écran 2 — Révélation de la question choisie**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question choisie | Question choisie |
| Action | Bouton "Lancer" | Attendre |
| Transition | L'hôte lance manuellement | — |

---

### Type A — Désignation

**Écran 3A — Vote de désignation**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + compteur de votes | Question + liste des joueurs |
| Action | Attendre (ou voter si hôte joueur) | Voter pour quelqu'un |
| Transition | Automatique quand tous ont voté | — |

**Écran 4A — Révélation**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Qui a été désigné + score des votes | Qui a été désigné |
| Action | Bouton "Continuer" | Attendre |
| Transition | L'hôte passe au round suivant | — |

---

### Type B — Confession

**Écran 3B — Vote secret**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + compteur (combien ont voté, pas quoi) | Question + bouton Oui / Non |
| Action | Attendre (ou voter si hôte joueur) | Voter oui ou non |
| Transition | Automatique quand tous ont voté | — |

**Écran 4B1 — Révélation totale (sous-mode B1)**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Liste de tous ceux qui ont dit oui | Liste de tous ceux qui ont dit oui |
| Action | Bouton "Continuer" | Attendre |
| Transition | L'hôte passe au round suivant | — |

**Écran 4B2 — Pourcentage + Roulette (sous-mode B2)**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | % du groupe + animation roulette + révélation | % du groupe + animation roulette + révélation |
| Action | Bouton "Continuer" après roulette | Attendre |
| Transition | L'hôte passe au round suivant | — |

---

### Type C — Question ouverte

**Écran 3C — Pause volontariat**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + boutons "Lancer le vote" / "Continuer" | Question + message "Un volontaire ?" |
| Action | Attendre ou lancer le vote | Discussion hors app |
| Transition | L'hôte décide | — |

**Écran 4C — Vote de désignation** *(si personne)*
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + compteur de votes | Question + liste des joueurs |
| Action | Attendre (ou voter si hôte joueur) | Voter pour quelqu'un |
| Transition | Automatique quand tous ont voté | — |

**Écran 5C — Révélation désigné**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Qui a été désigné + bouton "Continuer" | Qui a été désigné |
| Action | Bouton "Continuer" | Attendre |
| Transition | L'hôte passe au round suivant | — |

---

### Écran de fin de session

**Écran fin — Stats + Titre + Carte**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Stats + Titre du groupe + Carte de partage + boutons "Nouvelle manche" / "Terminer" | Stats + Titre du groupe + Carte de partage |
| Action | Choisir de continuer ou terminer | Attendre |
| Transition | L'hôte décide | — |

> **Total : 12 écrans distincts** pour la page de jeu.
