# Requirements: Kluup

**Defined:** 2026-06-07
**Core Value:** Creating genuine human moments through structured social questions — the app triggers the moment, the group handles the dynamic.

## v1 Requirements

### Health Check

- [x] **HLT-01**: Load balancer can `GET /api/health` and receive HTTP 200 with body `{"status":"ok","uptime":<seconds>}`
- [x] **HLT-02**: `uptime` is a non-negative integer representing seconds elapsed since the Next.js server process started

## v2 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign in with Google via OAuth (optional — game is fully playable without an account)
- [ ] **AUTH-02**: Auth session persists across browser refresh and page navigation
- [ ] **AUTH-03**: Signed-in user can sign out from any page
- [ ] **AUTH-04**: Full anonymous game flow (create room, join, all round types, end screen, replay) works without regression after every phase that touches RLS or auth configuration

### Player Identity

- [ ] **IDEN-01**: `players` table has a nullable `user_id` FK — anonymous players have null, signed-in players reference their account
- [ ] **IDEN-02**: A signed-in user joining a room on a new device (no localStorage entry) is recognized via `user_id` lookup and reuses their account identity without creating a duplicate row

### Stats Persistence

- [ ] **STAT-01**: At game end, each signed-in player's stats for that session are written to their account (designation count, confession reveals, volunteer count, group title earned)
- [ ] **STAT-02**: Each session is stored as a separate history row (per-session records, not only cumulative counters)
- [ ] **STAT-03**: Stats writes are idempotent — a `UNIQUE(user_id, session_id)` constraint prevents duplicate entries on replay

### Stats Profile

- [ ] **PROF-01**: Signed-in user can view their stats history on a `/profile` page (designation count, confession reveals, volunteer count, sessions played, group titles earned)
- [ ] **PROF-02**: Anonymous users see a "sign in to save your stats" CTA on the end screen, shown after session stats are displayed

## Future Requirements

### Monetisation

- **MON-01**: Host has an account tier (free vs premium)
- **MON-02**: Free tier is capped at 2 sessions per free theme with a 12-hour cooldown
- **MON-03**: Premium purchase removes all caps and unlocks premium themes
- **MON-04**: A premium player present in a room grants the room premium access for that session

### Premium Features

- **PREM-01**: Premium themes (No Filter, Unmasked) gated behind account purchase
- **PREM-02**: Custom Theme mode — players create their own questions before the game
- **PREM-03**: Configurable round count (5 / 7 / 15 / custom)

## Out of Scope

| Feature | Reason |
|---------|--------|
| `/health` root-level path | Next.js routes live under `/api/`; rewrite available if needed |
| Detailed health sub-checks | Not required for MVP load-balancer probe |
| Stripe / payment | v3.0 monetisation milestone — auth must be stable first |
| Premium feature gating / quota | v3.0 — build the auth foundation cleanly before layering gating |
| Avatar display in lobby player list | Real-time sync complexity; deferred to avoid lobby regressions |
| Google avatar on `/profile` | Nice to have; `avatar_url` sync deferred |
| Magic link / email+password auth | Google OAuth only for v2.0; lower friction, one well-tested path |
| In-app chat | Deliberately excluded — WhatsApp does it better |
| Automatic sanctions / dare pack | Post-v1 optional mode |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| HLT-01 | Phase 1: Health Endpoint | ✓ Complete |
| HLT-02 | Phase 1: Health Endpoint | ✓ Complete |
| AUTH-01 | Phase 3: Sign-in UX + Player Linking | Pending |
| AUTH-02 | Phase 2: Auth Infrastructure + Schema | Pending |
| AUTH-03 | Phase 3: Sign-in UX + Player Linking | Pending |
| AUTH-04 | Phase 2: Auth Infrastructure + Schema | Pending |
| IDEN-01 | Phase 2: Auth Infrastructure + Schema | Pending |
| IDEN-02 | Phase 3: Sign-in UX + Player Linking | Pending |
| STAT-01 | Phase 4: Stats Persistence + Profile | Pending |
| STAT-02 | Phase 4: Stats Persistence + Profile | Pending |
| STAT-03 | Phase 4: Stats Persistence + Profile | Pending |
| PROF-01 | Phase 4: Stats Persistence + Profile | Pending |
| PROF-02 | Phase 4: Stats Persistence + Profile | Pending |

**Coverage:**
- v1 requirements: 2/2 complete ✓
- v2 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 after v2.0 roadmap created*
