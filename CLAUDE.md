# CLAUDE.md — Kluup
> Contexte projet pour Claude Code. Lit ce fichier en priorité à chaque session.

---

## 🎯 Concept

Kluup (kluup.app) est une **web app de party game** conçue pour briser la glace et créer des connexions humaines authentiques lors de soirées apéro. Format **hôte + joueurs sur leurs phones** : l'hôte lance la session, les joueurs rejoignent via un code de room depuis leur navigateur, sans installation.

- Référence format : **Jackbox Games** (technique)
- Référence contenu : **We're Not Really Strangers** (esprit)
- Positionnement : "le jeu qui révèle votre groupe"

---

## 🏗️ Stack technique

- **Framework** : Next.js (App Router)
- **Backend / Realtime** : Supabase (Realtime pour le websocket)
- **Styling** : Tailwind CSS
- **Hosting** : Railway ou Render (~10€/mois au MVP)
- **Format** : PWA / Web app — pas d'installation, pas d'App Store
- **i18n** : intégré dès le départ, **zéro texte hardcodé**
- **Langues** : FR d'abord → EN, ES, DE

### Architecture
Modulaire — core engine (room manager, websocket, vote system) séparé des game modes pour permettre l'ajout de futurs modes sans rework.

### État du build — MVP Classic COMPLET & déployé (prod Railway)
Flow entier jouable : accueil → création/join → lobby (choix thème) → rounds A/B/C → écran de fin + carte de partage. i18n FR/EN avec détection. Cycle de vie des rooms géré (presence + cleanup). Les retours de **2 phases de playtest** sont intégrés.

---

## 🔧 Architecture réelle & décisions — SOURCE DE VÉRITÉ TECHNIQUE
> Section maintenue à jour pour donner le contexte sans relire l'historique. Màj 2026-06 (session 3).

### Stack effective
- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4.
- Supabase : Postgres + Realtime (`postgres_changes`, `broadcast`, `presence`). Projet ref `dmxjspnrrgcixzcthgwf`.
- Hébergement **Railway** (build = `next build`).
- Carte de partage : **`modern-screenshot`** (surtout PAS `html2canvas` — il déformait les polices custom).

### Carte des fichiers
- `app/page.tsx` — accueil (créer room + pseudo, bouton join, LangSwitch).
- `app/join/page.tsx` — rejoindre via code (wrap `Suspense` pour `useSearchParams`, lien retour accueil).
- `app/room/[code]/lobby/page.tsx` — lobby temps réel, sélecteur de thème (hôte), bouton "Lancer".
- `app/room/[code]/game/page.tsx` — **TOUTE la page de jeu** : tous les écrans + state machine + handlers (gros fichier).
- `app/layout.tsx` — fonts **Bricolage Grotesque** (display, var `--font-display-face`) + **DM Sans** (corps, var `--font-body-face`) via next/font + `<LocaleProvider>`. globals.css mappe `--font-display` / `--font-body` (noms agnostiques → swap facile).
- `lib/types.ts` — `Player`, `Question`, `GameState`, `GamePhase`, `Room`, etc.
- `lib/game.ts` — moteur pur : `pickCandidates`, `pickType`, `tallyDesignation`, `tallyQuestionSelection`, `pickBSubtype`, `accumulateStats`, `computeGroupTitle`, `countVotes`, `countChoiceVotes`, `fetchVotes`, `makeInitialGameState`, `updateRoomGameState`.
- `lib/i18n.ts` — dictionnaires `fr` + `en` (mêmes clés, typés `Dict`), `dictionaries`, `Locale`, `defaultLocale`, `localeNames`.
- `lib/locale.tsx` — `LocaleProvider`, hooks `useT()` / `useLocale()`, composant `LangSwitch`.
- `lib/usePresence.ts` — `useRoomPresence(roomId, myId)` : présence + prune fantômes + heartbeat.
- `lib/supabase.ts` — client (warn console si env manquantes).
- `lib/utils.ts` — `genId` / `copyToClipboard` (fallbacks contexte non-sécurisé / HTTP LAN).
- `supabase/migration.sql` — schéma rooms/questions/votes + RLS + realtime.
- `supabase/seed.sql` + `seed_themes.sql` — questions.
- `supabase/lifecycle.sql` — cleanup rooms (cascade players, `last_activity` + trigger, `cleanup_dead_rooms()` TTL 30 min, pg_cron optionnel). **Déjà exécuté.**
- `supabase/rls.sql` — politiques RLS anon open pour `rooms` + `players` (à exécuter si "Room introuvable" à la jonction). **Exécuter si le join échoue.**
- `.env.example` — vars Supabase.

