# Checklist de playtest — v2.0 Auth & Stats (phases 02-04)

> Un seul parcours de partie qui couvre les 19 vérifications humaines en attente.
> **Besoin :** 3 joueurs minimum (4 idéal pour le test n°15), au moins 1 compte Google,
> téléphones réels de préférence (le test n°16 exige un verrouillage d'écran physique).
> Durée estimée : une partie normale + ~10 min de manipulations.

## Pré-requis (avant la soirée)

- [ ] Déploiement Railway vert sur le commit `0fbc47a` ou plus récent
- [ ] Supabase → Authentication → URL Configuration : `https://kluup.app` dans les **Redirect URLs**

---

## Bloc A — Landing & auth Google (1 personne, 3 min)

1. [ ] **Landing** : badge « Sans compte obligatoire » visible, logo blanc + vert en haut **et** en footer
2. [ ] **Sign-in Google depuis la landing** : clic « Se connecter » → Google → retour sur la landing, chip prénom affiché, champ pseudo pré-rempli avec le prénom Google
3. [ ] **Sign-out** : clic « Se déconnecter » → on **reste sur la page** (pas de redirect)

## Bloc B — Création / join + cas d'erreur (3 joueurs, 5 min)

4. [ ] **Hôte connecté Google** crée une room → arrive au lobby
5. [ ] **Joueur 2** ouvre le lien copié (`/join?code=XXX`) → code pré-rempli sur la page join
6. [ ] **Pseudo dupliqué (SC-1)** : Joueur 3 tente le pseudo de Joueur 2 en casse différente (« Nico » vs « nico ») → **erreur inline sous le champ** (« Ce pseudo est déjà pris… »), pas d'alert, Joueur 2 non affecté
7. [ ] Joueur 3 reprend un autre pseudo → rejoint normalement
8. [ ] **OAuth conserve le code (CR-03)** : un joueur fait « Se connecter » depuis `/join?code=XXX` → après le round-trip Google, il **revient sur `/join?code=XXX`** (le code n'est pas perdu)

## Bloc C — Pendant la partie (7 manches couvrent les types A/B/C)

9. [ ] **Lancement** : tous les joueurs naviguent automatiquement vers le jeu
10. [ ] **Type A** : vote anonyme, révélation du/des désignés (ex-aequo tous affichés)
11. [ ] **Refresh mi-vote (SC-5)** : pendant un timer de vote, un joueur rafraîchit la page → le timer reprend au **temps restant** (~30 − écoulé), pas à 30 s
12. [ ] **Type B** : oui/non secret, % affiché, roulette sur tous les pseudos → 1 seul « oui » révélé (si l'occasion se présente : 0 oui → « secret gardé » ; 100 % → moutons 🐑)
13. [ ] **Type C sans timer (SC-5b)** : phase « volontaire / bûcher » → **aucun anneau de compte à rebours**, la manche n'avance que quand tous ont agi (ou skip hôte)
14. [ ] **Type C, 0 volontaire (SC-7)** : sur une manche C, tout le monde choisit « bûcher » → écran **roulette de désignation** (pas « répond à voix haute »), pas de crash
15. [ ] **Joueur en cours de manche (SC-8)** : un 4ᵉ joueur rejoint pendant une phase de choix Type C → le compteur reste **X/3** (pas X/4), la manche se résout à 3 actions, toast « a rejoint la partie », il joue à la manche suivante
16. [ ] **Présence (SC-2)** : un joueur verrouille son écran <15 s → toujours dans le roster au retour. Plus tard : il ferme l'onglet >15 s → sa ligne disparaît du roster
17. [ ] **Pause** : un **non-hôte** met en pause → tous les écrans figés ; n'importe qui reprend
18. [ ] **Session auth stable (02-UAT)** : le joueur connecté Google navigue/rafraîchit en cours de partie → toujours connecté, pas de re-login

## Bloc D — Fin de partie & replay

19. [ ] **Écran de fin** : titre du groupe + stat marquante + stats perso ; **carte de partage** s'exporte (Web Share sur mobile → Photos, sinon download)
20. [ ] **Replay (régression connue)** : hôte « Rejouer » → tout le monde revient au lobby, nouveau thème, **2ᵉ partie : les votes passent** (pas de « votes non acceptés »)
21. [ ] **Re-join pré-rempli (SC-4)** : un joueur clique « Quitter », retourne sur `/join?code=XXX` → ancien pseudo **pré-rempli + hint visible**, champ éditable, re-join sur submit explicite
22. [ ] **Reconnexion cross-device (IDEN-02)** : le joueur Google quitte, ouvre le lien de la room sur un **autre appareil/navigateur** connecté au même compte → reconnecté silencieusement sur sa ligne existante (**pas de doublon** dans le roster)

## Bloc E — Cycle de vie des rooms (après la partie, 2 min chrono)

23. [ ] **Sweep pg_cron (SC-3)** : tous ferment leurs onglets **sans cliquer Quitter** → attendre ~70 s → tenter de rejoindre le code → « Room introuvable »
24. [ ] **Contre-test heartbeat** : une room avec 1 onglet resté ouvert survit ~2 min sans être supprimée

---

## En cas d'échec

Noter le numéro du test + ce qui s'est passé (capture si possible). Les numéros mappent
sur : SC-x = `.planning/phases/03-playtest-quality-fixes/03-VERIFICATION.md`,
CR-x/IDEN-x = `.planning/phases/04-signin-ux-player-linking/`.
