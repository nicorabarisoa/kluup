# Phase 4: Sign-in UX + Player Linking - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface optional Google sign-in UI on the landing page and join page. Show a minimal auth indicator in the game header. Wire signed-in identity (`auth.uid()`) into `players.user_id` on insert, and handle multi-device reconnection via `user_id` lookup (IDEN-02). The anonymous game flow must remain completely unaffected.

**In scope:** sign-in button (landing + join), sign-out, signed-in state display, Google display name pre-fill for pseudo, `players.user_id` populated on insert, IDEN-02 multi-device reconnection.

**Out of scope:** stats writing (Phase 5), `/profile` page (Phase 5), premium gating, avatar sync.

</domain>

<decisions>
## Implementation Decisions

### Sign-in Button Placement
- **D-01:** Sign-in button appears on **landing page** and **join page** only. No sign-in button on lobby, game, or end screen.
- **D-02:** On the landing page, the sign-in button lives in the **top bar, alongside the LangSwitch** — same row as the logo. When signed out: `"Se connecter"` button. When signed in: `"[Prénom] · Se déconnecter"`.
- **D-03:** On the join page, the sign-in option appears in the same top-bar zone (above the form).

### Post-Auth Redirect
- **D-04:** After OAuth completes (`/auth/callback`), always redirect to `/` (landing). No `redirect_to` param, no return-to-previous-page logic. The existing `app/auth/callback/route.ts` already implements this — no change needed.

### Signed-in State Display
- **D-05:** When signed in, top bar shows: `[Prénom Google] · [Se déconnecter]` — prénom only (not full name, not avatar). This replaces the sign-in button.
- **D-06:** In the game header (`RoundHeader`), signed-in state is indicated by a **small green dot on the Quit button** only — no text, no name. Ultra-minimal. The lobby and end screen follow the same pattern (RoundHeader is shared).
- **D-07:** Sign-out triggers `supabase.auth.signOut()` and refreshes the page (or navigates to `/`).

### Google Display Name → Pseudo
- **D-08:** When a signed-in user is on the landing page (creates room) or join page, the pseudo input is **pre-filled with their Google display name** (`user.user_metadata.full_name` or `user.user_metadata.name`, split to first name). The field remains editable — the user can change it freely.
- **D-09:** The pseudo used in the game is whatever the user typed (or kept). No enforcement that it matches the Google name. Pseudo = game identity; account = stats identity. The two are independent.

### `players.user_id` Linking
- **D-10:** When inserting a new player row (join or create-room flow), include `user_id: session?.user?.id ?? null` in the insert payload. If the user is anonymous, `user_id` is `null` — same as today. If signed in, `user_id` is set.
- **D-11:** The client reads the current Supabase auth session via `supabase.auth.getUser()` (authoritative, no stale-session risk) immediately before the player insert. This is a single async call, non-blocking to the rest of the flow.

### Multi-Device Reconnection (IDEN-02)
- **D-12:** On the join page, if the user is signed in, after fetching the room, check for an existing player row: `SELECT * FROM players WHERE room_id = $room_id AND user_id = $uid LIMIT 1`. If found: store that player id in localStorage (`setPlayerId(code, row.id)`), skip insert, and navigate to lobby/game directly. **Silently reconnect — no confirmation UI.**
- **D-13:** If no existing row found for that `user_id` in the room (new room, first device), fall through to the normal insert path with `user_id` set.
- **D-14:** IDEN-02 check is only attempted when the user is signed in. Anonymous users follow the unchanged localStorage path.

### Claude's Discretion
- Auth state retrieval pattern: `supabase.auth.getUser()` in a `useEffect` on landing and join pages, storing result in component state. No global auth context needed for Phase 4 (only 2 pages need it).
- Sign-out: call `supabase.auth.signOut()` then `router.refresh()` (or `router.push('/')`) to clear UI state.
- Green dot on Quit button: implemented as a small CSS `::after` circle (or a `relative` positioned `<span>`) — 6px, `#22c55e`, no interaction.
- Pseudo pre-fill: use `user.user_metadata.full_name?.split(' ')[0]` for first name. Fallback to `user.email?.split('@')[0]` if no display name.
- RLS stays fully open (anon policies unchanged) — user_id is self-reported by the client in Phase 4. Tightening RLS is a Phase 5+ concern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Infrastructure (Phase 2 — already implemented)
- `middleware.ts` + `lib/supabase/middleware.ts` — token refresh on all pages; do not modify
- `app/auth/callback/route.ts` — PKCE code exchange; redirects to `/`; do not modify
- `.planning/phases/02-auth-infrastructure-schema/02-CONTEXT.md` — decisions D-01 through D-04 from Phase 2 (session_uuid, callback behavior, library choices)

