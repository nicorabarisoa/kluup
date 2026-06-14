# Phase A: Social Profile & Archetypes + Duo Awards — Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 8 (2 new pure modules, 2 new components, 3 modified files, 1 SQL migration verify)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/archetypes.ts` | utility / pure engine | transform | `lib/game.ts` (`tallyDesignation`, `computeGroupTitle`, `accumulateStats`) | exact |
| `lib/awards.ts` | utility / pure engine | transform | `lib/game.ts` (`tallyDesignation`, `accumulateStats`) | exact |
| `lib/types.ts` (modify) | model | — | `lib/types.ts` itself (existing `Question` type) | exact |
| `lib/i18n.ts` (modify) | config | — | `lib/i18n.ts` `card:` section (existing Dict type) | exact |
| `components/ArchetypeBlock.tsx` | component | request-response | `ShareCard` inline blocks (~L1233–L1269) | role-match |
| `components/DuoAwardsBlock.tsx` | component | request-response | `ShareCard` inline blocks (~L1233–L1269) | role-match |
| `app/room/[code]/game/page.tsx` — `ShareCard` refactor (~L1187) | component | request-response | `ShareCard` itself (forwardRef, 540×540, domToBlob) | exact |
| `app/room/[code]/game/page.tsx` — `EndScreen` refactor (~L1303) | component | CRUD / request-response | `EndScreen` itself (stats derivation, useEffect fetch, cardRef) | exact |

---

## Pattern Assignments

### `lib/archetypes.ts` (utility, transform)

**Analog:** `lib/game.ts`

**Import pattern** (game.ts lines 1–3):
```typescript
// No supabase import — pure module. Keep all Supabase calls in the caller (EndScreen).
import { GameState, Player } from './types'
// Export named constants + functions (never a class).
```

**Pure-function export style** (game.ts lines 48–79, 158–172, 231–249):
```typescript
// Functions are plain exports — no default export, no class.
export function computeTraitScores(...): Record<TraitKey, number> { ... }
export function computeArchetype(scores: Record<TraitKey, number>): ArchetypeResult { ... }
export const TRAIT_COLORS: Record<string, string> = { ... }
export const SIMPLE_ARCHETYPES: Record<string, string> = { ... }
export const HYBRID_ARCHETYPES: Record<string, string> = { ... }
```

