# Kluup — Titres de groupe v1
> 10 titres | Logique de déclenchement | Textes adaptatifs | i18n FR/EN/ES/DE
> Mis à jour 04/06/2026

---

## Format de chaque titre

```
CLÉ i18n                    → identifiant unique dans le code
Condition                   → logique de déclenchement basée sur les stats de session
Thème associé               → thème dominant pour lequel ce titre est le plus pertinent
Ton                         → registre émotionnel du texte
Stats personnelles prioritaires → ordre de priorité dans le pool dynamique
```

---

## 🎯 Pool de stats personnelles dynamiques

L'app affiche **3 stats par joueur** parmi ce pool, en priorisant les valeurs les plus hautes ou les plus significatives. Une stat n'est affichée que si elle est pertinente (n > 0, ou condition remplie).

| Clé stat | Condition d'affichage | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `stat_most_designated` | joueur le plus désigné de la session | `Tu as été désigné {n} fois — plus que quiconque ce soir.` | `You were called out {n} times — more than anyone tonight.` | `Te señalaron {n} veces — más que nadie esta noche.` | `Du wurdest {n} Mal genannt — mehr als alle anderen heute Abend.` |
| `stat_designated` | n > 0 | `Tu as été désigné {n} fois ce soir.` | `You were called out {n} times tonight.` | `Te señalaron {n} veces esta noche.` | `Du wurdest heute Abend {n} Mal genannt.` |
| `stat_never_designated` | n = 0 | `Tu n'as jamais été désigné ce soir. Discret ou chanceux ?` | `You were never called out tonight. Sneaky or lucky?` | `Nunca te señalaron esta noche. ¿Discreto o con suerte?` | `Du wurdest heute Abend nie genannt. Unauffällig oder Glück gehabt?` |
| `stat_confessions` | n > 0 | `Tu as fait {n} confession(s) ce soir.` | `You made {n} confession(s) tonight.` | `Hiciste {n} confesión/confesiones esta noche.` | `Du hast heute Abend {n} Geständnis/se gemacht.` |
| `stat_volunteered` | n > 0 | `Tu t'es porté volontaire {n} fois — courage ou curiosité ?` | `You volunteered {n} times — brave or just curious?` | `Te ofreciste voluntario {n} veces — ¿valentía o curiosidad?` | `Du hast dich {n} Mal freiwillig gemeldet — Mut oder Neugier?` |
| `stat_roulette` | n > 0 | `La roulette t'a désigné {n} fois. Le hasard te connaît bien.` | `The roulette landed on you {n} times. Fate knows you well.` | `La ruleta te eligió {n} veces. El azar te conoce bien.` | `Das Roulette hat {n} Mal auf dich gezeigt. Das Schicksal kennt dich gut.` |
| `stat_voted_same` | même personne votée 3+ fois | `Tu as voté {n} fois pour la même personne. On a remarqué.` | `You voted for the same person {n} times. We noticed.` | `Votaste {n} veces por la misma persona. Lo hemos notado.` | `Du hast {n} Mal für dieselbe Person gestimmt. Wir haben es bemerkt.` |
| `stat_diverse_votes` | 4+ personnes différentes votées | `Tu as désigné {n} personnes différentes ce soir. Égalitaire.` | `You called out {n} different people tonight. Very democratic.` | `Señalaste a {n} personas diferentes esta noche. Muy democrático.` | `Du hast heute Abend {n} verschiedene Personen genannt. Sehr demokratisch.` |

> **Logique de sélection** : pour chaque joueur, l'app trie les stats disponibles par pertinence (record = priorité max, n élevé = priorité haute) et affiche les 3 premières. `stat_never_designated` est une wildcard drôle affichée si le joueur n'a jamais été désigné.

---

## 1. Les Implacables

**Clé i18n** : `title_ruthless`
**Condition** : taux Type A > 60% ET votes concentrés sur peu de personnes
**Thème associé** : No Filter
**Ton** : direct, légèrement provoc
**Stats personnelles prioritaires** : `stat_most_designated` → `stat_designated` → `stat_diverse_votes` → `stat_voted_same`