### Modèle de données (Supabase)
- `rooms` : id, code, **status** `'lobby'|'playing'|'ended'|'waiting'` (défaut DB `'lobby'` ; `'waiting'` = retour au lobby après partie), theme, **game_state** (jsonb), host_id, created_at, last_activity.
- `players` : id, room_id (→rooms **ON DELETE CASCADE**), pseudo, is_host, is_online, created_at.
- `votes` : id, room_id (CASCADE), round, player_id (→players CASCADE), **vote_type** `'question_selection'|'designation'|'confession'|'volunteer'`, target_player_id, answer, question_index. UNIQUE(room_id, round, player_id, vote_type).
- `questions` : id, theme, type (A/B/C), intensity (1-3), question jsonb `{fr,en,es,de}`.
- RLS ouvert (MVP) : anon peut select/insert/update/delete sur rooms & players, select/insert sur votes.

### GameState (jsonb)
`phase, round, candidates[], current_question, b_subtype, designated_player_id` (B2 + roulette Type C), `designated_player_ids[]` + `designation_tie_all` (Type A), `revealed_player_ids[], yes_percentage, volunteer_player_ids[], played_question_ids[], paused, stats, b2_revealed`.
GamePhase : `voting_question, round_a_vote, round_a_reveal, round_b_vote, round_b1_reveal, round_b2_roulette, round_c_choice, round_c_volunteers_reveal, round_c_roulette, ended`. **MAX_ROUNDS = 7.**

### Temps réel
- Lobby : `lobby-${code}` (players INSERT filtré room_id + DELETE ; rooms UPDATE → navigate si `playing`).
- Jeu : `game-${code}` (rooms UPDATE → `applyRoom` ; players INSERT/DELETE/UPDATE → roster live) + broadcast `votes-broadcast-${id}` (events `vote_count`, `phase_changed` → refetch).
- Présence : `presence-${roomId}` (cf `lib/usePresence.ts`).
- **Convergence** : après chaque write d'état, broadcast `phase_changed` → tous refetch (fiable, indépendant de postgres_changes).

### Rôle de l'hôte (réduit) — fait foi sur les tableaux d'écrans plus bas
L'hôte ne sert qu'à **créer la room, choisir le thème, lancer la partie**. En jeu :
- **Phases de vote** : timer **30 s** visible par tous (anneau SVG, passe au rouge à 10 s). À l'expiration, l'**advancer élu** (plus petit `player.id` présent) déclenche `onForce` pour éviter les races. L'hôte peut aussi cliquer "Passer sans attendre les absents" manuellement.
- **Avancement de manche** : bouton **"Manche suivante" / "Voir les résultats" hôte-only** sur les écrans de révélation. Les autres joueurs voient "L'hôte lance la manche suivante…". Pas de timer sur les révélations.
- **Ouverts à tous** : pause / reprise, "Révéler" (roulette B2).
- **Hôte-only** : "Passer sans attendre les absents" (phases de vote), "Manche suivante", "Terminer la session" (`onEndGame`), "Changer de thème / Rejouer" (`returnToLobby`).

### Résolution des votes
- Chaque vote = une row `votes`. Le client qui atteint le seuil `count >= players.length` appelle `resolveVotes`/`resolveTypeCChoice`.
- Timer 30 s (composant `VoteTimer`) sur toutes les phases de vote. L'advancer élu (plus petit `player.id`) déclenche `onForce` à l'expiration.
- Filet manuel : bouton **"passer sans attendre les absents"** — **hôte-only** — sur les phases de vote.
- Roster qui rétrécit pendant un vote (fantôme pruné) → l'hôte revérifie le compte réel et avance auto.

### Cycle de vie des rooms
- **Quit explicite** (bouton "Quitter", tous) : si hôte → transfert au plus ancien restant ; si dernier → suppression room (cascade players+votes).
- **Présence** (lobby+jeu) : déconnexion → après **60 s de grâce** (anti phone-lock), un client élu (plus petit id présent) supprime la row fantôme ; **heartbeat 2 min** rafraîchit `last_activity`.
- **Balayage** `cleanup_dead_rooms()` (RPC opportuniste appelé à la création de room) : supprime les rooms **sans aucun client connecté depuis 30 min**. pg_cron = option pour le 100 % auto (2 lignes en commentaire dans lifecycle.sql).

