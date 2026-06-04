# Kluup — Textes UI v1
> Clés i18n | FR / EN / ES / DE | Mis à jour 04/06/2026

---

## Format

```
clé           → identifiant dans le code
contexte      → où et quand ce texte s'affiche
FR / EN / ES / DE → traductions
```

---

## 1. LOBBY — Création de room

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `lobby.create.title` | Titre écran création | "Créer une partie" | "Create a game" | "Crear una partida" | "Spiel erstellen" |
| `lobby.create.name_placeholder` | Champ pseudo hôte | "Ton prénom" | "Your name" | "Tu nombre" | "Dein Name" |
| `lobby.create.theme_label` | Label sélection thème | "Choisir un thème" | "Choose a theme" | "Elige un tema" | "Wähle ein Thema" |
| `lobby.create.host_plays_label` | Toggle hôte joueur | "Je joue aussi" | "I'm playing too" | "Yo también juego" | "Ich spiele auch" |
| `lobby.create.cta` | Bouton créer | "Créer la room" | "Create room" | "Crear sala" | "Raum erstellen" |

---

## 2. LOBBY — Rejoindre une room

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `lobby.join.title` | Titre écran rejoindre | "Rejoindre une partie" | "Join a game" | "Unirse a una partida" | "Spiel beitreten" |
| `lobby.join.code_placeholder` | Champ code room | "Code de la room" | "Room code" | "Código de sala" | "Raumcode" |
| `lobby.join.name_placeholder` | Champ pseudo joueur | "Ton prénom" | "Your name" | "Tu nombre" | "Dein Name" |
| `lobby.join.cta` | Bouton rejoindre | "Rejoindre" | "Join" | "Unirse" | "Beitreten" |
| `lobby.join.error_not_found` | Room introuvable | "Room introuvable. Vérifie le code." | "Room not found. Check the code." | "Sala no encontrada. Comprueba el código." | "Raum nicht gefunden. Überprüfe den Code." |
| `lobby.join.error_started` | Partie déjà commencée | "Cette partie a déjà commencé." | "This game has already started." | "Esta partida ya ha comenzado." | "Dieses Spiel hat bereits begonnen." |

---

## 3. LOBBY — Salle d'attente

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `lobby.waiting.title` | Titre salle d'attente | "En attente des joueurs" | "Waiting for players" | "Esperando jugadores" | "Warten auf Spieler" |
| `lobby.waiting.room_code_label` | Label code room | "Code de la room" | "Room code" | "Código de sala" | "Raumcode" |
| `lobby.waiting.players_count` | Compteur joueurs | "{n} joueur(s) connecté(s)" | "{n} player(s) connected" | "{n} jugador(es) conectado(s)" | "{n} Spieler verbunden" |
| `lobby.waiting.min_players` | Message min joueurs | "Il faut au moins 3 joueurs pour commencer." | "You need at least 3 players to start." | "Necesitas al menos 3 jugadores para empezar." | "Du brauchst mindestens 3 Spieler, um zu beginnen." |
| `lobby.waiting.host_cta` | Bouton lancer (hôte) | "Lancer la partie" | "Start the game" | "Iniciar la partida" | "Spiel starten" |
| `lobby.waiting.player_waiting` | Message joueur (pas hôte) | "En attente de l'hôte..." | "Waiting for the host..." | "Esperando al anfitrión..." | "Warten auf den Gastgeber..." |
| `lobby.waiting.joined` | Notification nouveau joueur | "{nom} a rejoint la partie" | "{name} joined the game" | "{nombre} se unió a la partida" | "{name} ist dem Spiel beigetreten" |

---

## 4. JEUX — Sélection de la question

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `game.pick.title` | Titre écran sélection | "Choisissez votre question" | "Pick your question" | "Elige tu pregunta" | "Wählt eure Frage" |
| `game.pick.instruction` | Instruction joueur | "Vote pour la question que tu veux jouer." | "Vote for the question you want to play." | "Vota por la pregunta que quieres jugar." | "Stimme für die Frage ab, die du spielen möchtest." |
| `game.pick.waiting_votes` | En attente votes | "En attente des votes... {n}/{total}" | "Waiting for votes... {n}/{total}" | "Esperando votos... {n}/{total}" | "Warten auf Stimmen... {n}/{total}" |
| `game.pick.voted` | Confirmation vote | "Vote enregistré !" | "Vote recorded!" | "¡Voto registrado!" | "Stimme registriert!" |
| `game.pick.round_label` | Indicateur round | "Round {n}/{total}" | "Round {n}/{total}" | "Ronda {n}/{total}" | "Runde {n}/{total}" |

---

