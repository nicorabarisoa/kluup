# Synthesis Summary

Ingest run: 2026-06-10
Mode: merge
CLASSIFICATIONS_DIR: .planning/intel/classifications/
INTEL_DIR: .planning/intel/

---

## Doc Counts by Type

Total documents synthesized: 4
- SPEC: 4
- ADR: 0
- PRD: 0
- DOC: 0

All 4 documents had confidence: high. No UNKNOWN-confidence-low documents.

---

## Decisions

Locked decisions from this ingest: 0
(No ADRs in ingest set; all SPEC decisions are proposed, not locked.)

Proposed decisions extracted: 14
- DEC-CQ-01 through DEC-CQ-04 (Contextual Questions — 4 decisions)
- DEC-DA-01 through DEC-DA-03 (Duo Awards — 3 decisions)
- DEC-PC-01 through DEC-PC-04 (Power Cards — 4 decisions)
- DEC-AR-01 through DEC-AR-04 (Social Profile & Archetypes — 4 decisions, including 1 deferred to Phase 5)

Detail: .planning/intel/decisions.md

---

## Requirements

Requirements extracted: 26
- REQ-CQ-01 through REQ-CQ-06 — Contextual Questions (6)
- REQ-DA-01 through REQ-DA-05 — Duo Awards (5)
- REQ-PC-01 through REQ-PC-08 — Power Cards (8)
- REQ-AR-01 through REQ-AR-07 — Social Profile & Archetypes (7, including 1 deferred to Phase 5)

All requirements are future-milestone (v3.0+). None overlap with active v2.0 REQUIREMENTS.md entries.

Detail: .planning/intel/requirements.md

---

## Constraints

Constraints extracted: 12
- CONSTRAINT-CQ-01 through CONSTRAINT-CQ-02 (protocol) — Contextual Questions
- CONSTRAINT-DA-01 through CONSTRAINT-DA-03 (api-contract, api-contract, protocol) — Duo Awards
- CONSTRAINT-PC-01 through CONSTRAINT-PC-03 (protocol, api-contract, api-contract) — Power Cards
- CONSTRAINT-AR-01 through CONSTRAINT-AR-04 (api-contract, protocol, nfr, schema) — Archetypes

Type breakdown:
- api-contract: 5
- protocol: 5
- nfr: 1
- schema: 1

Detail: .planning/intel/constraints.md

---

## Context Topics

Topics written: 7
1. Superpowers Feature Set — Overview
2. Feature Dependencies Within the Superpowers Set
3. Schema Changes Required Across All Four Features
4. GameState Extensions Required
5. GamePhase Extensions Required
6. i18n Key Volume (~42 new keys × 4 locales)
7. Phase 5 Integration Points (tag_scores alignment with ROADMAP.md)

Detail: .planning/intel/context.md

---

## Conflicts

Total: 0 blockers, 1 competing-variant warning, 3 auto-resolved info entries

- BLOCKERS: 0 — no locked decision contradictions, no cycles, no unknown-confidence documents
- WARNINGS: 1 — duo awards 2-face card has hard dependency on archetypes feature; cannot be planned independently without resolving Face 2 content
- INFO: 3 — modern-screenshot reaffirmed; tag_scores Phase 5 alignment confirmed; scope boundary clean

Detail: .planning/INGEST-CONFLICTS.md

---

## Cycle Detection

No cycles found in cross_refs graph.
- duo-awards spec references social-profile-archetypes spec (acknowledged as design dependency)
- social-profile-archetypes spec references lib/i18n.ts, lib/game.ts, supabase/schema.sql (implementation references, not spec cycles)
- contextual-questions spec: no cross_refs
- power-cards spec: no cross_refs

---

## Downstream Notes for gsd-roadmapper

When routing these requirements to a milestone plan:

1. Duo Awards (REQ-DA-*) and Archetypes (REQ-AR-*) must be in the same milestone phase or sequenced with Archetypes first. The WARNING in INGEST-CONFLICTS.md must be resolved before routing.

2. REQ-AR-07 and DEC-AR-03 are explicitly Phase 5 items — they should integrate into the existing ROADMAP.md Phase 5, not create a new phase.

3. The superpowers feature set belongs in a future milestone. Do not insert these requirements into v2.0 phases 02-05.

4. Recommended v3.0 milestone sequencing (see context.md for rationale):
   Phase 1: Social Profile & Archetypes
   Phase 2: Duo Awards (depends on archetypes)
   Phase 3: Contextual Questions (independent)
   Phase 4: Power Cards (independent)

5. Three DB migrations will be needed at v3.0 start:
   - ALTER TABLE questions ADD COLUMN tags jsonb DEFAULT '[]'::jsonb
   - CREATE TABLE contextual_questions (...)
   - (Phase 5, deferred) ALTER TABLE user_session_stats ADD COLUMN tag_scores jsonb

---

*Synthesis complete: 2026-06-10*
