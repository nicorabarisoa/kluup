# Roadmap — Kluup

## Milestones

- ✅ **v2.0 Auth & Stats** — Phases 1–5 (shipped 2026-06-12)
- 📋 **v3.0 Superpowers** — Phases 6–8 (planned)

## Phases

<details>
<summary>✅ v2.0 Auth & Stats (Phases 1–5) — SHIPPED 2026-06-12</summary>

- [x] Phase 1: Health Endpoint — `GET /api/health` (1/1 plan)
- [x] Phase 2: Auth Infrastructure + Schema — auth plumbing + DB schema (3/3 plans, completed 2026-06-10)
- [x] Phase 3: Playtest Quality Fixes — 8 game bugs fixed (8/8 plans, completed 2026-06-10)
- [x] Phase 4: Sign-in UX + Player Linking — Google OAuth optional sign-in (4/4 plans, completed 2026-06-11)
- [x] Phase 5: Stats Persistence + Profile — cross-session stats + /profile page (6/6 plans, completed 2026-06-12)

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

## Future Milestone: v3.0 Superpowers

> Not part of v2.0. Sequencing validated 2026-06-10 via spec ingest.

### Phase 6: Social Profile & Archetypes + Duo Awards

**Goal:** Assign social archetypes from in-game behaviour tags; compute duo awards for notable pairs — both on a 2-faced share card.
**Requirements:** REQ-AR-01–06, REQ-DA-01–05
**Plans:** 5/5 plans complete

Plans:

- [x] 06-01-PLAN.md — Wave 0: Vitest install + config, red test scaffolds, Question.tags type, 2 flip i18n keys
- [x] 06-02-PLAN.md — Wave 1: lib/archetypes.ts (computeTraitScores + computeArchetype, TDD, P-04 boundary)
- [x] 06-03-PLAN.md — Wave 1: lib/awards.ts (computeDuoAwards + 5 metrics, TDD, P-19 determinism)
- [x] 06-04-PLAN.md — Wave 2: ArchetypeBlock.tsx + DuoAwardsBlock.tsx (capture-safe presentation)
- [x] 06-05-PLAN.md — Wave 3: ShareCard/EndScreen 2-face refactor + computation hub + end-to-end verify

### Phase 7: Contextual Questions

**Goal:** Insert adaptive follow-up questions between rounds, triggered by in-game events with increasing probability.
**Requirements:** REQ-CQ-01–06

### Phase 8: Power Cards (Target & Reveal)

**Goal:** Assign secret power cards to volunteers; usable during Type B roulette reveal for dramatic extra revelations.
**Requirements:** REQ-PC-01–08

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Health Endpoint | v2.0 | 1/1 | ✓ Complete | 2026-06-07 |
| 2. Auth Infrastructure | v2.0 | 3/3 | ✓ Complete | 2026-06-10 |
| 3. Playtest Quality Fixes | v2.0 | 8/8 | ✓ Complete | 2026-06-10 |
| 4. Sign-in UX | v2.0 | 4/4 | ✓ Complete | 2026-06-11 |
| 5. Stats Persistence | v2.0 | 6/6 | ✓ Complete | 2026-06-12 |
| 6. Archetypes + Duo Awards | v3.0 | 5/5 | Complete   | 2026-06-14 |
| 7. Contextual Questions | v3.0 | 0/? | Not started | — |
| 8. Power Cards | v3.0 | 0/? | Not started | — |