**Fisher-Yates / pure determinism model** (game.ts lines 7–17):
```typescript
// If any shuffle needed: use Fisher-Yates, never Array.sort with random comparator.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

**Tally / reduce pattern** (game.ts lines 231–249, tallyDesignation):
```typescript
// Count occurrences into a plain Record, find max, collect winners.
const counts: Record<string, number> = {}
for (const v of votes) {
  if (v.target_player_id) {
    counts[v.target_player_id] = (counts[v.target_player_id] ?? 0) + 1
  }
}
const max = Math.max(...Object.values(counts))
const topIds = ids.filter((id) => counts[id] === max)
```

**Floor-at-zero pattern** (game.ts accumulateStats lines 109–156 — defensive defaults):
```typescript
// Always floor numeric accumulation at 0; use nullish coalesce for backward compat.
designated: { ...(gs.stats.designated ?? {}) },
const inc = (map: Record<string, number>, id: string | null | undefined) => {
  if (id) map[id] = (map[id] ?? 0) + 1
}
```

**Key archetype-specific rule:** For Type B actor determination, use **only**:
```typescript
myVotes.filter(v => v.vote_type === 'confession' && v.answer === true)
// NEVER: gs.stats.confessed, gs.revealed_player_ids — these break the anonymity contract.
```

**Round-to-question mapping** (per A-RESEARCH.md Pattern 4):
```typescript
// played_question_ids[round - 1] gives the question ID for a given vote.round (1-based).
// Cross-reference: playedQuestions.find(q => q.id === gs.played_question_ids[v.round - 1])
// Then q.type tells you whether a designation in that round is Type A or Type C roulette.
```

---

### `lib/awards.ts` (utility, transform)

**Analog:** `lib/game.ts`

**Import pattern** (no Supabase — caller passes pre-fetched votes):
```typescript
import { Player } from './types'
// All data arrives as plain arrays; no async, no Supabase inside this module.
```

**Deterministic pair sort** (critical — P-19):
```typescript
// Sort players by player.id (lexicographic) BEFORE building pairs.
// This makes every client derive the same Face 1 content.
const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id))
const pairs: [Player, Player][] = []
for (let i = 0; i < sorted.length; i++) {
  for (let j = i + 1; j < sorted.length; j++) {
    pairs.push([sorted[i], sorted[j]])
  }
}
```

**Variety-rule award loop** (mirrors tallyDesignation + weighted selection in game.ts):
```typescript
// Walk award defs in canonical order; track awarded pairs to apply variety rule.
const awardedPairKeys = new Set<string>()
for (const def of AWARD_DEFS) {
  const candidates = [...pairs]
    .map(([a, b]) => ({ a, b, key: `${a.id}:${b.id}`, score: def.score(...) }))
    .filter(c => c.score >= 2)   // threshold from spec
    .sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score
      // Variety: prefer pair not already holding an award.
      const xAwarded = awardedPairKeys.has(x.key) ? 1 : 0
      const yAwarded = awardedPairKeys.has(y.key) ? 1 : 0
      return xAwarded - yAwarded
    })
  if (candidates[0]) {
    awards.push({ ... })
    awardedPairKeys.add(candidates[0].key)
  }
}
```

**No random comparator** (game.ts comment, lines 7–9):
```typescript
// Array.sort with a random comparator is biased (V8 TimSort caches comparator
// results, so certain permutations are statistically impossible).
// Use Fisher-Yates for any shuffle; for stable sort use .localeCompare().
```

---

### `lib/types.ts` — `Question` type modification

**Analog:** `lib/types.ts` lines 9–15 (existing `Question` type)

**Current shape** (lines 9–15):
```typescript
export type Question = {
  id: string
  theme: string
  type: 'A' | 'B' | 'C'
  intensity: number
  question: { fr: string; en: string; es: string; de: string }
}
```

**Add `tags` field** (optional for backward compat — existing `pickCandidates` results and pre-migration rows have no tags):
```typescript
export type Question = {
  id: string
  theme: string
  type: 'A' | 'B' | 'C'
  intensity: number
  question: { fr: string; en: string; es: string; de: string }
  tags?: Array<{ tag: string; points: number }>  // optional — '[]' default in DB; absent before migration
}
```

**No other type additions needed for Phase A visible scope.** `ArchetypeResult`, `DuoAward`, `TraitKey` live in their own modules (`lib/archetypes.ts`, `lib/awards.ts`) — do not add to `lib/types.ts`.

---

### `lib/i18n.ts` — 2 new `card:` keys

**Analog:** `lib/i18n.ts` lines 159–175 (existing `card:` section of the `Dict` type)

**Pattern:** The `Dict` type enforces exhaustiveness across all 4 locale objects. Adding a key to the `card:` section causes a TypeScript build error in ES and DE if those keys are absent — this is the intended safety net.

**Existing `card:` block** (lines 159–175):
```typescript
card: {
  moment: "Le moment fort",
  generating: "Génération…",
  download: "Télécharger l'image",
  close: "Fermer",
  footer: "kluup.app",
  tonight: "ce soir",
  stat: { ... },
},
```

**Add at the end of `card:` in all 4 locale objects:**
```typescript
// FR
flip_to_personal: "↻ voir ton archétype",
flip_to_group: "↻ voir le groupe",

// EN
flip_to_personal: "↻ see your archetype",
flip_to_group: "↻ see the group",

// ES
flip_to_personal: "↻ ver tu arquetipo",
flip_to_group: "↻ ver el grupo",

// DE
flip_to_personal: "↻ Archetyp ansehen",
flip_to_group: "↻ Gruppe ansehen",
```

**Also add to the `Dict` type interface** (wherever `card:` is typed — same file). The TypeScript compiler will then enforce all 4 locale objects have these keys at build time (`next build`).

**All other i18n keys (`archetypes.*`, `duo_awards.*`) are ALREADY PRESENT** in all 4 locales (verified lines 188–244). Do not recreate them.

---

### `components/ArchetypeBlock.tsx` (component, request-response)

**Analog:** `ShareCard` "Moment fort" block and "Personal stats" block (game/page.tsx lines 1233–1269)

**Capture-safe inline-style pattern** (lines 1233–1244):
```typescript
// All layout is explicit inline px — no Tailwind classes inside the card capture.
<div style={{
  background: C.surface, borderRadius: 18, padding: '14px 18px',
  borderLeft: `4px solid ${meta.color}`, flexShrink: 0,
}}>
  <p style={{ color: C.muted, fontSize: 12, margin: 0,
               textTransform: 'uppercase', letterSpacing: '0.06em' }}>
    {fr.card.moment}
  </p>
  <p style={{ color: '#fff', fontSize: 16, fontWeight: 500,
               margin: '6px 0 0', lineHeight: 1.35 }}>
    {statText}
  </p>
