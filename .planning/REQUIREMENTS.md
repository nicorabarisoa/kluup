# Requirements: Kluup

**Defined:** 2026-06-07
**Core Value:** Creating genuine human moments through structured social questions — the app triggers the moment, the group handles the dynamic.

## v1 Requirements

### Health Check

- [x] **HLT-01**: Load balancer can `GET /api/health` and receive HTTP 200 with body `{"status":"ok","uptime":<seconds>}`
- [x] **HLT-02**: `uptime` is a non-negative integer representing seconds elapsed since the Next.js server process started

## v2 Requirements

### Authentication

- [x] **AUTH-01**: User can sign in with Google via OAuth (optional — game is fully playable without an account)
- [ ] **AUTH-02**: Auth session persists across browser refresh and page navigation
- [x] **AUTH-03**: Signed-in user can sign out from any page
- [ ] **AUTH-04**: Full anonymous game flow (create room, join, all round types, end screen, replay) works without regression after every phase that touches RLS or auth configuration

### Player Identity

- [ ] **IDEN-01**: `players` table has a nullable `user_id` FK — anonymous players have null, signed-in players reference their account
- [x] **IDEN-02**: A signed-in user joining a room on a new device (no localStorage entry) is recognized via `user_id` lookup and reuses their account identity without creating a duplicate row

### Stats Persistence

- [ ] **STAT-01**: At game end, each signed-in player's stats for that session are written to their account (designation count, confession reveals, volunteer count, group title earned)
- [ ] **STAT-02**: Each session is stored as a separate history row (per-session records, not only cumulative counters)
- [ ] **STAT-03**: Stats writes are idempotent — a `UNIQUE(user_id, session_id)` constraint prevents duplicate entries on replay

### Stats Profile

- [ ] **PROF-01**: Signed-in user can view their stats history on a `/profile` page (designation count, confession reveals, volunteer count, sessions played, group titles earned)
- [ ] **PROF-02**: Anonymous users see a "sign in to save your stats" CTA on the end screen, shown after session stats are displayed

## v3.0 Requirements (Superpowers / Future Milestone)

> These requirements map to a future v3.0 milestone. They do NOT affect active v2.0 phases.

### Social Profile & Archetypes

- [ ] **REQ-AR-01**: `questions` table has a `tags jsonb DEFAULT '[]'::jsonb` column (migration: ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb)
- [ ] **REQ-AR-02**: All existing questions are curated with appropriate tags before feature launch (0–3 tag objects per question: `{"tag": string, "points": number}`)
- [ ] **REQ-AR-03**: In the ended phase, the client calculates the player's trait scores from their own votes and played question tags (single query, actor-rule per type A/B/C)
- [ ] **REQ-AR-04**: Archetype determined from trait scores using simple (single trait > 50%) and hybrid (top 2 both > 25%, within 15%) threshold rules — 21 named + 1 fallback
- [ ] **REQ-AR-05**: Archetype and top 3 traits displayed on the personal face of the share card (Bricolage Grotesque, progress bars, hidden if total = 0)
- [ ] **REQ-AR-06**: i18n keys for all 22 archetype names and 6 trait names added to all four locale dictionaries (fr/en/es/de)
- [ ] **REQ-AR-07** *(Phase 5 hook)*: `user_session_stats` gains a `tag_scores jsonb` column for cross-session archetype accumulation on `/profile`

### Duo Awards

- [ ] **REQ-DA-01**: At end of session, client computes 5 metrics per unique player pair from a single votes query (mutual_designations, vote_alignment, opposition, confession_overlap, co_volunteers)
- [ ] **REQ-DA-02**: Four named duo awards assigned from metrics: Magnétisme Suspicieux, Même longueur d'onde, Les Ennemis Jurés, Les Complices — minimum score threshold 2, variety rule on ties
- [ ] **REQ-DA-03**: Duo awards slide omitted from end screen if fewer than 2 awards qualify
- [ ] **REQ-DA-04**: Share card becomes 2-faced with tap-to-toggle — Face 1: group title + duo awards; Face 2: personal stats + archetype data (depends on REQ-AR-*); `modern-screenshot` exports current face
- [ ] **REQ-DA-05**: i18n keys for all 4 award names and section title added to all four locale dictionaries

### Contextual Questions

- [ ] **REQ-CQ-01**: `contextual_questions` DB table exists with columns (id uuid, parent_question_id uuid FK → questions ON DELETE CASCADE, template jsonb `{fr,en,es,de}`)
- [ ] **REQ-CQ-02**: GameState includes `last_contextual_round: number | null` and `contextual_question: {template: string, target_player_id: string} | null`
- [ ] **REQ-CQ-03**: Game engine triggers a contextual question between rounds with probability `round === 1 ? 0 : (round - 1) * 0.10` — at most one per round, silent skip if no matching sub-questions
- [ ] **REQ-CQ-04**: Target player identified from most recent round result (A→designated_player_ids[0], B→roulette winner, C vol→volunteer_player_ids[0], C roulette→designated_player_id); silent skip if player left
- [ ] **REQ-CQ-05**: New `contextual_question` GamePhase between reveal and next voting_question — all players see resolved template + target pseudo; host-only "Continue" button
- [ ] **REQ-CQ-06**: i18n keys `contextual_header` and `contextual_continue` added to all four locale dictionaries

### Power Cards (Target & Reveal)

- [ ] **REQ-PC-01**: GameState includes `power_cards: {target: string|null, reveal: string|null}` and `used_cards: {target: string[], reveal: string[]}` (initialized in makeInitialGameState)
- [ ] **REQ-PC-02**: End of each round: weighted attribution roll assigns power cards to eligible volunteers (weight = volunteering count, elected host executes, broadcast phase_changed)
- [ ] **REQ-PC-03**: Cards visible/usable only during `round_b2_roulette`, in a 5-second window after reveal — host "Next round" blocked during window; only card holders see "Use my card"
- [ ] **REQ-PC-04**: Target card: holder selects a player; their confession answer (yes/no) revealed publicly; card consumed
- [ ] **REQ-PC-05**: Reveal card: second revelation from unrevealed "oui" pool; animated roulette; `revealed_player_ids` updated; card consumed
- [ ] **REQ-PC-06**: Two new GamePhases: `card_target_result` and `card_reveal_roulette`
- [ ] **REQ-PC-07**: Cards auto-disabled on: sheep screen, no unrevealed voters remaining, card holder leaves room, game ends
- [ ] **REQ-PC-08**: i18n keys for all power card UI strings added to all four locale dictionaries (card_target_name, card_reveal_name, card_use_button, card_target_announce, card_target_yes, card_target_no, card_reveal_announce)

---

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
| AUTH-01 | Phase 3: Sign-in UX + Player Linking | Complete |
| AUTH-02 | Phase 2: Auth Infrastructure + Schema | Pending |
| AUTH-03 | Phase 3: Sign-in UX + Player Linking | Complete |
| AUTH-04 | Phase 2: Auth Infrastructure + Schema | Pending |
| IDEN-01 | Phase 2: Auth Infrastructure + Schema | Pending |
| IDEN-02 | Phase 3: Sign-in UX + Player Linking | Complete |
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
