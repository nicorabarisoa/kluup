'use client'

/**
 * components/ArchetypeBlock.tsx
 *
 * Capture-safe archetype block for the share card (Face 2).
 * Renders the archetype name (uppercase, display font) and up to 3 trait bars
 * with explicit integer pixel widths — NEVER percentage widths (P-07 rule).
 *
 * The C design-token object in game/page.tsx is module-private, so the needed
 * hex values are copied here as local constants.
 *
 * All strings resolved via `const fr = useT()` (project convention).
 */

import { useT } from '@/lib/locale'
import { TRAIT_COLORS } from '@/lib/archetypes'

// ---------------------------------------------------------------------------
// Local design tokens (mirrors C object in game/page.tsx — not exported there)
// ---------------------------------------------------------------------------
const TOKEN_SURFACE = '#1A1A1A'
const TOKEN_BORDER  = '#252525'
const TOKEN_TEXT    = '#FFFFFF'
const TOKEN_MUTED   = '#888888'

// ---------------------------------------------------------------------------
// Trait bar geometry (P-07: explicit integer pixels in capture context)
// ---------------------------------------------------------------------------
const MAX_BAR_PX = 160

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArchetypeBlockProps {
  /** i18n key — e.g. 'archetype_farceur'. Use 'archetype_fallback' when total points = 0. */
  archetypeKey: string
  /**
   * Top-3 traits with pct > 0, sorted descending by pct.
   * Empty array when archetypeKey === 'archetype_fallback'.
   */
  topTraits: Array<{ key: string; pct: number }>
  /** Theme accent color — used for the left border (e.g. '#00C896'). */
  themeColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArchetypeBlock({ archetypeKey, topTraits, themeColor }: ArchetypeBlockProps) {
  const fr = useT()

  // Traits to render: only those with pct > 0, maximum 3
  const visibleTraits = topTraits.filter((t) => t.pct > 0).slice(0, 3)

  // Fallback archetype: show name only, omit all trait rows
  const isFallback = archetypeKey === 'archetype_fallback'

  return (
    <div
      style={{
        background: TOKEN_SURFACE,
        borderRadius: 18,
        padding: '16px 16px',
        borderLeft: `4px solid ${themeColor}`,
        flexShrink: 0,
      }}
    >
      {/* Section label */}
      <p
        style={{
          color: TOKEN_MUTED,
          fontSize: 13,
          fontWeight: 400,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.3,
        }}
      >
        {fr.archetypes.card_title}
      </p>

      {/* Archetype name */}
      <p
        style={{
          color: TOKEN_TEXT,
          fontSize: 28,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          textTransform: 'uppercase',
          margin: '8px 0 12px',
          lineHeight: 1.1,
        }}
      >
        {(fr.archetypes as Record<string, string>)[archetypeKey] ?? archetypeKey}
      </p>

      {/* Divider — only shown when trait rows follow */}
      {!isFallback && visibleTraits.length > 0 && (
        <div
          style={{
            height: 1,
            background: TOKEN_BORDER,
            marginBottom: 8,
          }}
        />
      )}

      {/* Trait rows — omitted for fallback or when all traits are 0 */}
      {!isFallback &&
        visibleTraits.map((trait, idx) => {
          // P-07: explicit integer pixel width — NEVER `${pct}%`
          const barWidthPx = Math.round((trait.pct / 100) * MAX_BAR_PX)
          const traitColor = (TRAIT_COLORS as Record<string, string>)[trait.key] ?? TOKEN_MUTED
          const traitLabel = (fr.archetypes as Record<string, string>)[`trait_${trait.key}`] ?? trait.key
          const isLast = idx === visibleTraits.length - 1

          return (
            <div
              key={trait.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: isLast ? 0 : 8,
              }}
            >
              {/* Trait label */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: traitColor,
                  width: 88,
                  flexShrink: 0,
                  lineHeight: 1.3,
                }}
              >
                {traitLabel}
              </span>

              {/* Bar track */}
              <div
                style={{
                  height: 8,
                  flex: 1,
                  background: TOKEN_BORDER,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {/* Bar fill — explicit integer px width (P-07) */}
                <div
                  style={{
                    height: 8,
                    width: barWidthPx,
                    background: traitColor,
                    borderRadius: 4,
                  }}
                />
              </div>

              {/* Percent label */}
              <span
                style={{
                  fontSize: 13,
                  color: TOKEN_MUTED,
                  width: 36,
                  textAlign: 'right',
                  flexShrink: 0,
                  lineHeight: 1.3,
                }}
              >
                {trait.pct}%
              </span>
            </div>
          )
        })}
    </div>
  )
}

export default ArchetypeBlock
