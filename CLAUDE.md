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
- `app/page.tsx` — **landing page** sur `/` (hero avec form créer room + pseudo + join intégré, "comment ça marche", thèmes, types, CTA final, footer). Responsive : colonne centrée mobile → grilles multi-colonnes (thèmes ×4, types/étapes ×3) sur desktop via breakpoints `sm:`/`md:`. LangSwitch en haut.
- `app/join/page.tsx` — rejoindre via code (wrap `Suspense` pour `useSearchParams`, lien retour accueil).
- `app/room/[code]/lobby/page.tsx` — lobby temps réel, sélecteur de thème (hôte), bouton "Lancer".
- `app/room/[code]/game/page.tsx` — **TOUTE la page de jeu** : tous les écrans + state machine + handlers (gros fichier).
- `app/layout.tsx` — fonts **Bricolage Grotesque** (display, var `--font-display-face`) + **DM Sans** (corps, var `--font-body-face`) via next/font + `<LocaleProvider>`. globals.css mappe `--font-display` / `--font-body` (noms agnostiques → swap facile).
- `lib/types.ts` — `Player`, `Question`, `GameState`, `GamePhase`, `Room`, etc.
- `lib/game.ts` — moteur pur : `pickCandidates`, `pickType`, `tallyDesignation`, `tallyQuestionSelection`, `accumulateStats`, `computeGroupTitle`, `countVotes`, `countChoiceVotes`, `fetchVotes`, `makeInitialGameState`, `updateRoomGameState`. (`pickBSubtype` supprimé — confession toujours roulette.)
- `lib/i18n.ts` — dictionnaires `fr` + `en` (mêmes clés, typés `Dict`), `dictionaries`, `Locale`, `defaultLocale`, `localeNames`.
- `lib/locale.tsx` — `LocaleProvider`, hooks `useT()` / `useLocale()`, composant `LangSwitch`.
- `lib/usePresence.ts` — `useRoomPresence(roomId, myId)` : présence + prune fantômes + heartbeat.
- `lib/supabase.ts` — client (warn console si env manquantes).
- `lib/utils.ts` — `genId` / `copyToClipboard` (fallbacks contexte non-sécurisé / HTTP LAN) + `getPlayerId`/`setPlayerId`/`clearPlayerId` (identité par room en localStorage → reconnexion sans doublon).
- `supabase/schema.sql` — **SOURCE DE VÉRITÉ DB, idempotent**. CREATE TABLE rooms/players/questions/votes + RLS ouvert + realtime (rooms/players/votes) + contraintes (UNIQUE code, FK cascade) + default `status='waiting'`. **À exécuter pour provisionner OU réparer une base** (notamment "Room introuvable").
- `supabase/migration.sql` — **legacy** : ne CRÉE PAS rooms/players (ALTER seul), n'active pas leur RLS/realtime. Conservé pour historique ; préférer `schema.sql`.
- `supabase/seed.sql` + `seed_themes.sql` — questions.
- `supabase/seed_cut.sql` — **78 questions adultes** (source CUT.xlsx, reformulées fun + courtes, FR/EN/ES/DE) remappées sur `apero` (23, léger), `no-filter` (15, moyen), `unmasked` (40, hot/NSFW). Types C50/B26/A2, intensités 1-3. **Exécuter UNE SEULE FOIS** (pas de clé unique sur le texte → ré-exécution = doublons).
- `supabase/lifecycle.sql` — cleanup rooms (cascade players, `last_activity` + trigger, `cleanup_dead_rooms()` TTL 30 min, pg_cron optionnel). **Déjà exécuté.**
- `supabase/rls.sql` — sous-ensemble RLS-only de `schema.sql` (fix rapide si "Room introuvable").
- `.env.example` — vars Supabase.