</div>
```

**Trait bar — explicit pixel width (critical, P-07):**
```typescript
// NEVER: style={{ width: `${pct}%` }} — computes as 0 in off-screen context.
// ALWAYS: compute integer px value.
const MAX_BAR_PX = 160
const barWidthPx = Math.round((pct / 100) * MAX_BAR_PX)

<div style={{
  height: 8,
  width: barWidthPx,         // integer px, not a percentage string
  background: TRAIT_COLORS[trait.key],
  borderRadius: 4,
}} />
```

**`useT()` convention** (game/page.tsx line 1196):
```typescript
// Always: const fr = useT()  — the convention is intentionally 'fr' even in EN.
const fr = useT()
// Then: fr.archetypes.card_title, fr.archetypes[archetypeKey], fr.archetypes[`trait_${key}`]
```

**Component receives pre-computed data** (no Supabase inside component):
```typescript
// Props: traitScores (Record<TraitKey, number>) + archetypeKey (string)
// Component is pure presentation — computation lives in EndScreen.
interface ArchetypeBlockProps {
  archetypeKey: string
  topTraits: Array<{ key: string; pct: number }>
  themeColor: string   // for borderLeft accent — passed from THEME_META[theme].color
}
```

---

### `components/DuoAwardsBlock.tsx` (component, request-response)

**Analog:** `ShareCard` "Personal stats" block (game/page.tsx lines 1246–1270)

**Same container style as ArchetypeBlock** (lines 1248–1249):
```typescript
<div style={{
  background: C.surface, borderRadius: 18, padding: '14px 18px', flexShrink: 0,
  borderLeft: `4px solid ${meta.color}`,
}}>
```

**Emoji + text row pattern** (matches existing pill pattern — lines 1252–1268):
```typescript
// Award rows use display:flex with fixed emoji cell width (32px) so all
// award names align regardless of emoji glyph width.
<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
  <span style={{ width: 32, flexShrink: 0, fontSize: 18 }}>{award.emoji}</span>
  <div>
    <span style={{ fontSize: 16, color: C.text }}>{fr.duo_awards[award.awardKey]}</span>
    <span style={{ fontSize: 13, color: C.muted }}>
      {' · '}{award.playerA.pseudo} & {award.playerB.pseudo}
    </span>
  </div>
