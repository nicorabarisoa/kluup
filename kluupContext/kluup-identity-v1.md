# Kluup — Identité visuelle v1
> Direction artistique | Mis à jour 04/06/2026

---

## 🎨 Concept

**Dark Pop** — fond sombre inspiré de Spotify, accents de couleur vifs et pop. Moderne, énergique, made for night.

Cible : 18-25 ans, soirées étudiantes, contexte nocturne. L'interface doit donner l'impression d'être dans une salle sombre avec des spots de lumière — chaque question est un moment fort, chaque révélation est un flash.

---

## 🎨 Palette de couleurs

### Couleurs de base
| Rôle | Hex | Usage |
|---|---|---|
| Fond principal | `#0D0D0D` | Background global — noir profond, pas pur |
| Fond secondaire | `#1A1A1A` | Cartes, panels, surfaces élevées |
| Texte principal | `#FFFFFF` | Titres, questions, textes importants |
| Texte secondaire | `#A0A0A0` | Labels, informations secondaires |

### Accents — liés aux types de questions
| Rôle | Hex | Type associé | Usage |
|---|---|---|---|
| Accent principal | `#FF3C6F` | Type A — Désignation | Boutons primaires, moments de tension, désignation |
| Accent secondaire | `#7B2FFF` | Type B — Confession | Révélations, roulette, confessions |
| Accent tertiaire | `#FFD600` | Type C — Volontariat | Volontariat, énergie, moments drôles |

> Les 3 accents correspondent aux 3 types de questions. Pas obligatoire de l'afficher explicitement mais donne une cohérence visuelle naturelle à travers le jeu.

### Thèmes — couleur d'accentuation par thème
| Thème | Couleur dominante | Hex |
|---|---|---|
| Hello Stranger 🟢 | Vert doux | `#00C896` |
| Apéro 🟡 | Ambre | `#FFB800` |
| No Filter 🔴 | Rouge vif | `#FF3C6F` |
| Unmasked ⚫ | Violet profond | `#7B2FFF` |

---

## ✍️ Typographie

### Display — titres, logo, questions
**Syne ExtraBold**
- Géométrique, moderne, fort caractère
- Utilisé pour : logo, titres d'écran, questions, titres de groupe
- Google Fonts : `https://fonts.google.com/specimen/Syne`

### Body — textes courants
**DM Sans Regular / Medium**
- Lisible, neutre, excellent rendu sur mobile
- Utilisé pour : instructions, boutons, labels, stats, messages
- Google Fonts : `https://fonts.google.com/specimen/DM+Sans`

### Hiérarchie typographique
| Niveau | Police | Taille mobile | Usage |
|---|---|---|---|
| H1 | Syne ExtraBold | 28-32px | Titres d'écran principaux |
| H2 | Syne ExtraBold | 22-24px | Questions, titres de section |
| H3 | DM Sans Medium | 18-20px | Sous-titres, noms de joueurs |
| Body | DM Sans Regular | 15-16px | Instructions, descriptions |
| Caption | DM Sans Regular | 12-13px | Labels, stats, métadonnées |

---

## 🔤 Logo

### Signature visuelle
Le double "u" de Kluup est la signature — c'est là que le logo joue.

### Option A — Typographique pur (recommandé MVP)
"Kluup" en Syne ExtraBold, le double "u" avec un traitement graphique subtil (espacement, couleur, épaisseur).
- Simple, fort, mémorable
- Facile à implémenter en CSS/SVG
- Lisible à toutes les tailles

### Option B — Icône + texte (post-MVP)
Une icône abstraite basée sur deux formes qui se rejoignent (symbolise la connexion entre personnes) + "Kluup" en Syne.
- Plus polyvalent pour favicon, app icon, partages
- À créer quand le projet est validé

### Couleur du logo
- Sur fond sombre → blanc `#FFFFFF`
- Sur fond clair → noir `#0D0D0D`
- Version accentuée → accent principal `#FF3C6F` sur le double "u"

### Labels de type de question
Les types A/B/C sont des noms internes. Dans l'UI les badges affichent :

| Type interne | Label UI | Couleur badge |
|---|---|---|
| Type A | "Désignation" | `#FF3C6F` (rose) |
| Type B | "Confession" | `#7B2FFF` (violet) |
| Type C | "Volontariat" | `#FFD600` (jaune) |