### 🇫🇷 Français
**Titre** : Les Implacables
**Texte groupe** : Ce soir votre groupe n'a fait de cadeaux à personne. Vous avez désigné sans hésiter et assumé chaque choix.
**Stat groupe** : `"{nom}" a été désigné {n} fois — record de la soirée.`

### 🇬🇧 English
**Title** : The Ruthless
**Group text** : Tonight your group showed no mercy. You pointed fingers without hesitation and owned every choice.
**Group stat** : `"{name}" was called out {n} times — tonight's record.`

### 🇪🇸 Español
**Título** : Los Implacables
**Texto grupo** : Esta noche vuestro grupo no perdonó a nadie. Señalasteis sin dudar y asumisteis cada elección.
**Stat grupo** : `"{nombre}" fue señalado {n} veces — récord de la noche.`

### 🇩🇪 Deutsch
**Titel** : Die Erbarmungslosen
**Gruppentext** : Heute Abend hat eure Gruppe niemanden verschont. Ihr habt ohne Zögern mit dem Finger gezeigt und jede Wahl getragen.
**Gruppenstat** : `"{name}" wurde {n} Mal genannt — Rekord des Abends.`

---

## 2. Les Transparents

**Clé i18n** : `title_transparent`
**Condition** : taux Type B > 60% ET sous-mode B1 dominant (révélation totale)
**Thème associé** : Hello Stranger / Apéro
**Ton** : chaleureux, légèrement complice
**Stats personnelles prioritaires** : `stat_confessions` → `stat_designated` → `stat_never_designated` → `stat_volunteered`

### 🇫🇷 Français
**Titre** : Les Transparents
**Texte groupe** : Ce soir tout le monde s'est montré. Pas de masque, pas de cachette — votre groupe a joué le jeu à fond.
**Stat groupe** : `{n}% du groupe a avoué au moins une fois ce soir.`

### 🇬🇧 English
**Title** : The Open Books
**Group text** : Tonight everyone showed up as themselves. No masks, no hiding — your group played it all the way.
**Group stat** : `{n}% of the group confessed at least once tonight.`

### 🇪🇸 Español
**Título** : Los Transparentes
**Texto grupo** : Esta noche todos se mostraron tal como son. Sin máscaras, sin escondites — vuestro grupo jugó hasta el final.
**Stat grupo** : `El {n}% del grupo confesó al menos una vez esta noche.`

### 🇩🇪 Deutsch
**Titel** : Die Offenen
**Gruppentext** : Heute Abend hat sich jeder so gezeigt, wie er wirklich ist. Keine Masken, kein Verstecken — eure Gruppe hat voll mitgespielt.
**Gruppenstat** : `{n}% der Gruppe hat heute Abend mindestens einmal gestanden.`

---

## 3. Les Mystérieux

**Clé i18n** : `title_mysterious`
**Condition** : taux Type B > 60% ET sous-mode B2 dominant (roulette)
**Thème associé** : Hello Stranger / Unmasked
**Ton** : légèrement énigmatique, amusé
**Stats personnelles prioritaires** : `stat_roulette` → `stat_confessions` → `stat_never_designated` → `stat_designated`

### 🇫🇷 Français
**Titre** : Les Mystérieux
**Texte groupe** : Ce soir personne n'a tout dit. La roulette a parlé pour vous — et elle avait ses raisons.
**Stat groupe** : `La roulette a désigné {nom} {n} fois ce soir.`

### 🇬🇧 English
**Title** : The Mysterious Ones
**Group text** : Tonight nobody said everything. The roulette spoke for you — and it had its reasons.
**Group stat** : `The roulette landed on {name} {n} times tonight.`

### 🇪🇸 Español
**Título** : Los Misteriosos
**Texto grupo** : Esta noche nadie lo dijo todo. La ruleta habló por vosotros — y tenía sus razones.
**Stat grupo** : `La ruleta eligió a {nombre} {n} veces esta noche.`

### 🇩🇪 Deutsch
**Titel** : Die Geheimnisvollen
**Gruppentext** : Heute Abend hat niemand alles gesagt. Das Roulette hat für euch gesprochen — und es hatte seine Gründe.
**Gruppenstat** : `Das Roulette hat heute Abend {n} Mal auf {name} gezeigt.`

---

## 4. Les Courageux