### Modèle de données (Supabase)
- `rooms` : id, code (**UNIQUE**), **status** `'waiting'|'playing'|'ended'` (défaut DB `'waiting'` après `schema.sql` ; legacy `'lobby'` traité comme `'waiting'`), theme, **game_state** (jsonb), **host_id** (jamais lu MAIS **`NOT NULL` en base réelle → TOUJOURS le fournir à l'insert via `genId()`**, sinon erreur 23502 et création de room cassée), created_at, last_activity.
- `players` : id, room_id (→rooms **ON DELETE CASCADE**), pseudo, is_host, is_online (vestigial, non lu), created_at.
- `votes` : id, room_id (CASCADE), round, player_id (→players CASCADE), **vote_type** `'question_selection'|'designation'|'confession'|'volunteer'`, target_player_id, answer, question_index. UNIQUE(room_id, round, player_id, vote_type).
- `questions` : id, theme, type (A/B/C), intensity (1-3), question jsonb `{fr,en,es,de}`.
- RLS ouvert (MVP) : anon select/insert/update/delete sur rooms & players, select/insert/delete sur votes. **`schema.sql` rend cet état explicite** (l'ancien `migration.sql` ne l'activait pas → cause de "Room introuvable").
- **Realtime** : `rooms`, `players`, `votes` dans la publication `supabase_realtime` (cf `schema.sql`). Sans `players`, les joueurs n'apparaissent pas en temps réel au lobby.

### GameState (jsonb)
`phase, round, candidates[], current_question, b_subtype, designated_player_id` (B2 + roulette Type C), `designated_player_ids[]` + `designation_tie_all` (Type A), `revealed_player_ids[], yes_percentage, volunteer_player_ids[], played_question_ids[], paused, stats, b2_revealed`.
GamePhase : `voting_question, round_a_vote, round_a_reveal, round_b_vote, round_b2_roulette, round_c_choice, round_c_volunteers_reveal, round_c_roulette, ended`. **MAX_ROUNDS = 7.** (`round_b1_reveal` supprimé : confession = toujours roulette.)

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
- Timer 30 s (composant `VoteTimer`) sur toutes les phases de vote. **Toujours monté** (plus gated `!hasVoted`) et **keyé par `gs.round`** → l'advancer élu (plus petit `player.id`) déclenche `onForce` à l'expiration de façon fiable, même s'il a déjà voté (sinon son timer disparaissait et l'auto-skip ne partait jamais). Refs synchronisées dans un effect (pas pendant le render).
- Filet manuel : bouton **"passer sans attendre les absents"** — **hôte-only** — sur les phases de vote.
- Roster qui rétrécit pendant un vote (fantôme pruné) → l'hôte revérifie le compte réel et avance auto.

### Cycle de vie des rooms
- **Identité joueur persistée par room** (`lib/utils.ts` : `getPlayerId`/`setPlayerId`/`clearPlayerId`, clé `kluup_pid_<CODE>` en **localStorage**, fallback `sessionStorage` legacy). Survit à la fermeture du navigateur → **reconnexion sans doublon**. `join` réutilise la row existante si l'id stocké est encore dans le roster (sinon insert). `onQuit` appelle `clearPlayerId`. ⚠️ Ne PAS revenir au `sessionStorage.getItem('player_id')` global (vidé à la fermeture → recréait une row = doublon, bug vécu).
- **Quit explicite** (bouton "Quitter", tous) : si hôte → transfert au plus ancien restant ; si dernier → suppression room (cascade players+votes).
- **Présence** (lobby+jeu) : déconnexion → après **60 s de grâce** (anti phone-lock), un client élu (plus petit id présent) supprime la row fantôme ; **heartbeat 2 min** rafraîchit `last_activity`.
- **Balayage** `cleanup_dead_rooms()` (RPC opportuniste appelé à la création de room) : supprime les rooms **sans aucun client connecté depuis 30 min**. pg_cron = option pour le 100 % auto (2 lignes en commentaire dans lifecycle.sql).

