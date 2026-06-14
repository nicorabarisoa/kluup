---
phase: A-social-profile-archetypes-duo-awards
plan: 04
type: execute
wave: 2
depends_on:
  - "A-social-profile-archetypes-duo-awards-02"
  - "A-social-profile-archetypes-duo-awards-03"
files_modified:
  - components/ArchetypeBlock.tsx
  - components/DuoAwardsBlock.tsx
autonomous: true
requirements: [REQ-AR-05, REQ-DA-03]
must_haves:
  truths:
    - "ArchetypeBlock renders the archetype name (uppercase, display font) + top-3 trait bars with explicit pixel widths"
    - "DuoAwardsBlock renders a section label + one row per award (emoji + award name + 'PlayerA & PlayerB')"
    - "Both components are capture-safe: inline styles only, no Tailwind classes, no % widths inside the card"
    - "next build succeeds (components type-check against ArchetypeResult / DuoAward from Plans 02-03)"
  artifacts:
    - path: "components/ArchetypeBlock.tsx"
      provides: "Capture-safe archetype block (name + top-3 trait bars)"
      contains: "barWidthPx"
      min_lines: 40
    - path: "components/DuoAwardsBlock.tsx"
      provides: "Capture-safe duo-awards block (emoji + name + pair rows)"
      contains: "award"
      min_lines: 30
  key_links:
    - from: "components/ArchetypeBlock.tsx"
      to: "lib/archetypes.ts TRAIT_COLORS"
      via: "import for trait label + bar fill colors"
      pattern: "TRAIT_COLORS"
    - from: "components/ArchetypeBlock.tsx"
      to: "lib/locale.tsx useT"
      via: "fr.archetypes.card_title / fr.archetypes[archetypeKey] / fr.archetypes[trait_*]"
      pattern: "useT"
    - from: "components/DuoAwardsBlock.tsx"
      to: "lib/locale.tsx useT"
      via: "fr.duo_awards.title / fr.duo_awards[awardKey]"
      pattern: "useT"
---

<objective>
Build the two capture-safe presentation components that render inside the share card:
`ArchetypeBlock` (Face 2) and `DuoAwardsBlock` (Face 1). Both are pure presentation — they receive
pre-computed data from Plans 02/03 and render with inline-px styles only (modern-screenshot discipline).

Purpose: REQ-AR-05 (archetype + top-3 traits on the personal face) and REQ-DA-03's render shape (the duo
block). These components encapsulate the P-07 capture rules (explicit pixel bar widths, no % widths, no
Tailwind classes inside the capture container) so the Plan 05 ShareCard refactor just drops them in.
Output: `components/ArchetypeBlock.tsx`, `components/DuoAwardsBlock.tsx`.
</objective>

<artifacts_produced>
## Artifacts this phase produces (Plan 04 contributions)