**Clé i18n** : `title_brave`
**Condition** : taux Type C élevé ET beaucoup de volontaires sans vote forcé
**Thème associé** : Tous thèmes
**Ton** : chaleureux, admiratif
**Stats personnelles prioritaires** : `stat_volunteered` → `stat_confessions` → `stat_designated` → `stat_never_designated`

### 🇫🇷 Français
**Titre** : Les Courageux
**Texte groupe** : Ce soir votre groupe n'a pas attendu qu'on les désigne. Vous avez levé la main — et ça change tout.
**Stat groupe** : `{n} fois ce soir quelqu'un s'est porté volontaire sans y être forcé.`

### 🇬🇧 English
**Title** : The Brave Ones
**Group text** : Tonight your group didn't wait to be called out. You raised your hand — and that changes everything.
**Group stat** : `{n} times tonight someone volunteered without being pushed.`

### 🇪🇸 Español
**Título** : Los Valientes
**Texto grupo** : Esta noche vuestro grupo no esperó a que los señalaran. Levantasteis la mano — y eso lo cambia todo.
**Stat grupo** : `{n} veces esta noche alguien se ofreció voluntario sin que nadie le obligara.`

### 🇩🇪 Deutsch
**Titel** : Die Mutigen
**Gruppentext** : Heute Abend hat eure Gruppe nicht gewartet, bis jemand mit dem Finger auf euch zeigt. Ihr habt die Hand gehoben — und das macht den Unterschied.
**Gruppenstat** : `{n} Mal heute Abend hat sich jemand freiwillig gemeldet, ohne dazu gedrängt zu werden.`

---

## 5. Les Prudents

**Clé i18n** : `title_cautious`
**Condition** : taux Type C élevé ET vote forcé souvent (peu de volontaires)
**Thème associé** : Hello Stranger
**Ton** : amusé, légèrement taquin
**Stats personnelles prioritaires** : `stat_never_designated` → `stat_designated` → `stat_volunteered` → `stat_confessions`

### 🇫🇷 Français
**Titre** : Les Prudents
**Texte groupe** : Ce soir personne ne s'est précipité. Vous avez attendu que la désignation parle à votre place — et on vous comprend.
**Stat groupe** : `Ce soir le groupe a dû voter {n} fois faute de volontaires.`

### 🇬🇧 English
**Title** : The Cautious Ones
**Group text** : Tonight nobody rushed in. You waited for the vote to speak for you — and we get it.
**Group stat** : `Tonight the group had to vote {n} times because nobody volunteered.`

### 🇪🇸 Español
**Título** : Los Prudentes
**Texto grupo** : Esta noche nadie se precipitó. Esperasteis a que la votación hablara por vosotros — y os entendemos.
**Stat grupo** : `Esta noche el grupo tuvo que votar {n} veces por falta de voluntarios.`

### 🇩🇪 Deutsch
**Titel** : Die Vorsichtigen
**Gruppentext** : Heute Abend hat sich niemand beeilt. Ihr habt gewartet, bis die Abstimmung für euch gesprochen hat — und das verstehen wir.
**Gruppenstat** : `Heute Abend musste die Gruppe {n} Mal abstimmen, weil sich niemand freiwillig gemeldet hat.`

---

## 6. Les Sans Filtre

**Clé i18n** : `title_nofilter`
**Condition** : thème No Filter ou Unmasked + taux Type A élevé
**Thème associé** : No Filter
**Ton** : cash, direct, légèrement provoc
**Stats personnelles prioritaires** : `stat_most_designated` → `stat_diverse_votes` → `stat_voted_same` → `stat_designated`

### 🇫🇷 Français
**Titre** : Les Sans Filtre
**Texte groupe** : Ce soir votre groupe a dit ce qu'il pensait. Vraiment. Sans arrondir les angles, sans ménager personne.
**Stat groupe** : `Ce soir {n} désignations différentes ont été prononcées dans le groupe.`

### 🇬🇧 English
**Title** : The Unfiltered
**Group text** : Tonight your group said what it thought. For real. No softening, no sparing anyone.
**Group stat** : `Tonight {n} different people were called out in the group.`