### i18n
- `useT()` → dictionnaire actif. Convention : **`const fr = useT()`** dans chaque composant (les usages `fr.xxx` restent inchangés). Helpers non-composants reçoivent le dico en param (`momentStat(..., t)`).
- Questions rendues via `q.question[locale]`.
- Détection : localStorage > navigator.language > `fr`. `LangSwitch` (menu déroulant) sur landing/join/lobby.
- **4 langues UI complètes** : `fr`, `en`, `es`, `de` dans `lib/i18n.ts` (le type `Dict` force l'exhaustivité des clés). `LangSwitch` est un **menu déroulant** (noms complets + ✓), extensible à N langues. Pour ajouter une langue : nouveau dico typé `Dict` + entrée `localeNames`.

### ⚠️ Gotchas / ops
- **`NEXT_PUBLIC_*` inlinées au BUILD** : définir dans Railway → Variables PUIS **redéployer** (un restart ne suffit pas), sinon création de room cassée en prod.
- Scripts SQL à exécuter dans Supabase : **`schema.sql`** (source de vérité, idempotent) + `seed.sql`/`seed_themes.sql` + `lifecycle.sql`. `migration.sql` est legacy.
- **"Room introuvable" / "la room existe puis disparaît"** = cause #1 racine : RLS activé sur `rooms` sans policy SELECT anon → le SELECT renvoie 0 ligne **sans erreur**. **Fix : exécuter `supabase/schema.sql`** (ou `rls.sql`). Diagnostic : la console logue `[join] lookup:` / `[lobby] room not found:` avec l'erreur PostgREST exacte. Vérifier aussi que les vars Railway pointent sur le bon projet Supabase.
- **Lobby sans formulaire d'entrée** = cause #2 racine : un visiteur arrivant sur `/room/[code]/lobby` (URL barre d'adresse partagée) sans `player_id` n'avait aucun moyen de saisir un pseudo. Le lobby **redirige maintenant vers `/join?code=XXX`** si pas de `player_id` OU si le player_id n'est pas dans le roster. Le bouton "Copier le lien" pointe vers `/join?code=XXX` — partager CE lien, pas l'URL du lobby.
- **`build` Next 16** : `next build` ne fait PAS échouer sur les erreurs ESLint (lint séparé). Quelques `react-hooks/set-state-in-effect` subsistent (patterns `setTimeout`→`setShown` idiomatiques) — non bloquants.
- `onPause` / `onResume` utilisent `roomRef.current.game_state` (pas le state React) pour éviter les stale closures et la désynchronisation.
- **Code de room** : 6 chars d'un alphabet sans ambiguïté (pas de 0/O/1/I), retry sur collision UNIQUE (`23505`). Ne pas revenir à `Math.random().substring` (pouvait produire < 6 chars).
- **`host_id` `NOT NULL`** : la création de room **DOIT** envoyer `host_id` (`insert({ code, host_id: genId() })`). L'omettre = erreur `23502` → création cassée (régression déjà vécue : retrait de host_id en croyant le champ inutile). `schema.sql` le déclare nullable pour les bases neuves, mais la base prod existante l'a en `NOT NULL` (le `CREATE TABLE IF NOT EXISTS` ne modifie pas une table déjà créée).
- **Responsive / desktop** : tout est en **colonne centrée à largeur max** (jamais pleine largeur). Jeu : `GameScreen` enveloppe header/body/footer dans `mx-auto maxWidth 448` (`max-w-md`) → boutons de footer ne s'étirent plus sur PC. Lobby : contenu dans `max-w-md mx-auto`. Landing : sections `max-w-4xl mx-auto` avec grilles `md:grid-cols-*`. ⚠️ Le screenshot du preview se met à l'échelle bizarrement en >mobile — **vérifier le centrage via `getBoundingClientRect()` (DOM), pas à l'œil sur la capture**.
- Carte : NE PAS revenir à html2canvas. modern-screenshot capture une **copie hors-écran à taille réelle** (540×540) — l'aperçu en `transform:scale` faussait les mesures (rognage).

