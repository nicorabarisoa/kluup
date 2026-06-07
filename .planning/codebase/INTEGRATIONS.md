# External Integrations

**Analysis Date:** 2026-06-07

## Supabase

- **Purpose:** Primary backend — Postgres database, Realtime pub/sub channels, and presence tracking. There is no separate API server; the Next.js client talks directly to Supabase via the JS SDK.
- **SDK/Client:** `@supabase/supabase-js ^2.107.0` — single shared client exported from `lib/supabase.ts`
- **Project ref:** `dmxjspnrrgcixzcthgwf` (visible in `CLAUDE.md`; not hardcoded in app source)
- **Config:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (build-time inlining)

**Usage patterns:**

| Feature | Channel / API | Files |
|---------|--------------|-------|
| Room CRUD | `.from('rooms').select/insert/update/delete` | `app/room/[code]/lobby/page.tsx`, `app/room/[code]/game/page.tsx`, `app/page.tsx` |
| Player CRUD | `.from('players').select/insert/update/delete` | `app/join/page.tsx`, `app/room/[code]/lobby/page.tsx`, `app/room/[code]/game/page.tsx` |
| Vote CRUD | `.from('votes').select/insert/delete` | `app/room/[code]/game/page.tsx` |
| Question fetching | `.from('questions').select` filtered by theme/type | `app/room/[code]/game/page.tsx`, `lib/game.ts` |
| Lobby Realtime | `lobby-${code}` channel — `postgres_changes` on players INSERT/DELETE + rooms UPDATE (navigate on `playing`) | `app/room/[code]/lobby/page.tsx` |
| Game Realtime | `game-${code}` channel — `postgres_changes` on rooms UPDATE + players INSERT/DELETE/UPDATE | `app/room/[code]/game/page.tsx` |
| Vote broadcast | `votes-broadcast-${roomId}` channel — `broadcast` events `vote_count` / `phase_changed` → all clients refetch | `app/room/[code]/game/page.tsx` |
| Presence | `presence-${roomId}` channel — tracks online players, prunes ghosts after 60 s grace, heartbeat every 2 min | `lib/usePresence.ts` |
| Dead room cleanup | `.rpc('cleanup_dead_rooms')` called on room creation | `app/page.tsx` |

**RLS posture (MVP):** Open — anon role has select/insert/update/delete on `rooms`/`players`, select/insert/delete on `votes`. Source of truth: `supabase/schema.sql`.

**Realtime publication:** Tables `rooms`, `players`, `votes` are in `supabase_realtime` publication (configured in `supabase/schema.sql`).

**Key gotcha:** Missing vars at build time → client created with empty strings → all requests fail silently from the user's perspective. `lib/supabase.ts` logs a `console.error` to make the cause visible.

---

## modern-screenshot

- **Purpose:** Captures the end-of-game share card as a PNG image from a DOM node. Used for the "Partager la soirée" feature on the results screen.
- **SDK/Client:** `modern-screenshot ^4.7.0` — imported directly in `app/room/[code]/game/page.tsx`
- **Config:** No API key or env var required — pure client-side DOM rendering
- **Why not html2canvas:** html2canvas distorted custom fonts (`Bricolage Grotesque`, `DM Sans`). `modern-screenshot` renders an off-screen copy at full resolution (540×540) without the `transform: scale` measurement issues that caused cropping with html2canvas.

**Usage pattern:**
- The share card DOM node is rendered off-screen at 540×540
- `modern-screenshot` captures it to a `Blob`/data URL
- On mobile: Web Share API (`navigator.share`) → saves to Photos
- Fallback: programmatic `<a download>` link

---

## Railway (Hosting)

- **Purpose:** Production hosting for the Next.js app
- **SDK/Client:** No SDK — deployment is git-push based
- **Config:** Environment variables set in Railway → Variables dashboard. Must match `.env.example` keys. Changes require a new build (not just a restart) because `NEXT_PUBLIC_*` vars are baked in at build time.
- **Build command:** `next build`
- **Start command:** `next start`
- **Cost:** ~10 €/month at MVP scale

---

## Web Share API (Browser Native)

- **Purpose:** Mobile share sheet for the end-of-game card ("Partager la soirée" → saves to Photos)
- **SDK/Client:** `navigator.share` — no package, browser-native
- **Config:** None
- **Fallback:** `<a href="..." download>` for browsers that don't support the Share API (desktop, Firefox)

---

## No other integrations detected

The following are **not present** in the current codebase:

| Service | Status |
|---------|--------|
| Stripe | Not implemented (planned for future monetisation) |
| Supabase Auth | Not implemented (all players are anonymous; auth planned for host accounts) |
| Error tracking (Sentry, etc.) | Not detected |
| Analytics (PostHog, Plausible, etc.) | Not detected |
| pg_cron | Optional extension mentioned in `supabase/lifecycle.sql` comments; not confirmed active |
| Push notifications | Not implemented |

---

*Integration audit: 2026-06-07*