### 🇪🇸 Español
**Título** : Los Sin Filtro
**Texto grupo** : Esta noche vuestro grupo dijo lo que pensaba. De verdad. Sin suavizar, sin perdonar a nadie.
**Stat grupo** : `Esta noche {n} personas diferentes fueron señaladas en el grupo.`

### 🇩🇪 Deutsch
**Titel** : Die Ungefilterten
**Gruppentext** : Heute Abend hat eure Gruppe gesagt, was sie denkt. Wirklich. Ohne Abstriche, ohne jemanden zu schonen.
**Gruppenstat** : `Heute Abend wurden {n} verschiedene Personen in der Gruppe genannt.`

---

## 7. Les Complices

**Clé i18n** : `title_accomplices`
**Condition** : thème Hello Stranger + session complète jouée
**Thème associé** : Hello Stranger
**Ton** : chaleureux, légèrement ému
**Stats personnelles prioritaires** : `stat_volunteered` → `stat_confessions` → `stat_designated` → `stat_never_designated`

### 🇫🇷 Français
**Titre** : Les Complices
**Texte groupe** : Vous êtes arrivés en étrangers et repartez en complices. C'est exactement pour ça que Kluup existe.
**Stat groupe** : `Ce soir le groupe a joué {n} rounds ensemble.`

### 🇬🇧 English
**Title** : The Accomplices
**Group text** : You arrived as strangers and leave as accomplices. That's exactly what Kluup is for.
**Group stat** : `Tonight the group played {n} rounds together.`

### 🇪🇸 Español
**Título** : Los Cómplices
**Texto grupo** : Llegasteis como desconocidos y os vais como cómplices. Para eso existe exactamente Kluup.
**Stat grupo** : `Esta noche el grupo jugó {n} rondas juntos.`

### 🇩🇪 Deutsch
**Titel** : Die Komplizen
**Gruppentext** : Ihr seid als Fremde gekommen und geht als Komplizen. Genau dafür gibt es Kluup.
**Gruppenstat** : `Heute Abend hat die Gruppe {n} Runden zusammen gespielt.`

---

## 8. Les Téméraires

**Clé i18n** : `title_daring`
**Condition** : thème Unmasked + taux B1 élevé (révélation totale dominante)
**Thème associé** : Unmasked
**Ton** : sincère, presque poétique
**Stats personnelles prioritaires** : `stat_confessions` → `stat_volunteered` → `stat_roulette` → `stat_designated`

### 🇫🇷 Français
**Titre** : Les Téméraires
**Texte groupe** : Ce soir votre groupe a choisi de se montrer vraiment. Pas à moitié — vraiment. C'est rare, et c'est beau.
**Stat groupe** : `Ce soir {n}% du groupe s'est révélé lors des confessions collectives.`

### 🇬🇧 English
**Title** : The Daring Ones
**Group text** : Tonight your group chose to really show up. Not halfway — really. That's rare, and it's beautiful.
**Group stat** : `Tonight {n}% of the group revealed themselves during collective confessions.`

### 🇪🇸 Español
**Título** : Los Temerarios
**Texto grupo** : Esta noche vuestro grupo eligió mostrarse de verdad. No a medias — de verdad. Es raro, y es hermoso.
**Stat grupo** : `Esta noche el {n}% del grupo se reveló durante las confesiones colectivas.`

### 🇩🇪 Deutsch
**Titel** : Die Wagemutigen
**Gruppentext** : Heute Abend hat eure Gruppe gewählt, sich wirklich zu zeigen. Nicht zur Hälfte — wirklich. Das ist selten, und es ist schön.
**Gruppenstat** : `Heute Abend hat sich {n}% der Gruppe bei den kollektiven Geständnissen gezeigt.`

---

## 9. Les Insondables

**Clé i18n** : `title_unfathomable`
**Condition** : taux B2 très élevé (roulette dominante sur toute la session)
**Thème associé** : Tous thèmes
**Ton** : mystérieux, légèrement ironique
**Stats personnelles prioritaires** : `stat_roulette` → `stat_never_designated` → `stat_confessions` → `stat_designated`

### 🇫🇷 Français
**Titre** : Les Insondables
**Texte groupe** : Ce soir la roulette a tout décidé. Et même elle n'a pas tout dit. Certains secrets restent entiers.
**Stat groupe** : `La roulette a tourné {n} fois ce soir — et chaque fois quelqu'un a dû assumer.`