- New component file: `components/ArchetypeBlock.tsx` (default or named export `ArchetypeBlock`)
- New component file: `components/DuoAwardsBlock.tsx` (default or named export `DuoAwardsBlock`)
- New prop interfaces: `ArchetypeBlockProps`, `DuoAwardsBlockProps`
- Local `C`-token constants copied into each component (the `C` object in game/page.tsx is module-private)
</artifacts_produced>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/A-social-profile-archetypes-duo-awards/A-UI-SPEC.md
@.planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md
@.planning/phases/A-social-profile-archetypes-duo-awards/A-RESEARCH.md
@CLAUDE.md
@lib/locale.tsx
@lib/i18n.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: ArchetypeBlock.tsx (name + top-3 trait bars, explicit px)</name>
  <read_first>
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-UI-SPEC.md (§ Face 2 → Archetype block layout; § Trait Palette — Final Hex Values; § Typography; Edge cases for fallback + < 3 traits)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md (components/ArchetypeBlock.tsx → capture-safe inline-style pattern, trait bar explicit px, useT convention, props shape; § Shared Patterns → Design Tokens C object, Inline-Style-Only)
    - app/room/[code]/game/page.tsx (lines 1233-1296 — the existing "Moment fort" + personal stats blocks this is modeled on; the module-private C object ~L28)
    - lib/archetypes.ts (TRAIT_COLORS, ArchetypeResult / TraitEntry exports from Plan 02)
    - lib/locale.tsx (useT hook)
  </read_first>
  <action>
    Create `components/ArchetypeBlock.tsx`. Props: `{ archetypeKey: string; topTraits: Array<{ key: string;
    pct: number }>; themeColor: string }`. Use `const fr = useT()` (project convention — always named `fr`).
    Import `TRAIT_COLORS` from `lib/archetypes.ts`. Because the `C` design-token object in game/page.tsx is
    module-private and NOT exported, copy the needed token hex values as local constants in this file:
    bg-surface `#1A1A1A`, border `#252525`, text `#FFFFFF`, muted `#888888`. Layout per A-UI-SPEC.md § Face 2
    Archetype block: container `background #1A1A1A`, `borderRadius 18`, `padding '16px 16px'`,
    `borderLeft '4px solid ${themeColor}'`; section label `fr.archetypes.card_title` at 13px muted uppercase
    letterSpacing 0.06em; archetype name `fr.archetypes[archetypeKey]` at 28px, `fontFamily 'var(--font-display)'`,
    `fontWeight 800`, `textTransform 'uppercase'`, `C.text`; 1px `#252525` divider; then up to 3 trait rows.
    Each trait row: label at 13px colored `TRAIT_COLORS[key]` width 88px flexShrink 0; bar track height 8px
    flex 1 background `#252525` borderRadius 4; bar fill height 8px background `TRAIT_COLORS[key]` borderRadius 4
    with `width: Math.round(pct / 100 * 160)` (EXPLICIT INTEGER PIXELS — NEVER `${pct}%`, P-07); percent at 13px
    muted width 36px textAlign right. Edge cases (D-03): when `archetypeKey === 'archetype_fallback'` render the
    fallback name and OMIT all trait rows; render only the traits with `pct > 0` (1–3, never a 0-pct bar). Use
    ONLY inline `style={}` — no Tailwind classes anywhere in this component (it renders inside the capture div).
    No fenced code in this action — copy concrete values from A-UI-SPEC.md.
  </action>
  <verify>
    <automated>npx next build</automated>
  </verify>
  <acceptance_criteria>
    - components/ArchetypeBlock.tsx exists and imports `TRAIT_COLORS` from the archetypes module
    - The bar fill width is `Math.round(pct / 100 * 160)` (grep `barWidthPx` or `/ 100 * 160` present; grep `${pct}%` or `pct + '%'` ABSENT — P-07 gate)
    - Component contains no `className=` attribute (inline-style-only; grep `className` returns no match in this file)
    - Archetype name uses `var(--font-display)`, `fontWeight: 800`, and `textTransform: 'uppercase'`
    - `npx next build` succeeds (types resolve against ArchetypeResult/TraitEntry from Plan 02)
  </acceptance_criteria>
  <done>ArchetypeBlock renders name + top-3 explicit-px trait bars, fallback-safe, capture-safe.</done>
</task>