### DB Schema
- `supabase/schema.sql` — source of truth; `players.user_id` nullable FK already added in Phase 2
- `CLAUDE.md` §"Modèle de données (Supabase)" — `players` table spec, `host_id NOT NULL` constraint on prod (do not touch)
- `CLAUDE.md` §"Cycle de vie des rooms" — existing quit/host-transfer/reconnect logic must not regress

### Pages to Modify
- `app/page.tsx` — landing page; add sign-in button to top bar, pseudo pre-fill from Google name
- `app/join/page.tsx` — join page; add sign-in button, IDEN-02 user_id lookup, pseudo pre-fill, `user_id` on insert
- `app/room/[code]/game/page.tsx` — `RoundHeader` component; add green dot indicator when signed in
- `app/room/[code]/lobby/page.tsx` — lobby page; add green dot indicator (RoundHeader pattern)

### Requirements
- `.planning/REQUIREMENTS.md` §Authentication (AUTH-01, AUTH-03) and §Player Identity (IDEN-02)
- `.planning/ROADMAP.md` §Phase 4 — 5 success criteria are the acceptance targets

### Existing Utilities
- `lib/supabase.ts` — existing browser client (`createClient`); use `supabase.auth.getUser()` for auth state
- `lib/utils.ts` — `getPlayerId`/`setPlayerId`/`clearPlayerId` — localStorage identity per room; IDEN-02 uses `setPlayerId` to store reconnected player id
- `lib/locale.tsx` — `LangSwitch` component pattern; sign-in button sits in same top-bar row

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LangSwitch` component (`lib/locale.tsx`) — already in the top bar of landing, join, lobby. The sign-in button and signed-in state chip go in the same row, to the left of LangSwitch.
- `lib/utils.ts` `setPlayerId` / `getPlayerId` — IDEN-02 reconnect path writes the recovered `player.id` via this helper so the rest of the flow works unchanged.
- `supabase.auth.getUser()` — available on the existing browser client (`lib/supabase.ts`); returns `{ data: { user }, error }`.

### Established Patterns
- All pages are `'use client'` — auth state is read via `useEffect` + `useState`, same pattern as `getPlayerId`.
- Player insert already uses a spread payload — adding `user_id` is a one-field addition.
- The join page's reconnect path (`getPlayerId` + `maybeSingle` row check) is the model for the IDEN-02 `user_id` lookup — same shape, different lookup key.

### Integration Points
- `app/page.tsx` top bar (line ~109): `<span>Kluup</span>` + `<LangSwitch />` — sign-in button inserts between them or to the left of LangSwitch.
- `app/join/page.tsx` `joinRoom()` (line ~48): player insert is here — add `user_id` to the payload.
- `app/room/[code]/game/page.tsx` `RoundHeader` component — the Quit button is rendered here; green dot is a CSS addition.
- `app/room/[code]/lobby/page.tsx` top bar (line ~202): same Quit + LangSwitch pattern as in game.

### Potential Pitfalls
- `supabase.auth.getUser()` makes a network call on every mount — cache the result in a `useRef` or call it once per page, not on every render.
- `user.user_metadata.full_name` may be `undefined` for some Google accounts — always have a fallback (email prefix).
- RLS on `players` is fully open (anon insert/select/update/delete) — adding `user_id` to the insert does not require RLS changes in Phase 4. The value is trusted client-side. Phase 5 will tighten if needed.

</code_context>

<deferred>
## Deferred Ideas

- Avatar/photo de profil Google sur le `/profile` — déféré Phase 5
- `redirect_to` post-auth pour retourner sur la page précédente — décidé hors scope (toujours `/`)
- RLS strict sur `players.user_id` (vérifier que le client ne peut pas forger un user_id) — déféré Phase 5+

</deferred>

---

*Phase: 04-signin-ux-player-linking*
*Context gathered: 2026-06-11*