## 5. JEUX — Type A (Désignation)

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `game.typeA.instruction` | Instruction joueur | "Vote pour la personne qui correspond le mieux." | "Vote for the person who fits best." | "Vota por la persona que mejor encaja." | "Stimme für die Person ab, die am besten passt." |
| `game.typeA.waiting_votes` | En attente votes | "En attente des votes... {n}/{total}" | "Waiting for votes... {n}/{total}" | "Esperando votos... {n}/{total}" | "Warten auf Stimmen... {n}/{total}" |
| `game.typeA.voted` | Confirmation vote | "Vote enregistré !" | "Vote recorded!" | "¡Voto registrado!" | "Stimme registriert!" |
| `game.typeA.result_title` | Titre révélation | "Le groupe a désigné..." | "The group has chosen..." | "El grupo ha elegido..." | "Die Gruppe hat gewählt..." |
| `game.typeA.result_votes` | Détail votes | "{n} vote(s)" | "{n} vote(s)" | "{n} voto(s)" | "{n} Stimme(n)" |
| `game.typeA.tie` | Égalité | "Égalité ! Le groupe décide." | "It's a tie! The group decides." | "¡Empate! El grupo decide." | "Unentschieden! Die Gruppe entscheidet." |

---

## 6. JEUX — Type B (Confession)

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `game.typeB.instruction` | Instruction joueur | "Est-ce que ça te correspond ?" | "Does this apply to you?" | "¿Esto te corresponde?" | "Trifft das auf dich zu?" |
| `game.typeB.yes` | Bouton oui | "Oui" | "Yes" | "Sí" | "Ja" |
| `game.typeB.no` | Bouton non | "Non" | "No" | "No" | "Nein" |
| `game.typeB.voted` | Confirmation vote | "Réponse enregistrée !" | "Answer recorded!" | "¡Respuesta registrada!" | "Antwort registriert!" |
| `game.typeB.waiting_votes` | En attente votes | "En attente des réponses... {n}/{total}" | "Waiting for answers... {n}/{total}" | "Esperando respuestas... {n}/{total}" | "Warten auf Antworten... {n}/{total}" |
| `game.typeB.b1_result_title` | Titre B1 révélation | "Ce soir, ils ont avoué..." | "Tonight, they confessed..." | "Esta noche, confesaron..." | "Heute Abend haben sie gestanden..." |
| `game.typeB.b1_nobody` | B1 — personne n'a dit oui | "Personne n'a avoué. On vous croit." | "Nobody confessed. We believe you." | "Nadie confesó. Os creemos." | "Niemand hat gestanden. Wir glauben euch." |
| `game.typeB.b2_percent` | B2 — affichage % | "{n}% du groupe a répondu oui." | "{n}% of the group said yes." | "El {n}% del grupo respondió sí." | "{n}% der Gruppe hat Ja gesagt." |
| `game.typeB.b2_roulette_title` | B2 — avant roulette | "La roulette va désigner..." | "The roulette will reveal..." | "La ruleta va a revelar..." | "Das Roulette wird enthüllen..." |
| `game.typeB.b2_result_title` | B2 — révélation | "La roulette a parlé..." | "The roulette has spoken..." | "La ruleta ha hablado..." | "Das Roulette hat gesprochen..." |
| `game.typeB.b2_nobody` | B2 — personne n'a dit oui | "Personne n'a répondu oui. Le secret est gardé." | "Nobody said yes. The secret is safe." | "Nadie dijo sí. El secreto está a salvo." | "Niemand hat Ja gesagt. Das Geheimnis bleibt." |

---

## 7. JEUX — Type C (Question ouverte)

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `game.typeC.instruction_players` | Instruction joueurs | "Un volontaire pour répondre ?" | "Anyone want to volunteer?" | "¿Alguien se ofrece voluntario?" | "Möchte sich jemand freiwillig melden?" |
| `game.typeC.instruction_host` | Instruction hôte | "Attendez un volontaire ou lancez le vote." | "Wait for a volunteer or start the vote." | "Esperad un voluntario o iniciad la votación." | "Wartet auf einen Freiwilligen oder startet die Abstimmung." |
| `game.typeC.host_cta_vote` | Bouton hôte — lancer vote | "Lancer le vote" | "Start the vote" | "Iniciar la votación" | "Abstimmung starten" |
| `game.typeC.host_cta_continue` | Bouton hôte — continuer | "Continuer" | "Continue" | "Continuar" | "Weiter" |
| `game.typeC.vote_instruction` | Instruction vote forcé | "Vote pour quelqu'un qui devrait répondre." | "Vote for someone who should answer." | "Vota por alguien que debería responder." | "Stimme für jemanden ab, der antworten sollte." |
| `game.typeC.result_title` | Titre révélation | "Le groupe a désigné..." | "The group has chosen..." | "El grupo ha elegido..." | "Die Gruppe hat gewählt..." |

---