<task type="auto">
  <name>Task 2: DuoAwardsBlock.tsx (emoji + name + pair rows)</name>
  <read_first>
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-UI-SPEC.md (§ Face 1 → Duo awards block layout; § Copywriting Contract → duo_awards keys; Empty states)
    - .planning/phases/A-social-profile-archetypes-duo-awards/A-PATTERNS.md (components/DuoAwardsBlock.tsx → same container style, emoji + text row pattern, props shape)
    - app/room/[code]/game/page.tsx (lines 1246-1270 — the existing personal-stats pill block this is modeled on)
    - lib/awards.ts (DuoAward export from Plan 03)
    - lib/locale.tsx (useT) and lib/i18n.ts (duo_awards.title + award_* keys)
  </read_first>
  <action>
    Create `components/DuoAwardsBlock.tsx`. Props: `{ awards: DuoAward[]; themeColor: string }` (importing
    `DuoAward` from `lib/awards.ts`). The caller (Plan 05) guarantees `awards.length >= 2` before rendering, but
    the component itself should still map over whatever it receives. Use `const fr = useT()`. Copy the same local
    `C` token constants as ArchetypeBlock (surface `#1A1A1A`, border `#252525`, text `#FFFFFF`, muted `#888888`).
    Container matches the ArchetypeBlock style (background `#1A1A1A`, borderRadius 18, padding '16px 16px',
    borderLeft `4px solid ${themeColor}`). Section label `fr.duo_awards.title` at 13px muted uppercase
    letterSpacing 0.06em marginBottom 8px. One row per award (`gap: 8px` between rows, `display: flex`,
    `alignItems: 'flex-start'`): emoji cell `width: 32, flexShrink: 0, fontSize: 18` showing `award.emoji`; right
    column with award name `fr.duo_awards[award.awardKey]` at 16px `C.text fontWeight 400` and player names at
    13px muted formatted `{award.playerA.pseudo} & {award.playerB.pseudo}` (after a `·` separator per A-UI-SPEC.md).
    Inline `style={}` only — NO Tailwind classes, NO `%` widths (all flex + fixed px). No fenced code in the action.
  </action>
  <verify>
    <automated>npx next build</automated>
  </verify>
  <acceptance_criteria>
    - components/DuoAwardsBlock.tsx exists and imports `DuoAward` from the awards module
    - Section label resolves via `fr.duo_awards.title`; award names via `fr.duo_awards[award.awardKey]`
    - Component contains no `className=` attribute (grep `className` returns no match in this file)
    - Component contains no `%` width strings inside the rendered rows (grep `%'` / `%"` absent for width)
    - `npx next build` succeeds (types resolve against DuoAward from Plan 03)
  </acceptance_criteria>
  <done>DuoAwardsBlock renders the section label + one capture-safe row per award (emoji + name + pair).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| rendered card content | These components render player pseudos + award/archetype labels into a PNG that gets shared |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-A-09 | Information disclosure | DuoAwardsBlock renders pair names (derived from confession_overlap etc.) | accept | Awards surface only WINNER pairs + award names — never raw confession answers or who-voted-what. The privacy-sensitive computation stays in lib/awards.ts (Plan 03); this component receives only the final DuoAward[] (pseudos + award key + score), no `answer` data. No new exposure. |
| T-A-10 | Tampering | trait bar width rendering (P-07) | mitigate | Explicit integer pixel widths (`Math.round(pct/100*160)`), never `%` — enforced by acceptance-criteria grep. Prevents 0-width bars in the off-screen capture. |
| T-A-11 | Spoofing | i18n key injection | accept | Archetype/award keys come from typed pure modules (fixed key set), not user input — no dynamic-key injection risk. |
</threat_model>

<verification>
- `npx next build` succeeds (both components type-check against Plan 02/03 exports + the new i18n keys)
- Grep confirms explicit px bar widths (no `%` widths) in ArchetypeBlock (P-07 gate)
- Grep confirms no `className=` in either component (inline-style-only capture discipline)
</verification>

<success_criteria>
- ArchetypeBlock: name (uppercase display 800) + top-3 explicit-px trait bars; fallback omits bars
- DuoAwardsBlock: section label + emoji/name/pair rows; flex + fixed px only
- Both capture-safe (inline styles, no Tailwind, no % widths); both use useT() for all strings
- `next build` passes
</success_criteria>

<output>
Create `.planning/phases/A-social-profile-archetypes-duo-awards/A-04-SUMMARY.md` when done
</output>