---

**1. Dark first**
Tout se passe sur fond sombre. Pas de mode clair. L'interface est faite pour la nuit.

**2. Couleur = signal**
Les accents de couleur ne sont pas décoratifs — ils signalent quelque chose. Rose = désignation, Violet = confession, Jaune = volontariat. Cohérence absolue.

**3. Typographie comme design**
Les questions sont grandes, centrées, en Syne ExtraBold. Elles prennent tout l'espace — c'est le moment fort de chaque round.

**4. Micro-animations**
La roulette, les révélations, les transitions entre écrans — tout doit avoir une animation. Pas d'écran statique pendant les moments forts.

**5. Mobile first, thumb friendly**
Tous les boutons primaires en bas d'écran, zone de confort du pouce. Rien d'important dans le coin supérieur gauche.

---

## 🎭 Ambiance par thème

| Thème | Ambiance visuelle | Effets suggérés |
|---|---|---|
| Hello Stranger | Doux, accueillant | Transitions douces, couleurs tièdes |
| Apéro | Détendu, chaleureux | Animations légères, ambre dominant |
| No Filter | Électrique, intense | Flashs rose, transitions rapides |
| Unmasked | Profond, mystérieux | Violet dominant, animations lentes et pesantes |

---

## 📱 Variables CSS (à implémenter)

```css
:root {
  /* Fonds */
  --bg-primary: #0D0D0D;
  --bg-secondary: #1A1A1A;

  /* Textes */
  --text-primary: #FFFFFF;
  --text-secondary: #A0A0A0;

  /* Accents types */
  --accent-a: #FF3C6F;   /* Type A — Désignation */
  --accent-b: #7B2FFF;   /* Type B — Confession */
  --accent-c: #FFD600;   /* Type C — Volontariat */

  /* Thèmes */
  --theme-hello: #00C896;
  --theme-apero: #FFB800;
  --theme-nofilter: #FF3C6F;
  --theme-unmasked: #7B2FFF;

  /* Typographie */
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}
```

---

## 🃏 Carte de partage

Format carré 1080x1080px — optimisé Instagram / WhatsApp.

### Structure
```
Barre de couleur thème (3px, haut de carte)
─────────────────────────────────────
Zone haute    → Nom du thème (petit, couleur accent)
               Titre du groupe (grand, blanc, Syne ExtraBold)
               Logo kluup + kluup.app (coin droit)

Zone centrale → Encart "Moment fort"
               Stat marquante de la session
               Accent couleur sur le chiffre clé

Zone basse    → Rounds + nombre de joueurs (label discret)
               Pseudos en pills (#1A1A1A, bordure subtile)

Illustrations → SVG géométrique en arrière-plan, semi-transparent
```

### Illustrations par thème
| Thème | Géométrie | Symbolique |
|---|---|---|
| Hello Stranger 🟢 | Cercles concentriques — deux pôles qui se rapprochent | Connexion, découverte |
| Apéro 🟡 | Triangles et bulles flottantes | Légèreté, fête |
| No Filter 🔴 | Éclairs et formes tranchantes | Énergie brute, intensité |
| Unmasked ⚫ | Ellipses concentriques (œil qui s'ouvre) | Profondeur, révélation |

### Couleurs par thème
| Thème | Accent illustration | Barre top | Accent stat |
|---|---|---|---|
| Hello Stranger | `#00C896` | `#00C896` | `#00C896` |
| Apéro | `#FFB800` | `#FFB800` | `#FFB800` |
| No Filter | `#FF3C6F` | `#FF3C6F` | `#FF3C6F` |
| Unmasked | `#7B2FFF` | `#7B2FFF` | `#7B2FFF` |

### Implémentation
- Rendu via **html2canvas** — la carte est un composant HTML/CSS/SVG
- Export PNG côté client, pas de serveur
- Bouton "Partager la soirée" sur l'écran de fin déclenche la génération

---

- [ ] Tester la palette sur un vrai écran de téléphone (contraste, lisibilité)
- [ ] Créer le logo Option A en SVG
- [ ] Importer Syne + DM Sans dans le projet Next.js
- [ ] Définir les variables CSS dans le fichier global
- [ ] Créer un composant Button avec les 3 variantes de couleur
- [ ] Designer la carte de partage (format carré, Instagram/WhatsApp)
