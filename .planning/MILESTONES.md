# Milestones

## v2.0 — Auth & Stats ✅ SHIPPED 2026-06-12

**Phases:** 2–5 | **Plans:** 21 | **Commits:** ~174
**Timeline:** 2026-06-10 → 2026-06-12 (3 days)

**Delivered:** Optional Google OAuth accounts with cross-session stats persistence — anonymous game flow structurally unchanged.

**Key accomplishments:**
1. `@supabase/ssr` auth plumbing: middleware JWT refresh, PKCE callback, server client
2. `players.user_id` nullable FK + `user_session_stats` table with scoped RLS
3. 8 playtest quality fixes: duplicate pseudo, presence grace, pg_cron sweep, refresh-safe timer, frozen Type C denominator
4. Google OAuth pill on landing + join; IDEN-02 cross-device reconnect; `user_id` on player inserts
5. EndScreen stats upsert (idempotent); TOKEN_REFRESHED Realtime refresh; anonymous sign-in CTA
6. `/profile` page with cumulative grid + last-20 history + dormant archetype block
7. `PendingStatsFlusher` — stats survive room sweep during slow OAuth sign-in
8. `cleanup_dead_rooms()` CASE TTL: ended rooms survive 30 min (defense-in-depth)

**Known deferred items at close:** 9 acknowledged (5 stale debug sessions, 1 UAT diagnostic, 3 human_needed verifications — all confirmed passing by user)

**Archive:** `.planning/milestones/v2.0-ROADMAP.md` | `.planning/milestones/v2.0-REQUIREMENTS.md`