### i18n
- `useT()` → dictionnaire actif. Convention : **`const fr = useT()`** dans chaque composant (les usages `fr.xxx` restent inchangés). Helpers non-composants reçoivent le dico en param (`momentStat(..., t)`).
- Questions rendues via `q.question[locale]`.
- Détection : localStorage > navigator.language > `fr`. `LangSwitch` sur accueil/join/lobby.
- **ES/DE** : questions déjà traduites en base ; reste à ajouter les dicos UI `es`/`de` dans `lib/i18n.ts` (ils apparaîtront auto dans le sélecteur).

### ⚠️ Gotchas / ops
- **`NEXT_PUBLIC_*` inlinées au BUILD** : définir dans Railway → Variables PUIS **redéployer** (un restart ne suffit pas), sinon création de room cassée en prod.
- Scripts SQL à exécuter dans Supabase : `migration.sql`, `seed.sql`/`seed_themes.sql`, `lifecycle.sql` (tous exécutés). Re-run le bloc concerné si on change le TTL.
- **"Room introuvable" au join** → exécuter `supabase/rls.sql` dans l'éditeur SQL Supabase (RLS sans politique SELECT bloque les requêtes anon silencieusement). Vérifier aussi que les vars Railway correspondent au bon projet Supabase.
- **Lobby sans formulaire d'entrée** → le lobby redirige maintenant vers `/join?code=XXX` si le visiteur n'a pas de `player_id` dans le sessionStorage. Le lien "Copier le lien" dans le lobby pointe vers `/join?code=XXX` (pas vers `/room/…/lobby`).
- `onPause` / `onResume` utilisent `roomRef.current.game_state` (pas le state React) pour éviter les stale closures et la désynchronisation.
- Carte : NE PAS revenir à html2canvas. modern-screenshot capture une **copie hors-écran à taille réelle** (540×540) — l'aperçu en `transform:scale` faussait les mesures (rognage).

### Décisions playtest — NE PAS régresser
- **Type A** : pas de tie-break aléatoire (tous les ex-aequo affichés ; égalité totale = écran "Décevant" — **Type A UNIQUEMENT**). Self-vote autorisé. Texte "Assume… ou plaide ta cause" à la révélation.
- **Type C** repensé (cf section dédiée) : phase unique, volontaires priment, roulette si égalité, **jamais d'écran "Décevant"**.
- **B2 roulette** garde son tirage aléatoire (voulu).
- Pas deux fois le même type d'affilée (`pickType` exclut le type précédent).
- Réafficher la question sur les écrans de réponse à voix haute.
- Export carte via Web Share API mobile (→ Photos), fallback download.
- **Timer vote 30 s** (pas 15 s, pas sur les révélations). Seul l'advancer le déclenche à l'expiration.
- **Sélection de question** : feedback visuel immédiat (fond coloré + bordure pleine + ✓) dès le tap, les autres questions s'opacifient à 40 %.
- **"Manche suivante" hôte-only** — ne pas remettre ce bouton pour tous (risque de troll / spam).
- **"Passer sans attendre" hôte-only** — idem.
- **`onPause`/`onResume`** : toujours lire `roomRef.current.game_state`, jamais le state React — évite les désync pause/reprise.

### Reste à faire / idées
ES/DE (dicos UI) · écran "hôte joue ou pas" (spécifié plus bas, **pas encore implémenté**) · analytics questions · polish/juice · pg_cron si cleanup 100 % auto voulu · exécuter `rls.sql` en prod si le join reste cassé.

---

## 🎮 Flow global d'une session

```
App propose 3 questions (tirées aléatoirement selon thème + niveau d'intensité croissant)
       ↓
Tous les joueurs votent pour choisir laquelle jouer  [vote anonyme]
       ↓
Round selon le type de la question (A, B ou C)
       ↓
Refus possible — pas de conséquence imposée par l'app
(la dynamique sociale du groupe gère)
       ↓
Round suivant
       ↓
[Fin de session]
       ↓
Écran stats + Titre du groupe + Stats personnelles
```

