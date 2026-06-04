# Kluup — Décisions UI v1
> Décisions de design prises lors des sessions de visualisation | 04/06/2026

---

## Labels de type de question

Les types A/B/C sont des noms internes. Dans l'UI :

| Type interne | Label UI | Couleur | Icône Tabler |
|---|---|---|---|
| Type A | "Désignation" | `#FF3C6F` rose | `ti-target` |
| Type B | "Confession" | `#7B2FFF` violet | `ti-heart-handshake` |
| Type C | "Volontariat" | `#FFD600` jaune | `ti-hand-stop` |

Le label s'affiche **une seule fois par round** dans le header — pas sur chaque carte de question.

---

## Écran — Sélection de la question

- 3 questions du même type affichées (le type est imposé par l'algo)
- Le type du round affiché dans le header : `Round X/7 · [Label]` avec sa couleur accent
- La question qui mène en votes : bordure colorée + fond légèrement teinté + texte blanc
- Les autres questions : atténuées, texte gris, pas de bordure colorée
- Pas de badge de type sur chaque carte — juste dans le header
- Confirmation de vote en bas : avatar + "Tu as voté pour Question X" + check vert

---

## Écran — Type A Vote de désignation

- La question affichée dans un encart en haut — toujours visible pendant le vote
- Liste des joueurs à voter avec leur avatar coloré
- Joueur sélectionné : bordure rose + check rose
- Aucun compteur de votes pendant le vote — opacité totale
- Label discret "Vote anonyme" à la place du compteur
- Confirmation de vote en bas : "Tu as voté pour [prénom]" + check vert

---

## Écran — Type A Révélation

- Joueur désigné mis en avant : grand avatar centré + halo coloré + nom en grand
- Détail des votes : barre de pourcentage dans chaque bloc + "X votes · Y%"
- Ceux à 0 vote ne s'affichent pas — liste épurée
- Bouton "Continuer" en rose — hôte uniquement

---

## Écran — Type B Vote secret

- Deux gros boutons Oui / Non — thumb friendly
- Sous-labels : "C'est moi" / "Pas moi" — plus humain
- Message cadenas discret : "Ta réponse est visible uniquement lors de la révélation"
- Points de progression en bas — indique qu'on attend les autres sans révéler combien ont répondu

---

## Écran — Type B Révélation B1 (totale)

- Stat en haut : "X sur Y · Z% du groupe"
- Seuls ceux qui ont dit **oui** sont affichés — ceux qui ont dit non ne s'affichent pas
- Chaque avouant : avatar + nom + check violet
- Bouton "Continuer" en violet

---

## Écran — Type B Révélation B2 (spotlight)

**Avant la révélation :**
- Cercle mystérieux avec "?" au centre
- Deux anneaux concentriques autour — effet depth
- Stat : "X sur Y ont avoué"
- Bouton : **"Révéler"** (pas "Lancer le sort", pas "Démasquer")

**Après la révélation :**
- Le cercle révèle la personne — initiale + prénom
- Texte : "[Prénom] est démasqué·e."
- Encart discret avec emoji : 😉 **"X personnes n'ont pas été leak."**
- Les autres avouants restent anonymes — jamais affichés
- Bouton "Continuer" en violet

---

## Écran — Type C Pause volontariat

- Header Volontariat en jaune avec icône `ti-hand-stop`
- Question affichée dans un encart
- Texte : "Le jeu est en pause. Un volontaire pour répondre à voix haute ?"
- Points animés jaunes : "En attente d'un volontaire..."
- Bouton principal jaune : **"Je me lance !"** — accessible à tous
- Bouton secondaire discret : "Passer au vote — hôte uniquement"

---

## Écran — Fin de session

- Thème + nombre de rounds en haut
- Titre du groupe dans un encart avec bordure colorée
- Texte explicatif du titre en dessous
- Encart "Moment fort" avec la stat marquante de la soirée
- Stats perso du joueur — 3 stats dynamiques issues du pool, chacune avec sa couleur de type
- Bouton principal rose : **"Partager la soirée"**
- Deux boutons secondaires : "Rejouer" + "Terminer"

---

## Conventions globales

**Couleurs fixes :**
- Fond principal : `#0D0D0D`
- Fond secondaire (cartes) : `#1A1A1A`
- Texte principal : `#FFFFFF`
- Texte secondaire : `#888`
- Texte tertiaire : `#555`
- Bordures : `#252525`

**Bouton "Continuer" :**
Toujours de la couleur du type du round en cours :
- Type A → `#FF3C6F` rose
- Type B → `#7B2FFF` violet
- Type C → `#FFD600` jaune (texte `#0D0D0D`)

**Avatars joueurs :**
Chaque joueur a une couleur d'avatar fixe attribuée à la création de la room — les 3 accents + le vert `#00C896` du thème Hello Stranger.

**Hôte joueur :**
L'hôte voit l'écran joueur normal + un bouton discret pour accéder au panel hôte (Option B). Pas d'écran splitté.

**Compteur de votes :**
- Pendant le vote → jamais affiché (opacité totale)
- Après le vote → affiché à la révélation uniquement

---

## Wording clé

| Moment | Texte |
|---|---|
| Vote anonyme Type A/C | "Vote anonyme" |
| Attente autres joueurs Type B | "En attente des autres joueurs..." |
| Volontariat Type C | "Le jeu est en pause. Un volontaire pour répondre à voix haute ?" |
| Bouton volontaire | "Je me lance !" |
| Bouton hôte vote forcé | "Passer au vote — hôte uniquement" |
| Bouton révélation B2 | "Révéler" |
| Révélation B2 — démasqué | "[Prénom] est démasqué·e." |
| Révélation B2 — autres | 😉 "X personnes n'ont pas été leak." |
| Partage fin de session | "Partager la soirée" |