### 🇬🇧 English
**Title** : The Unfathomable
**Group text** : Tonight the roulette decided everything. And even it didn't say it all. Some secrets remain whole.
**Group stat** : `The roulette spun {n} times tonight — and each time someone had to own it.`

### 🇪🇸 Español
**Título** : Los Insondables
**Texto grupo** : Esta noche la ruleta lo decidió todo. Y ni ella lo dijo todo. Algunos secretos permanecen intactos.
**Stat grupo** : `La ruleta giró {n} veces esta noche — y cada vez alguien tuvo que asumir.`

### 🇩🇪 Deutsch
**Titel** : Die Unergründlichen
**Gruppentext** : Heute Abend hat das Roulette alles entschieden. Und selbst es hat nicht alles gesagt. Manche Geheimnisse bleiben ganz.
**Gruppenstat** : `Das Roulette hat heute Abend {n} Mal gedreht — und jedes Mal musste jemand es tragen.`

---

## 10. Les Inclassables

**Clé i18n** : `title_unclassifiable`
**Condition** : mix équilibré de tous les types — aucun pattern dominant
**Thème associé** : Tous thèmes
**Ton** : complice, légèrement amusé
**Stats personnelles prioritaires** : `stat_designated` → `stat_confessions` → `stat_volunteered` → `stat_diverse_votes`

### 🇫🇷 Français
**Titre** : Les Inclassables
**Texte groupe** : Ce soir votre groupe a tout fait — désigné, avoué, sacrifié des volontaires. Impossible à cerner. Parfait.
**Stat groupe** : `Ce soir le groupe a joué {nA} désignations, {nB} confessions et {nC} questions ouvertes.`

### 🇬🇧 English
**Title** : The Unclassifiable
**Group text** : Tonight your group did it all — called people out, confessed, sacrificed volunteers. Impossible to pin down. Perfect.
**Group stat** : `Tonight the group played {nA} callouts, {nB} confessions and {nC} open questions.`

### 🇪🇸 Español
**Título** : Los Inclasificables
**Texto grupo** : Esta noche vuestro grupo lo hizo todo — señaló, confesó, sacrificó voluntarios. Imposible de definir. Perfecto.
**Stat grupo** : `Esta noche el grupo jugó {nA} señalamientos, {nB} confesiones y {nC} preguntas abiertas.`

### 🇩🇪 Deutsch
**Titel** : Die Unklassifizierbaren
**Gruppentext** : Heute Abend hat eure Gruppe alles gemacht — genannt, gestanden, Freiwillige geopfert. Unmöglich zu fassen. Perfekt.
**Gruppenstat** : `Heute Abend hat die Gruppe {nA} Nennungen, {nB} Geständnisse und {nC} offene Fragen gespielt.`

---

## 📊 Résumé des conditions

| Clé | Condition principale | Thème associé |
|---|---|---|
| `title_ruthless` | Type A > 60% + votes concentrés | No Filter |
| `title_transparent` | Type B > 60% + B1 dominant | Hello Stranger / Apéro |
| `title_mysterious` | Type B > 60% + B2 dominant | Hello Stranger / Unmasked |
| `title_brave` | Type C élevé + beaucoup de volontaires | Tous |
| `title_cautious` | Type C élevé + peu de volontaires | Hello Stranger |
| `title_nofilter` | No Filter/Unmasked + Type A élevé | No Filter |
| `title_accomplices` | Hello Stranger + session complète | Hello Stranger |
| `title_daring` | Unmasked + B1 élevé | Unmasked |
| `title_unfathomable` | B2 très élevé sur toute la session | Tous |
| `title_unclassifiable` | Mix équilibré, aucun pattern dominant | Tous |

---

## 📝 Variables dynamiques

| Variable | Description |
|---|---|
| `{nom}` / `{name}` / `{nombre}` / `{name}` | Pseudo du joueur le plus désigné |
| `{n}` | Chiffre calculé selon la stat concernée |
| `{nA}` `{nB}` `{nC}` | Nombre de questions par type joué |

> Toutes les variables sont générées côté client à partir des stats de session — zéro appel API, zéro coût.