**Principe core** : Kluup est un catalyseur social, pas un jeu de règles. L'app crée le moment, le groupe gère la dynamique.

---

## 📋 Types de questions

> Distinction fondamentale : Type A = on juge les autres. Type B = on s'expose soi-même. Type C = question ouverte, quelqu'un se sacrifie ou le groupe choisit.

### Type A — Désignation ("le plus susceptible de…")
1. Question affichée sur tous les écrans
2. Chaque joueur vote anonymement pour désigner **quelqu'un** du groupe — **soi-même inclus** (on peut s'assumer ; permet aussi de sortir de l'égalité forcée à 2 joueurs)
3. Révélation : la/les personne(s) la plus désignée(s). **Pas de tie-break aléatoire** — égalité en tête → tous les premiers affichés ; égalité totale (personne ne se démarque) → écran "Décevant"
4. Elle répond à voix haute (refus libre, pas de conséquence imposée)

> Usage progressif : rare en Hello Stranger, dominant en No Filter / Unmasked.

---

### Type B — Confession collective ("t'as déjà…")
Chaque joueur se désigne **lui-même** s'il se sent concerné. Vote secret (oui/non). Au moment de la révélation, le sous-mode est **tiré aléatoirement** selon le ratio du thème :

**B1 — Révélation totale**
Tous ceux qui ont répondu "oui" sont révélés simultanément → moment de groupe.

**B2 — Pourcentage + Roulette**
1. Affichage du % du groupe ("67% se sont reconnus")
2. Roulette qui désigne **une seule personne** parmi les "oui"
3. Les autres restent anonymes — tension individuelle

**Ratio B1/B2 par thème :**
| Thème | B1 (révélation totale) | B2 (roulette) |
|---|---|---|
| Hello Stranger | 30% | 70% |
| Apéro | 30% | 70% |
| No Filter | 70% | 30% |
| Unmasked | 70% | 30% |

> À calibrer lors des sessions de test réelles.

---

### Type C — Question ouverte *(refonte playtest #2)*
1. Question affichée. **Une seule phase** : chaque joueur (hôte inclus) choisit une action :
   - **"Se porter volontaire"** → je réponds
   - **"Envoyer quelqu'un au bûcher"** → désigner quelqu'un d'autre (vote anonyme)
2. Quand tout le monde a agi (seuil = nb joueurs ; filet hôte "passer") :
   - **≥1 volontaire** → ils répondent **tous** (moment de partage)
   - **0 volontaire** → le plus désigné répond ; **roulette de hasard** si égalité
3. **Jamais d'écran "Décevant"** sur le Type C.

> Ancien design (fenêtre de volontariat puis vote séparé lancé par l'hôte) **abandonné** suite aux tests : un seul volontaire bloquait les autres, et l'égalité affichait à tort "Décevant".

---

## 🎭 Anonymat des votes

| Action | Anonyme ? |
|---|---|
| Vote pour choisir la question | ✅ Fixe — toujours anonyme |
| Vote de désignation Type A | ✅ Fixe — toujours anonyme |
| Vote de désignation Type C | ✅ Fixe — toujours anonyme |
| Réponses Type B | Dépend du sous-mode tiré (B1 = révélé, B2 = roulette) |

> **Toggle anonyme/révélé supprimé** — inutile sur A et C (votes anonymes fixes), déjà géré par B1/B2 sur le Type B. Le thème gère tout automatiquement.

---

## 🎨 Thèmes v1 (gratuits)

| Ordre | Thème | Ambiance | Flow dominant |
|---|---|---|---|
| 1 | **Hello Stranger** | On se découvre — léger, safe | Type B dominant |
| 2 | **Apéro** | On se détend — début de soirée | Type B + A |
| 3 | **No Filter** | On se lâche — sans retenue | Type A dominant |
| 4 | **Unmasked** | On se révèle — confessions profondes | Type A pur |

Chaque thème contient un **mix des 3 types** (A, B, C).

### Thèmes premium (post-v1)
Confessions coupables, Nostalgie, Opinions chaudes, Et toi dans 10 ans, Team Kluup, Couple, Famille, After.

---

## 📊 Structure des questions en base

Chaque question a :
- `theme` : hello-stranger / apero / no-filter / unmasked
- `type` : A / B / C
- `intensity` : 1 / 2 / 3 *(relatif au thème, pas absolu)*
- `question` : `{ fr: "...", en: "...", es: "...", de: "..." }`

L'algorithme de sélection monte en intensité au fil des rounds — les questions niveau 1 passent en premier, niveau 3 en fin de session.

### Système analytics interne (post-MVP)
Chaque question trackée : taux de sélection, taux de complétion, taux de skip → auto-cycling pour éviter la répétition.

---

## 🎯 Système de gages — hors scope v1

Les gages sont retirés du core game. L'app ne sanctionne pas les refus — la dynamique sociale du groupe gère.

> **Post-v1** : mode optionnel "Dare pack" activable par l'hôte pour les groupes qui veulent cette dimension.

---

## 🖥️ Écrans de la page de jeu

### Paramètre hôte (avant création du lobby) — ⚠️ SPÉCIFIÉ, PAS ENCORE IMPLÉMENTÉ
L'hôte choisit s'il joue ou non. **Actuellement l'hôte est toujours joueur** (compté dans `players.length`).

**Si l'hôte joue** (futur) : écran joueur normal + bouton discret pour les contrôles hôte (Option B — écran joueur d'abord).

