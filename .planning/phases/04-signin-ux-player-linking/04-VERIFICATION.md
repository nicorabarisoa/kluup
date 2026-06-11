---
phase: "04"
phase_name: signin-ux-player-linking
status: complete
verified: 2026-06-11
requirements_verified: [AUTH-01, AUTH-03, IDEN-02]
plans_verified: 4
plans_total: 4
---

# Phase 04 Verification — signin-ux-player-linking

## Goal

Brancher l'authentification Google OAuth optionnelle (Supabase Auth) sur la landing page, la page join, le lobby et le header de jeu. Le flux anonyme reste structurellement inchangé.

## Verdict: ✓ COMPLETE

Tous les livrables sont présents en base de code. Les 4 plans ont été exécutés sans déviations majeures. Le build TypeScript est propre.

---

## Vérification par requirement

### AUTH-01 — Bouton "Se connecter" (sign-in pill)
**Status: ✓ VERIFIED**

- `app/page.tsx` : pill sign-in/sign-out dans la barre supérieure (lignes ~85-90, ~211-230)
- `app/join/page.tsx` : pill sign-in/sign-out identique (lignes ~43-48, ~211-220)
- Textes via i18n `fr.auth.sign_in` / `fr.auth.sign_out` — zéro texte hardcodé
- Guard `authLoading` sur les deux pages — pas de flash d'état incorrect
- `signInWithOAuth({ provider: 'google' })` confirmé sur les deux call sites

### AUTH-03 — Bouton "Se déconnecter" (sign-out)
**Status: ✓ VERIFIED**

- `supabase.auth.signOut()` wired sur landing et join
- Chip connecté (prénom + "Se déconnecter") affiché quand `user` est non-null
- `handleSignOut` → `setUser(null)` → `router.push('/')`

### IDEN-02 — Reconnexion cross-device via user_id
**Status: ✓ VERIFIED**

- `app/join/page.tsx` lignes ~132-150 : bloc IDEN-02 avec `.eq('room_id').eq('user_id').maybeSingle()`
- Scopé avec double filtre (room_id + user_id) — Pitfall 5 respecté
- Guard `user && !stored` : le chemin localStorage reste prioritaire
- Sur erreur DB : dégradation silencieuse vers l'insert normal (pas de crash)

---

## Vérification par plan

### 04-01 — Auth i18n namespace
**Status: ✓ VERIFIED**

`lib/i18n.ts` : clés `auth.sign_in`, `auth.sign_out`, `auth.pseudo_prefilled_hint` présentes dans les 4 blocs locaux (`fr`, `en`, `es`, `de`). Le type `Dict = typeof fr` propage la contrainte d'exhaustivité vers les autres locales.

### 04-02 — Indicateur vert (green dot)
**Status: ✓ VERIFIED**

- `app/room/[code]/game/page.tsx` : prop `isSignedIn?: boolean` sur `RoundHeader`; dot `#22c55e` 6px conditionnel; propagé via les 8 composants d'écran vers les 9 call sites
- `app/room/[code]/lobby/page.tsx` : `isSignedIn` state + dot identique sur le bouton Quitter
- Flux anonyme inchangé (aucun dot, aucun nouveau gating)

### 04-03 — Auth sur la page join
**Status: ✓ VERIFIED**

- Auth hook + pill confirmés (`signInWithOAuth`, `signOut`, `authLoading`)
- IDEN-02 bloc présent et correctement scopé
- `user_id: user?.id ?? null` dans l'insert joueur
- `googlePrefill` state + hint `fr.auth.pseudo_prefilled_hint` wired

### 04-04 — Auth sur la landing page
**Status: ✓ VERIFIED**

- Auth hook + pill confirmés (même pattern que join)
- `user_id: user?.id ?? null` dans l'insert joueur hôte (players, pas rooms)
- `googlePrefill` state + hint `fr.auth.pseudo_prefilled_hint` wired
- `host_id: genId()` sur rooms inchangé (NOT NULL en prod)

---

## Qualité

| Critère | Statut |
|---|---|
| Build TypeScript (`npx tsc --noEmit`) | ✓ Propre (0 erreur) |
| Flux anonyme inchangé | ✓ Vérifié (guards `user?.id ?? null` partout) |
| Zéro texte hardcodé | ✓ (tous les strings auth via `fr.auth.*`) |
| i18n 4 langues complètes | ✓ fr/en/es/de |
| DoS mitigation (getUser once) | ✓ `useEffect` mount-only |

## Issues connues (code review)

Issues relevées dans `04-REVIEW.md` — non bloquantes pour la complétude fonctionnelle mais à traiter avant le déploiement prod :

- **CR-01** (Critical) — Pre-fill Google parfois raté sur join (effet stale)
- **CR-02** (Critical) — `console.log` qui leake le code de room en prod
- **CR-03** (Critical) — `signInWithOAuth` sans `redirectTo` — le round-trip OAuth peut perdre `?code=`
- **WR-01** (Warning) — Pas de `onAuthStateChange` — état auth stale après refresh JWT
- **WR-02** (Warning) — `getFirstName()` dupliquée dans landing et join

Recommandation : lancer `/gsd-code-review 4 --fix` avant le push en prod.

---

*Vérifié le 2026-06-11*
