'use client'

/**
 * components/DuoAwardsBlock.tsx
 *
 * Capture-safe duo-awards block for the share card (Face 1).
 * Renders a section label followed by one row per award:
 *   [emoji]  Award Name
 *            PlayerA & PlayerB
 *
 * All layout uses inline px styles and flex with fixed px cells —
 * NO Tailwind classes, NO percentage widths (P-07 rule).
 *
 * The C design-token object in game/page.tsx is module-private, so the needed
 * hex values are copied here as local constants.
 *
 * All strings resolved via `const fr = useT()` (project convention).
 * The caller (Plan 05 ShareCard) guarantees awards.length >= 2 before rendering,
 * but this component maps over whatever it receives.
 */

import { useT } from '@/lib/locale'
import type { DuoAward } from '@/lib/awards'

// ---------------------------------------------------------------------------
// Local design tokens (mirrors C object in game/page.tsx — not exported there)
// ---------------------------------------------------------------------------
const TOKEN_SURFACE = '#1A1A1A'
const TOKEN_TEXT    = '#FFFFFF'
const TOKEN_MUTED   = '#888888'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DuoAwardsBlockProps {
  /** 0–4 awards; caller guarantees >= 2 before rendering, but we map whatever arrives. */
  awards: DuoAward[]
  /** Theme accent color — used for the left border (e.g. '#FFB800'). */
  themeColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DuoAwardsBlock({ awards, themeColor }: DuoAwardsBlockProps) {
  const fr = useT()

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
          margin: '0 0 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.3,
        }}
      >
        {fr.duo_awards.title}
      </p>

      {/* Award rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {awards.map((award) => (
          <div
            key={award.awardKey}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {/* Emoji cell — fixed width for alignment regardless of glyph width */}
            <span
              style={{
                width: 32,
                flexShrink: 0,
                fontSize: 18,
                lineHeight: 1.4,
              }}
            >
              {award.emoji}
            </span>

            {/* Right column: award name + player names */}
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 400,
                  color: TOKEN_TEXT,
                  lineHeight: 1.4,
                }}
              >
                {(fr.duo_awards as Record<string, string>)[award.awardKey] ?? award.awardKey}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: TOKEN_MUTED,
                  lineHeight: 1.4,
                }}
              >
                {' · '}{award.playerA.pseudo} & {award.playerB.pseudo}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DuoAwardsBlock