> En jeu, **tout le monde** a : **pause** (haut-droite) et **"Quitter"** (haut-gauche). Cf "Rôle de l'hôte (réduit)" dans la section technique.

---

### Écrans Type A

**Écran 1A — Affichage question**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + "Les joueurs votent…" + compteur | Question + liste des pseudos à voter |
| Action | Attendre (ou voter si hôte joueur) | Voter pour quelqu'un |
| Transition | Automatique quand tous ont voté | — |

**Écran 2A — Révélation**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Qui a été désigné + "X répond…" + bouton "Round suivant" | Qui a été désigné + "X répond…" |
| Action | Bouton "Round suivant" | Attendre |
| Transition | L'hôte passe au round suivant | — |

---

### Écrans Type B

**Écran 1B — Vote secret**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + "Les joueurs répondent…" + compteur | Question + boutons Oui / Non |
| Action | Attendre (ou répondre si hôte joueur) | Répondre oui/non |
| Transition | Automatique quand tous ont répondu | — |

**Écran 2B1 — Révélation totale**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Liste de tous ceux qui ont dit "oui" + bouton "Round suivant" | Liste de tous ceux qui ont dit "oui" |
| Action | Bouton "Round suivant" | Discussion hors app |
| Transition | L'hôte décide | — |

**Écran 2B2 — Roulette**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | % du groupe + animation roulette + révélation + bouton "Round suivant" | % du groupe + animation roulette + révélation |
| Action | Bouton "Round suivant" | Attendre ou discussion hors app |
| Transition | L'hôte décide | — |

---

### Écrans Type C *(refonte — cf concept ci-dessus)*

**Écran 1C — Choix** (`round_c_choice`)
| | Tous les joueurs (hôte inclus) |
|---|---|
| Affichage | Question + 2 boutons : "Se porter volontaire" / "Envoyer quelqu'un au bûcher" |
| Action | Choisir une action (puis liste des joueurs si bûcher) |
| Transition | Auto quand tous ont agi (filet hôte "passer") → 2C si ≥1 volontaire, sinon 3C |

**Écran 2C — Volontaires révélés** (`round_c_volunteers_reveal`) *(≥1 volontaire)*
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + **tous** les volontaires + "Round suivant" | Idem (ils répondent tous) |
| Transition | L'hôte décide | — |

**Écran 3C — Roulette de désignation** (`round_c_roulette`) *(0 volontaire)*
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + roulette → 1 désigné (hasard si égalité) + "Round suivant" | Idem |
| Transition | L'hôte décide | — |

---

### Écran de fin de session

**Stats + Titre + Carte de partage**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Titre du groupe + texte + stat marquante | Idem + carte de partage |
| Actions | "Partager la soirée" (carte) · "Rejouer (choisir le thème)" → **retour lobby** · "Quitter" | "Partager" · "Quitter" |

> "Rejouer" remet la room en `waiting` (game_state null) → tout le monde revient au lobby choisir un nouveau thème, **sans recréer de salon**.
> Stats perso détaillées par joueur : prévues, non encore affichées.

---

## 🏆 Titres de groupe (écran de fin)

10 titres possibles, déclenchés selon les stats de session. Traduits en FR/EN/ES/DE.