## 8. PANEL HÔTE

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `host.panel.title` | Titre panel | "Panel hôte" | "Host panel" | "Panel anfitrión" | "Gastgeber-Panel" |
| `host.panel.continue` | Bouton continuer | "Continuer" | "Continue" | "Continuar" | "Weiter" |
| `host.panel.next_round` | Bouton round suivant | "Round suivant" | "Next round" | "Siguiente ronda" | "Nächste Runde" |
| `host.panel.end_session` | Bouton fin session | "Terminer la session" | "End session" | "Terminar sesión" | "Sitzung beenden" |
| `host.panel.new_manche` | Bouton nouvelle manche | "Nouvelle manche" | "New round" | "Nueva manche" | "Neue Runde" |
| `host.panel.players_label` | Label joueurs | "Joueurs" | "Players" | "Jugadores" | "Spieler" |

---

## 9. ÉCRAN DE FIN DE SESSION

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `end.title` | Titre écran fin | "La soirée en chiffres" | "The night in numbers" | "La noche en cifras" | "Der Abend in Zahlen" |
| `end.group_title_label` | Label titre du groupe | "Ce soir vous étiez..." | "Tonight you were..." | "Esta noche erais..." | "Heute Abend wart ihr..." |
| `end.personal_stats_title` | Titre stats perso | "Ta soirée" | "Your night" | "Tu noche" | "Dein Abend" |
| `end.share_cta` | Bouton partager carte | "Partager la soirée" | "Share the night" | "Compartir la noche" | "Den Abend teilen" |
| `end.new_manche_cta` | Bouton nouvelle manche | "Rejouer une manche" | "Play another round" | "Jugar otra ronda" | "Noch eine Runde spielen" |
| `end.end_cta` | Bouton terminer | "Terminer" | "Finish" | "Terminar" | "Beenden" |
| `end.thanks` | Message de fin | "Merci d'avoir joué. À bientôt." | "Thanks for playing. See you soon." | "Gracias por jugar. Hasta pronto." | "Danke fürs Spielen. Bis bald." |

---

## 10. MESSAGES D'ERREUR GÉNÉRIQUES

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `error.connection_lost` | Perte connexion | "Connexion perdue. Reconnexion..." | "Connection lost. Reconnecting..." | "Conexión perdida. Reconectando..." | "Verbindung verloren. Verbinde erneut..." |
| `error.room_closed` | Room fermée | "Cette room a été fermée par l'hôte." | "This room was closed by the host." | "Esta sala fue cerrada por el anfitrión." | "Dieser Raum wurde vom Gastgeber geschlossen." |
| `error.generic` | Erreur générique | "Une erreur est survenue. Réessaie." | "Something went wrong. Try again." | "Algo salió mal. Inténtalo de nuevo." | "Etwas ist schiefgelaufen. Versuch es erneut." |

---

## 11. THÈMES — Noms et descriptions

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `theme.hello_stranger.name` | Nom thème | "Hello Stranger" | "Hello Stranger" | "Hello Stranger" | "Hello Stranger" |
| `theme.hello_stranger.desc` | Description courte | "On se découvre." | "Getting to know each other." | "Nos conocemos." | "Wir lernen uns kennen." |
| `theme.apero.name` | Nom thème | "Apéro" | "Apéro" | "Apéro" | "Apéro" |
| `theme.apero.desc` | Description courte | "On se détend." | "Loosening up." | "Nos relajamos." | "Wir entspannen uns." |
| `theme.nofilter.name` | Nom thème | "No Filter" | "No Filter" | "No Filter" | "No Filter" |
| `theme.nofilter.desc` | Description courte | "On se lâche." | "No holding back." | "Sin filtros." | "Kein Zurückhalten." |
| `theme.unmasked.name` | Nom thème | "Unmasked" | "Unmasked" | "Unmasked" | "Unmasked" |
| `theme.unmasked.desc` | Description courte | "On se révèle." | "Revealing ourselves." | "Nos revelamos." | "Wir enthüllen uns." |

---

## 12. LABELS DE TYPE DE QUESTION

| Clé | Contexte | FR | EN | ES | DE |
|---|---|---|---|---|---|
| `type.a.label` | Badge Type A | "Désignation" | "Callout" | "Designación" | "Benennung" |
| `type.b.label` | Badge Type B | "Confession" | "Confession" | "Confesión" | "Geständnis" |
| `type.c.label` | Badge Type C | "Volontariat" | "Volunteer" | "Voluntario" | "Freiwillig" |

- Toutes les clés sont en dot notation : `section.sous-section.element`
- Les variables dynamiques sont entre accolades : `{n}`, `{nom}`, `{total}`
- Pour le MVP : seul le FR est actif. Les autres langues sont prêtes mais désactivées.
- Fichier source de vérité pour le système i18n — aucun texte ne doit être hardcodé dans le code.
