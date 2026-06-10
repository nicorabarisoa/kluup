# Conflict Detection Report

Ingest run: 2026-06-10
Mode: merge
Sources: 4 SPEC documents (docs/superpowers/specs/)
Existing context checked: ROADMAP.md, PROJECT.md, REQUIREMENTS.md, STATE.md

---

### BLOCKERS (0)

No blockers detected.

No LOCKED-vs-LOCKED ADR contradictions exist in this ingest set. No ADR documents were present.
No ingest decisions contradict any locked decision in the existing PROJECT.md decisions table.
No UNKNOWN-confidence-low documents detected — all 4 classifications have confidence: high.
No reference cycles detected in the cross_refs graph.

---

### WARNINGS (1)

[WARNING] Feature dependency: duo awards 2-face card requires archetype data — cannot ship independently
  Found: docs/superpowers/specs/2026-06-10-duo-awards-design.md section 8 states "Dépendance avec feature archétypes : les 2 features partagent la Face 2 de la carte — à implémenter ensemble ou en séquence"
  Found: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md section 6 defines the archetype content that populates Face 2
  Impact: If duo awards (REQ-DA-04) is planned without archetypes (REQ-AR-*), Face 2 of the share card will be incomplete or require a placeholder. The share card refactor cannot be finalized until both features are scoped together.
  → RESOLVED 2026-06-10: user confirmed Duo Awards and Archetypes ship together in the same phase (v3.0 Phase A). See ROADMAP.md Future Milestone v3.0 Phase A.

---

### INFO (3)

[INFO] Auto-resolved: SPEC reaffirms existing locked decision — modern-screenshot
  Note: docs/superpowers/specs/2026-06-10-duo-awards-design.md section 5 explicitly states `modern-screenshot` for the 2-face share card capture. PROJECT.md already has this as a locked decision ("Locked: modern-screenshot not html2canvas — html2canvas distorted custom fonts on share card"). No conflict — SPEC is consistent with existing locked decision. CONSTRAINT-DA-02 recorded for traceability.
  source: PROJECT.md (locked), docs/superpowers/specs/2026-06-10-duo-awards-design.md

[INFO] Auto-resolved: SPEC cross-session archetype aligns with existing ROADMAP.md Phase 5 criterion
  Note: docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md section 2.3 specifies `tag_scores jsonb` on `user_session_stats` for Phase 5. ROADMAP.md Phase 5 success criterion 6 already states "user_session_stats includes a tag_scores jsonb field (per-trait scores for that session)." The SPEC provides the exact schema and write logic for this field. No contradiction — SPEC adds detail to an existing placeholder criterion.
  source: ROADMAP.md Phase 5 criterion 6, docs/superpowers/specs/2026-06-10-social-profile-archetypes-design.md

[INFO] Scope boundary confirmed: all 4 specs are future-milestone only, no overlap with active v2.0 phases
  Note: The v2.0 ROADMAP.md covers Phases 1–5 (health, auth, playtest, sign-in, stats). None of the 4 ingested specs introduce requirements that conflict with or overlap these phases. The only integration point is ROADMAP.md Phase 5 criterion 6 (tag_scores), which is additive and consistent. The superpowers feature set is cleanly scoped to a future v3.0+ milestone.
  source: ROADMAP.md (all phases), all 4 SPEC documents