| Clé | Condition principale | Ton |
|---|---|---|
| `title_ruthless` | Type A > 60% + votes concentrés | Cash, No Filter |
| `title_transparent` | Type B > 60% + B1 dominant | Chaleureux, Apéro |
| `title_mysterious` | Type B > 60% + B2 dominant | Mystérieux, Unmasked |
| `title_brave` | Type C élevé + beaucoup de volontaires | Admiratif, tous thèmes |
| `title_cautious` | Type C élevé + peu de volontaires | Amusé, Hello Stranger |
| `title_nofilter` | No Filter/Unmasked + Type A élevé | Provoc, No Filter |
| `title_accomplices` | Hello Stranger + session complète | Chaleureux, Hello Stranger |
| `title_daring` | Unmasked + B1 élevé | Sincère, Unmasked |
| `title_unfathomable` | B2 très élevé sur toute la session | Mystérieux, tous thèmes |
| `title_unclassifiable` | Mix équilibré, aucun pattern dominant | Complice, tous thèmes |

**Structure de chaque titre :**
- Titre du groupe (clé i18n)
- Texte expliquant pourquoi ce titre (ton adapté au thème joué)
- Stat marquante du groupe
- Stats personnelles pour chaque joueur (4 stats : fois désigné, confessions, volontariats, diversité des votes)

**Variables dynamiques :**
- `{nom}` — pseudo du joueur le plus désigné
- `{n}` — chiffre calculé selon la stat concernée
- `{nA}` `{nB}` `{nC}` — nombre de questions par type joué

> Toutes les variables sont générées côté client à partir des stats de session — zéro appel API, zéro coût.

---

## 💰 Modèle économique

- **Freemium** : Hello Stranger gratuit, autres thèmes vendus individuellement (1,99–3,99€)
- **Abonnement** : envisagé long terme (1,99€/mois)
- **B2B** : licences pour événements et team building (200–2 000€/événement)

---

## 🗺️ Roadmap modes de jeu

- **MVP** : Classic (flow décrit ci-dessus)
- **V3** : Mode Couples en groupe
- **V4** : Mode Dating (2 joueurs, compatibilité)
- **Plus tard** : Mode Tribunal, Mode Caption ça, méta-jeu/badges, Mode Team Building pro

### À ne pas faire
| Concept | Pourquoi |
|---|---|
| Chat intégré | WhatsApp le fait mieux |
| Blind test musical | Droits d'auteur complexes |
| Mode solo | Casse le principe social |

---

## 📌 Règles de développement

1. **Zéro texte hardcodé** — tout passe par le système i18n
2. **Mobile-first** — design responsive, pensé pour les téléphones
3. **Modularité** — core engine séparé des game modes
4. **Supabase Realtime** pour toute synchronisation entre hôte et joueurs
5. **Pas de sanctions automatiques** — l'app ne force rien, la dynamique sociale gère

---

## 💬 Principe d'interaction — hors-app intentionnel

**Les joueurs interagissent entre eux en dehors de l'app, pas dedans.**

L'app déclenche les moments — questions, révélations, désignations — mais la vraie interaction (réactions, débats, fous rires, confessions à voix haute) se passe en physique autour de la table. C'est le cœur du concept.

**Implications concrètes sur le dev :**
- Pas de chat intégré
- Pas de système de commentaires ou réactions in-app
- Les écrans d'attente ne doivent pas chercher à combler le silence — le silence c'est la conversation qui se passe
- Les transitions entre rounds doivent être fluides mais pas précipitées — laisser le groupe respirer
- L'app est un arbitre, pas un animateur

---

## ⏸️ Système de pause (ouvert à tous)

**N'importe quel joueur** peut mettre la partie en pause à tout moment — pendant une révélation, entre deux manches, pendant qu'une personne répond — si un débat s'engage, qu'un imprévu arrive, ou que le groupe a besoin de temps. *(Implémenté : bouton pause haut-droite pour tous ; n'était hôte-only qu'au départ.)*

**Comportement :**
- Bouton pause discret, accessible en permanence par tous
- En pause : tous les écrans affichent un état "en pause" — les timers se figent, aucune action possible
- La reprise est déclenchée par n'importe qui ; "Changer de thème" depuis la pause reste hôte-only
- Pas de timeout automatique — la pause peut durer indéfiniment

**Principe** : l'app suit le rythme du groupe, pas l'inverse.