</div>
```

**No % widths anywhere in this component** (all layout is flex + fixed px).

**Props shape:**
```typescript
interface DuoAwardsBlockProps {
  awards: DuoAward[]   // 2–4 items; caller guarantees length >= 2 before rendering
  themeColor: string
}
```

---

### `ShareCard` refactor (~L1187) — 2-face card

**Analog:** Existing `ShareCard` in game/page.tsx lines 1187–1299 (full component)

**forwardRef declaration** (lines 1188–1195):
```typescript
const ShareCard = forwardRef<HTMLDivElement, {
  theme: string
  titleName: string
  statText: string
  players: Player[]
  myPseudo?: string
  myStats?: PlayerStats
  // ADD for Phase A:
  activeCard: 'group' | 'personal'
  archetype: ArchetypeResult | null
  duoAwards: DuoAward[]
}>(function ShareCard({ ..., activeCard, archetype, duoAwards }, ref) {
```

**540×540 container with ref** (lines 1200–1208 — do not change dimensions):
```typescript
<div
  ref={ref}
  style={{
    width: 540, height: 540, background: C.bg, position: 'relative',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: 'var(--font-body)',
  }}
>
```

**Face swap — conditional render, not display:none** (P-07 rule):
```typescript
// Inside the 540×540 container, after the 6px color bar and theme/logo header:
{activeCard === 'group' ? (
  <Face1GroupContent
    titleName={titleName}
    duoAwards={duoAwards}
    themeColor={meta.color}
    players={players}
  />
) : (
  <Face2PersonalContent
    statText={statText}
    myPseudo={myPseudo}
    myStats={myStats}
    archetype={archetype}
    themeColor={meta.color}
    players={players}
  />
)}
// Both Face1 and Face2 end with the player pills + footer — these can be
// extracted to a shared <CardFooter players={players} /> to avoid duplication.
```

**Off-screen capture div and scaled visual preview** (lines 1575–1584 — two separate ShareCard instances):
```typescript
{/* Full-size card rendered off-screen — captured as-is (no transform → no crop). */}
<div style={{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none' }} aria-hidden>
  <ShareCard ref={cardRef} {...sharedProps} activeCard={activeCard} />
</div>
{/* Scaled-down visual preview (display only — no ref). */}
<div style={{ width: 313, height: 313, overflow: 'hidden', borderRadius: 16 }}
     onClick={() => setActiveCard(c => c === 'group' ? 'personal' : 'group')}>
  <div style={{ transform: 'scale(0.58)', transformOrigin: 'top left', width: 540, height: 540 }}>
    <ShareCard {...sharedProps} activeCard={activeCard} />
  </div>
</div>
```

**Flip affordance** — rendered OUTSIDE both ShareCard instances (in modal chrome only, never captured):
```typescript
<p style={{ fontSize: 13, color: C.faint, textAlign: 'center', cursor: 'pointer', marginTop: 8 }}
   onClick={() => setActiveCard(c => c === 'group' ? 'personal' : 'group')}>
  {activeCard === 'group' ? fr.card.flip_to_personal : fr.card.flip_to_group}
</p>
```

---

### `EndScreen` refactor (~L1303) — computation hub

**Analog:** Existing `EndScreen` in game/page.tsx lines 1303–1410

**Existing stats-derivation pattern** (lines 1346–1358 — replicate this model for archetype/awards):
```typescript
// Derive everything from already-fetched data; no additional async inside render.
const totalRounds = gs.stats.rounds_a + gs.stats.rounds_b + gs.stats.rounds_c
const titleKey = computeGroupTitle(gs.stats, theme, totalRounds)
const myStats: PlayerStats | undefined = myId ? {
  designated:  (gs.stats.designated  ?? {})[myId] ?? 0,
  confessed:   (gs.stats.confessed   ?? {})[myId] ?? 0,
  volunteered: (gs.stats.volunteered ?? {})[myId] ?? 0,
} : undefined
```

**useEffect fetch pattern with single-fire guard** (lines 1318–1343):
```typescript
// Existing pattern: useEffect gated on gs.phase + a stable ID, fires once.
useEffect(() => {
  if (gs?.phase !== 'ended' || !user?.id || !gs.session_uuid) return
  // ... fetch / compute / write ...
}, [gs?.phase, gs?.session_uuid, user?.id])
```

**New votes fetch for archetype/awards** — add a second `useState` + `useEffect` pair:
```typescript
const [allRoomVotes, setAllRoomVotes] = useState<VoteRow[] | null>(null)
const [playedQuestions, setPlayedQuestions] = useState<Question[] | null>(null)

useEffect(() => {
  if (gs?.phase !== 'ended') return
  // Fetch all room votes once — powers both duo awards and self-filtered archetype.
  // Use explicit column list to be future-proof (A-RESEARCH.md open question 3).
  supabase
    .from('votes')
    .select('id, round, player_id, vote_type, target_player_id, answer')
    .eq('room_id', roomId)   // roomId must be in scope (add to EndScreen props or derive from players[0].room_id)
    .then(({ data }) => setAllRoomVotes(data ?? []))

  // Fetch played questions with tags for archetype computation.
  if (gs.played_question_ids.length > 0) {
    supabase
      .from('questions')
      .select()  // select() with no args returns all columns including tags post-migration
      .in('id', gs.played_question_ids)
      .then(({ data }) => setPlayedQuestions((data ?? []) as Question[]))
  } else {
    setPlayedQuestions([])
  }
}, [gs?.phase])  // fires once; roomId and played_question_ids are stable at 'ended'
```

**useMemo for archetype + awards** (prevents re-computation on every render):
```typescript
const archetypeResult = useMemo(() => {
  if (!allRoomVotes || !playedQuestions || !myId) return null
  const myVotes = allRoomVotes.filter(v => v.player_id === myId)
  const scores = computeTraitScores(myVotes, playedQuestions, gs)
  return computeArchetype(scores)
}, [allRoomVotes, playedQuestions, myId])

const duoAwardsResult = useMemo(() => {
  if (!allRoomVotes || !players) return []
  return computeDuoAwards(allRoomVotes, players)
}, [allRoomVotes, players])
```

**activeCard state** (add alongside existing `showCard` state at line 1360):
```typescript
const [showCard, setShowCard] = useState(false)
const [activeCard, setActiveCard] = useState<'group' | 'personal'>('group')  // ADD
const [exporting, setExporting] = useState(false)
const cardRef = useRef<HTMLDivElement>(null)
```

**exportCard() — unchanged** (lines 1364–1404):
```typescript
// The capture reads cardRef.current (the off-screen div) which now renders only
// the active face. The domToBlob call itself does not change.
const blob = await domToBlob(cardRef.current, {
  width: 540,
  height: 540,
  scale: 2,
  backgroundColor: C.bg,
  type: 'image/png',
})
```

**Existing stat-write useEffect with D-08 tag_scores fold-in** (lines 1318–1343):
```typescript
// If D-08 is folded in: compute tag_scores BEFORE the upsert.
// ignoreDuplicates: true makes a partial {} write permanent (P-13).
// tag_scores must be fully computed (await) before the .upsert() call.
// The existing upsert already has the slot: tag_scores: {} — replace {} with computed scores.
useEffect(() => {
  if (gs?.phase !== 'ended' || !user?.id || !gs.session_uuid) return
  // ...existing stat derivation...
  // D-08: If votes and questions are already fetched, compute tag_scores here:
  // const scores = (allRoomVotes && playedQuestions && myId)
  //   ? computeTraitScores(allRoomVotes.filter(v => v.player_id === myId), playedQuestions, gs)
  //   : {}
  supabase.from('user_session_stats').upsert(
    { ..., tag_scores: {} /* replace {} with scores if D-08 folded */ },
    { onConflict: 'user_id,session_id', ignoreDuplicates: true }
  )
}, [gs?.phase, gs?.session_uuid, user?.id])
```

---

## Shared Patterns

### Design Tokens (`C` object)
**Source:** `app/room/[code]/game/page.tsx` (~L28, local constant)
**Apply to:** `ArchetypeBlock`, `DuoAwardsBlock`, `ShareCard` Face1/Face2 sub-components

The `C` object is defined in game/page.tsx as a module-level constant. New components in `components/` cannot import it directly (it's not exported). **Copy the relevant token values as named constants inside each new component file**, or extract `C` to `lib/tokens.ts` if the planner chooses that refactor.

Current `C` values (verified from codebase):
```typescript
const C = {
  bg:      '#0D0D0D',
  surface: '#1A1A1A',
  border:  '#252525',
  text:    '#FFFFFF',
  muted:   '#888888',
  faint:   '#555555',
  // ...accent colors a, b, c for existing elements
}
```

### `useT()` Convention
**Source:** `lib/locale.tsx`, used across all game components
**Apply to:** `ArchetypeBlock`, `DuoAwardsBlock`
```typescript
const fr = useT()   // Always named 'fr' per project convention
// Access: fr.archetypes.card_title, fr.duo_awards.title, fr.card.flip_to_personal
```

### modern-screenshot Capture Discipline
**Source:** `EndScreen.exportCard()` lines 1364–1404
**Apply to:** `ShareCard` refactor (no changes to the capture call; discipline is in the markup)

Rules enforced by pattern (all from PITFALLS):
1. `ref` on the off-screen div, no ref on the visual preview
2. Off-screen position: `{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none' }`
3. `await document.fonts.ready` before `domToBlob`
4. Explicit px widths (never `%`) for any computed-width element inside the capture div
5. Never render both faces simultaneously (swap subtrees based on `activeCard`)

### No Supabase Inside Pure Modules
**Source:** `lib/game.ts` — `computeGroupTitle`, `tallyDesignation`, `accumulateStats` have no imports from Supabase
**Apply to:** `lib/archetypes.ts`, `lib/awards.ts`

All data arrives as arguments. Callers (EndScreen) do the fetching.

### Inline-Style-Only Inside Card Capture
**Source:** `ShareCard` lines 1200–1298
**Apply to:** `ArchetypeBlock`, `DuoAwardsBlock`, Face1/Face2 sub-components

No Tailwind classes inside any component that renders inside the 540×540 capture div. Use Tailwind only for live-DOM chrome (the flip affordance text, the Share button, the modal wrapper).

---

## No Analog Found

All files have close analogs. No entries here.

---

## SQL / Migration Note (not a code file, but tracked for completeness)

`supabase/migration_add_tags.sql` — **already authored and presumed run on prod**. The planner's Wave 0 should include a verification step:

```sql
-- Run on prod Supabase SQL editor to confirm tags migration success:
SELECT COUNT(*) FROM questions WHERE tags = '[]'::jsonb;
-- If > ~10% of row count, encoding mismatch; investigate before proceeding.
SELECT COUNT(*) FROM questions WHERE tags != '[]'::jsonb;
-- Target: most rows have non-empty tags.
```

Pattern from `supabase/schema.sql` (idempotent DDL convention): use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — already present in `migration_add_tags.sql`.

---

## Metadata

**Analog search scope:** `lib/`, `app/room/[code]/game/`, `components/`, `supabase/`
**Files scanned:** `lib/game.ts`, `lib/types.ts`, `lib/i18n.ts` (lines 1–258), `app/room/[code]/game/page.tsx` (lines 1187–1410, 1575–1590), `A-CONTEXT.md`, `A-RESEARCH.md`, `A-UI-SPEC.md`
**Pattern extraction date:** 2026-06-14