### Décisions playtest — NE PAS régresser
- **Type A** : pas de tie-break aléatoire (tous les ex-aequo affichés ; égalité totale = écran "Décevant" — **Type A UNIQUEMENT**). Self-vote autorisé. Texte "Assume… ou plaide ta cause" à la révélation.
- **Type C** repensé (cf section dédiée) : phase unique, volontaires priment, roulette si égalité, **jamais d'écran "Décevant"**.
- **Confession (Type B) = roulette unique** (B1/B2 supprimés, playtest #3) : roue sur tous les pseudos → 1 seul "oui" révélé. NE PAS réintroduire B1/`pickBSubtype`.
- **Replay (même lobby)** : `startGame` **DOIT** vider les votes de la room (`votes.delete().eq('room_id', …)`) avant de relancer. Sinon les manches recommencent à 1 et la contrainte `UNIQUE(room_id, round, player_id, vote_type)` rejette les nouveaux votes (= "votes non acceptés / joueurs pas détectés"). Régression déjà vécue.
- Pas deux fois le même type d'affilée (`pickType` exclut le type précédent).
- **Intensité ignorée à la sélection** (`pickCandidates` tire au hasard) — choix volontaire pour l'imprévisibilité ; le thème borne la spice. Colonne `intensity` gardée en base. Ne pas réintroduire la rampe sans le redemander.
- Réafficher la question sur les écrans de réponse à voix haute.
- Export carte via Web Share API mobile (→ Photos), fallback download.
- **Timer vote 30 s** (pas 15 s, pas sur les révélations). Seul l'advancer le déclenche à l'expiration.
- **Sélection de question** : feedback visuel immédiat (fond coloré + bordure pleine + ✓) dès le tap, les autres questions s'opacifient à 40 %.
- **"Manche suivante" hôte-only** — ne pas remettre ce bouton pour tous (risque de troll / spam).
- **"Passer sans attendre" hôte-only** — idem.
- **`onPause`/`onResume`** : toujours lire `roomRef.current.game_state`, jamais le state React — évite les désync pause/reprise.

### Fait récemment (session 4)
Landing page responsive (`/`) · stats perso (écran de fin + carte de partage) · i18n ES/DE complet + LangSwitch déroulant · Quitter/Pause intégrés au `RoundHeader` · adaptation desktop (colonnes centrées) · **fix régression `host_id` NOT NULL** · 78 questions adultes (`seed_cut.sql`) · **confession = roulette unique** (B1/B2 supprimés) · **fix replay : purge des votes au lancement** · moutons 🐑 à 100 %.

### Reste à faire / idées
stats perso détaillées (diversité des votes) · thèmes premium / paywall · plus de questions par thème · analytics questions · polish/juice · pg_cron si cleanup 100 % auto voulu · **session de test réel à 3-4 joueurs** (priorité avant nouvelles features). *(Écran "hôte joue ou pas" : abandonné — l'hôte est toujours joueur.)*

**Prochains chantiers premium (non implémentés, direction validée) :**
- **Custom Theme** — mode où les joueurs créent eux-mêmes les questions avant la partie (cf section dédiée ci-dessous).
- **Configuration des manches** — nombre de manches paramétrable (5/7/15/custom) ; `MAX_ROUNDS` doit devenir une config de room en base, plus une constante hardcodée.
- **Profil social & archétypes** — tags sur les questions → scores par trait → archétype personnel en fin de partie (cf section dédiée ci-dessous et `docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md`).

---

## 🎭 Profil social & archétypes — direction validée

> Spec complète : `docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md`. Ce résumé sert de source de vérité rapide pour le développement.

### Principe
Chaque question possède un champ `tags jsonb` (ex. `[{"tag":"drôle","points":2}]`). Les comportements en jeu alimentent des scores par trait. En fin de partie, chaque joueur reçoit un archétype personnel affiché sur sa carte de partage.

### Les 6 traits
`drole` · `fiable` · `audacieux` · `empathique` · `mysterieux` · `romantique`

### Attribution des points
- **Type A** : le/les joueurs désignés reçoivent les points
- **Type B** : le joueur ayant voté "oui" reçoit les points (lu depuis ses propres votes — anonymat préservé)
- **Type C volontaires** : les volontaires reçoivent les points
- **Type C roulette** : le joueur désigné reçoit les points
- Les points peuvent être **négatifs** (un tag peut diminuer un trait)

### Calcul (côté client, fin de partie)
1. Fetch `votes WHERE player_id = myId` depuis Supabase
2. Pour chaque question jouée : appliquer les tags si le joueur était "acteur"
3. Floor à 0 par trait → calcul des % → détermination de l'archétype

### Archétypes (21 total + fallback)
**Simples (trait > 50 %)** : Le Farceur (drôle) · Le Confident (fiable) · Le Leader (audacieux) · Le Diplomate (empathique) · Le Mystérieux (mystérieux) · Le Romantique (romantique)

**Hybrides (2 traits co-dominants, écart < 15 %, tous deux > 25 %)** :
L'Agitateur (drôle+audacieux) · L'Âme de la fête (drôle+empathique) · Le Joker (drôle+mystérieux) · Le Clown Fidèle (drôle+fiable) · Le Séducteur Maladroit (drôle+romantique) · Le Pilier (fiable+empathique) · Le Capitaine (fiable+audacieux) · L'Amoureux Loyal (fiable+romantique) · Le Loup Solitaire (audacieux+mystérieux) · Le Séducteur (audacieux+romantique) · Le Protecteur (audacieux+empathique) · Le Rêveur (empathique+romantique) · L'Ombre Bienveillante (empathique+mystérieux) · L'Inaccessible (mystérieux+romantique) · Le Gardien (mystérieux+fiable)

**Fallback** : Une simple personne

### Affichage carte de partage
Bloc ajouté sous les stats perso existantes : nom de l'archétype + top 3 traits avec barres de progression et %.

### Livraison en 2 temps
- **Étape 1 (prochaine)** : session uniquement — migration SQL `tags`, curation des questions, calcul client, carte de partage
- **Étape 2 (Phase 5)** : cross-session — champ `tag_scores jsonb` dans `user_session_stats`, archétype cumulé sur `/profile`

---

## 🎮 Flow global d'une session

```
App propose 3 questions (tirées aléatoirement dans le thème — intensité ignorée, ordre imprévisible)
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

### Type B — Confession collective ("t'as déjà…") — *(roulette unique, refonte playtest #3)*
Chaque joueur se désigne **lui-même** s'il se sent concerné. Vote secret (oui/non). Révélation **toujours en roulette** (les sous-modes B1/B2 ont été **supprimés**) :
1. Affichage du % du groupe ("67 % se sont reconnus")
2. La roulette défile sur **tous les pseudos** (oui ET non, pour le suspense / ne pas leaker le pool) puis s'arrête sur **une seule personne** ayant répondu "oui"
3. Les autres "oui" restent anonymes — tension individuelle
4. Cas limites : **0 oui** → "secret gardé" ; **100 % oui** → écran moutons 🐑 (personne n'est désigné)

> Le bouton "Révéler" (lancement de la roulette) reste ouvert à tous. `b_subtype` reste à `'B2'` en base pour la continuité des stats. Conséquence titres : `title_transparent`/`title_daring` (dépendaient de B1) ne se déclenchent plus ; un groupe très "confession" tombe sur `title_unfathomable`.

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
| Réponses Type B | Roulette : une seule personne (parmi les "oui") révélée, les autres anonymes |

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
- `intensity` : 1 / 2 / 3 *(relatif au thème, pas absolu)* — **conservée en base mais IGNORÉE par la sélection** (cf ci-dessous).
- `question` : `{ fr: "...", en: "...", es: "...", de: "..." }`

**Sélection actuelle : intensité IGNORÉE.** `pickCandidates` tire 3 questions **au hasard** du type choisi dans le thème (plus de rampe légère→profonde). Volontaire : le **thème** borne déjà l'intensité globale, l'aléatoire rend la partie imprévisible. La colonne `intensity` reste en base (réversible si on veut réactiver la montée progressive). Seule règle d'ordre conservée : pas deux fois le même type d'affilée.

### Système analytics interne (post-MVP)
Chaque question trackée : taux de sélection, taux de complétion, taux de skip → auto-cycling pour éviter la répétition.

---

## 🎯 Système de gages — hors scope v1

Les gages sont retirés du core game. L'app ne sanctionne pas les refus — la dynamique sociale du groupe gère.

> **Post-v1** : mode optionnel "Dare pack" activable par l'hôte pour les groupes qui veulent cette dimension.

---

## 🖥️ Écrans de la page de jeu

### L'hôte est TOUJOURS joueur — décision figée
**L'hôte joue toujours** (compté dans `players.length`, vote/répond comme tout le monde). L'idée d'un écran "hôte joue ou pas" a été **abandonnée** — ne pas la réintroduire. L'hôte garde seulement quelques pouvoirs (cf "Rôle de l'hôte (réduit)").

> En jeu, **tout le monde** a : **pause** et **"Quitter"** (intégrés au `RoundHeader`). Cf "Rôle de l'hôte (réduit)" dans la section technique.

---

### Écrans Type A

**Écran 1A — Affichage question**
| | Hôte | Joueurs |
|---|---|---|
| Affichage | Question + "Les joueurs votent…" + compteur | Question + liste des pseudos à voter |
| Action | Voter pour quelqu'un (l'hôte joue aussi) | Voter pour quelqu'un |
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
| Action | Répondre oui/non (l'hôte joue aussi) | Répondre oui/non |
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

### Plan de monétisation — DIRECTION FUTURE (⚠️ NON IMPLÉMENTÉ, ne pas coder sans validation)
> Décidé en discussion produit. Sert de cap, pas encore construit. Le MVP actuel n'a **aucune auth ni paiement**.

**Modèle = par hôte (style Jackbox), déblocage permanent.**
- **L'hôte doit être inscrit** (compte) même en gratuit total. Les **joueurs restent invités** (anonymes) OU inscrits — le join reste 100 % frictionless.
- **Hôte gratuit** : accès aux thèmes gratuits, **limite de 2 sessions par thème gratuit** (1 session = 1 lancement de partie, compté **côté serveur**).
- **Quota épuisé → cooldown 12 h** **sur l'hôte uniquement** (PAS les joueurs — décision : bloquer les joueurs est injuste, inapplicable sur les anonymes, et fait fuir au lieu de convertir).
- Quand l'hôte est capé : **mur "Limite atteinte — débloque l'illimité (X €)" affiché à TOUTE la room** → pression sociale (l'hôte achète, ou un autre membre devient hôte payant). Même incentive, zéro frustration.
- **Tout achat** (un thème OU un mode payant) → **illimité, plus aucune limite** (lève le cap partout, y compris sur les gratuits). Acheter un thème payant = accès à CE thème **+** statut illimité.
- **Joueur premium présent = la room hérite des avantages** : si l'hôte n'est pas premium mais qu'un **joueur connecté avec un compte premium** est dans la room, la room joue en premium. Vérif serveur : *"hôte premium OU un joueur de la room a un compte premium"*. Vaut tant qu'il est présent (ligne `players` liée à un compte premium) ; s'il part, retour au palier de l'hôte à la **prochaine** partie (on ne coupe pas la partie en cours). Levier de croissance assumé (le premium = ambassadeur), au prix d'une **cannibalisation** acceptée en lancement (1 acheteur peut couvrir un groupe quand il est là) — *tunable plus tard*.

**Faisabilité / implémentation (quand on y va) :**
- **Auth hôte + joueurs premium** : Supabase Auth (magic link / Google). `players`/rooms liés à un `user_id`.
- **Entitlements** : table `entitlements (user_id, produit, date)` + statut "illimité".
- **Quota** : compteur `(host_user_id, theme, count, window_start)` pour 2 sessions + cooldown 12 h.
- **Stripe** : Checkout + webhook (route API Next) → accorde l'entitlement.
- ⚠️ **Gating OBLIGATOIREMENT côté serveur** : aujourd'hui tout est client + RLS ouvert → contournable en 30 s. Le check limite/déblocage doit vivre dans un **RPC `start_game()` `SECURITY DEFINER`** (vérif atomique entitlement/quota) + **RLS resserré**. C'est le vrai morceau (on quitte le "trust the client" du MVP).
- **Fuites acceptées** (nudge, pas coffre-fort) : cap contournable en recréant un compte ; unlock-par-joueur-premium cannibalise. Ne pas sur-investir dans l'anti-triche.

**Décisions encore ouvertes :** quels thèmes exactement gratuits vs payants (figer le split) · packaging (à-la-carte thèmes vs "Pass illimité") · prix.

**Ordre de build recommandé :** 1) auth hôte · 2) free/paid thèmes + entitlements (gating serveur) · 3) Stripe · 4) cap 2 sessions + cooldown 12 h (le plus fiddly, en dernier).

---

## 🗺️ Roadmap modes de jeu

- **MVP** : Classic (flow décrit ci-dessus)
- **V2 premium** : Custom Theme (questions collaboratives — cf section dédiée) + Configuration des manches
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

## 🎨 Mode Custom Theme (premium) — ⚠️ NON IMPLÉMENTÉ, direction validée

> Analogie produit : **playlist collaborative Spotify** — l'hôte crée l'espace, tout le monde y contribue des questions avant le lancement.

### Concept

Premium uniquement. L'hôte choisit "Custom Theme" au lieu d'un thème prédéfini. Aucune question prédéfinie n'est chargée — la session démarre avec une liste vide.

Cas d'usage cibles : anniversaires, EVG/EVJF, mariages, team buildings, groupes avec des références internes impossibles à proposer dans les thèmes standards.

### Flow

```
Hôte crée une pré-room → choisit "Custom Theme (Premium)"
       ↓
Partage le code/lien d'invitation
       ↓
Les joueurs rejoignent et ajoutent des questions (en temps réel via Supabase)
       ↓
Hôte modère (supprime/réorganise) et lance la partie quand prêt
       ↓
La pré-room devient une room de jeu standard → flow Classic normal
```

### Permissions de contribution

| Action | Hôte | Joueurs |
|---|---|---|
| Ajouter une question | ✅ | ✅ |
| Modifier sa propre question avant lancement | ✅ | ✅ |
| Supprimer sa propre question avant lancement | ✅ | ✅ |
| Supprimer n'importe quelle question | ✅ | ❌ |
| Réorganiser l'ordre des questions | ✅ | ❌ |
| Lancer la partie | ✅ | ❌ |

### Modèle de données (à concevoir)

- Les questions custom doivent être stockées séparément des questions de la table `questions` (pour ne pas polluer le catalogue global).
- Table candidate : `custom_questions (id, room_id, author_player_id, text, type, position, created_at)` — à modéliser proprement lors de l'implémentation.
- Synchronisation en temps réel via Supabase Realtime (comme `players` et `votes`).
- Compatible avec le flow de jeu existant : au lancement, les questions custom alimentent `pickCandidates` à la place des questions de la table `questions`.

### Contraintes techniques
- i18n : les questions custom sont saisies par les joueurs dans leur langue — **pas de traduction automatique**. Le champ `text` est une string libre, pas un jsonb multilingue.
- Aucun texte hardcodé dans l'UI (libellés boutons, placeholders, messages d'erreur → i18n).
- Mobile-first, synchronisation temps réel.
- Extensible pour de futurs modes communautaires ou partagés.

---

## ⚙️ Configuration des manches (premium) — ⚠️ NON IMPLÉMENTÉ, direction validée

> Disponible pour tout hôte ayant acheté **Custom Theme ou tout autre pack premium**.

### Concept

Avant de lancer une session (thème standard **ou** Custom Theme), l'hôte peut choisir le nombre de manches.

| Option | Label | Valeur |
|---|---|---|
| Fast life | 5 manches | 5 |
| Standard *(défaut actuel)* | 7 manches | 7 |
| Grind | 15 manches | 15 |
| Personnalisé | Saisie libre | N |

### Contrainte de refactoring obligatoire

`MAX_ROUNDS = 7` dans `app/room/[code]/game/page.tsx` est actuellement une **constante hardcodée**. Elle doit devenir une **configuration de room stockée en base** :

- Nouveau champ `max_rounds INTEGER DEFAULT 7` sur la table `rooms`.
- Toute la logique de progression (`round >= MAX_ROUNDS`, conditions de fin) doit lire `room.max_rounds` au lieu de la constante.
- Le moteur de jeu (`lib/game.ts`) reçoit `maxRounds` en paramètre — plus d'import de constante globale.
- Interface lobby : slider ou sélecteur, hôte-only, visible avant le lancement ; valeur envoyée à l'insert/update de la room.

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
