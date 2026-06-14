# Phase 6: Social Profile & Archetypes + Duo Awards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 06-social-profile-archetypes-duo-awards
**Areas discussed:** Card flip & default face, Share/export scope, Trait bar visuals, Tag coverage & fallback, Scope (session vs cross-session)

---

## Card flip & default face

| Option | Description | Selected |
|--------|-------------|----------|
| Perso first, tap to flip | Face 2 (archetype + personal stats) first; tap flips to group; Share below card | |
| Group first, tap to flip | Face 1 (group title + duo awards) first; tap flips to personal archetype; Share below card | ✓ |
| Swipe to flip | Horizontal swipe instead of tap; risks browser back-swipe conflict | |

**User's choice:** Group first, tap to flip.
**Notes:** Group reveal is the main event; personal archetype is the flip payoff. Share button kept below the card (off the flip surface). Subtle "tap to see your archetype" affordance left to Claude. Edge case spec-locked: <2 duo awards → Face 1 = group title only.

---

## Share/export scope

| Option | Description | Selected |
|--------|-------------|----------|
| Visible face only | modern-screenshot captures the active face; one image; lowest iOS risk; matches spec | ✓ |
| Both faces, 2 images | Capture group + personal separately; multi-file Web Share unreliable on iOS | |
| Single stacked image | One tall image, both faces stacked; changes aspect ratio | |

**User's choice:** Visible face only.
**Notes:** Player flips to the desired face, then Share. Avoids known iOS Safari multi-face capture quirks.

---

## Trait bar visuals

| Option | Description | Selected |
|--------|-------------|----------|
| 6 distinct hues per trait | One color per trait, harmonized on dark card; personality-result aesthetic | ✓ |
| Brand green, opacity steps | All bars electric green; differentiate by length + brightness | |
| Two-tone (green + neutral) | Dominant trait green, others neutral gray | |

**User's choice:** 6 distinct hues per trait.
**Notes:** Exact hex palette finalized at implementation. Archetype name styling spec-locked (uppercase, Bricolage Grotesque). Top 3 traits shown with % + bars; render only when total points > 0.

---

## Tag coverage & fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + backfill gaps | Count empty-tag questions across themes × types; backfill gaps so actors accumulate points | ✓ |
| Accept as-is, fallback valid | Ship against current tags; treat "Une simple personne" as charming | |
| Spot-check threshold | Backfill only if >15% untagged | |

**User's choice:** Audit + backfill gaps.
**Notes:** "Une simple personne" stays a valid result for balanced/quiet profiles, not a curation gap.

---

## Scope (session vs cross-session)

| Option | Description | Selected |
|--------|-------------|----------|
| Session-only, ready for context | Lock to share-card experience; defer tag_scores persistence + /profile to later phase | ✓ (recommended) |
| Pull cross-session in | Also write tag_scores + /profile cumulative archetype now | |
| Explore one more area | — | |

**User's choice:** Free text — "what do you recommend?" → Claude recommended **session-only**, with `tag_scores` background write as an *optional* planner fold-in (D-08) only if it lands cleanly on the existing stats-save path. User proceeded on that basis.
**Notes:** Rationale: keeps the client-only computation clean, isolates the tag_scores upsert landmines with the consuming sliders phase, enables real-group playtest before investing in persistence; early background write avoids launching sliders against empty history.

## Claude's Discretion

- Exact trait hex palette + bar styling; flip affordance microcopy/animation; precise 2-face layout.
- Deterministic pair sort by `player.id`; Type B points from `myId`'s own votes only; `never` exhaustiveness guard on touched `GamePhase` switches.

## Deferred Ideas

- Cross-session `/profile` cumulative archetype + bipolar trait sliders → final v3.0 Bipolar Sliders phase (D-08 may seed the `tag_scores` write early; UI deferred).
- Contextual questions → Phase B; Power cards → Phase C.
- Multi-image / stacked export, swipe-to-flip → rejected for iOS reliability + back-swipe conflict.
