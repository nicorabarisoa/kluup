'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useT, LangSwitch } from '@/lib/locale'
import { getGoogleFirstName } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Design tokens (match the app — copy from app/page.tsx and game/page.tsx)
// ---------------------------------------------------------------------------
const C = {
  bg: '#0D0D0D',
  surface: '#1A1A1A',
  border: '#252525',
  text: '#FFFFFF',
  muted: '#888888',
  faint: '#555555',
  a: '#FF3C6F',
  b: '#7B2FFF',
  c: '#FFD600',
}

// ---------------------------------------------------------------------------
// Inline primitives (copy from game/page.tsx — project convention, no shared import)
// ---------------------------------------------------------------------------

function playerInitial(pseudo: string) {
  return pseudo.trim().charAt(0).toUpperCase() || '?'
}

function avatarColor(index: number) {
  const palette = [C.a, C.b, C.c, '#00C896', '#FF8C00', '#00BFFF']
  return palette[index % palette.length]
}

function PlayerAvatar({ pseudo, index, size = 48 }: { pseudo: string; index: number; size?: number }) {
  const color = avatarColor(index)
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size, height: size,
        background: `${color}33`,
        border: `2px solid ${color}`,
        color,
        fontSize: size * 0.4,
        fontFamily: 'var(--font-display)',
      }}
    >
      {playerInitial(pseudo)}
    </div>
  )
}

function GhostBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 text-sm font-medium"
      style={{ color: C.muted, fontFamily: 'var(--font-body)' }}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string
  user_id: string
  session_id: string
  played_at: string
  designated_count: number
  confessed_count: number
  volunteered_count: number
  group_title: string | null
  theme: string | null
  rounds_played: number | null
  tag_scores: Record<string, number> | null
}

interface Cumulative {
  sessions: number
  designated: number
  confessed: number
  volunteered: number
}

// ---------------------------------------------------------------------------
// Archetype computation (D-08: dormant until v3.0 questions have tags)
// ---------------------------------------------------------------------------

const TRAIT_KEYS = ['drole', 'fiable', 'audacieux', 'empathique', 'mysterieux', 'romantique'] as const
type TraitKey = typeof TRAIT_KEYS[number]

function computeTraitTotals(rows: SessionRow[]): Record<TraitKey, number> {
  const totals = Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0])) as Record<TraitKey, number>
  for (const row of rows) {
    if (!row.tag_scores) continue
    for (const key of TRAIT_KEYS) {
      totals[key] += row.tag_scores[key] ?? 0
    }
  }
  return totals
}

function traitScoreTotal(totals: Record<TraitKey, number>) {
  return Object.values(totals).reduce((s, v) => s + v, 0)
}

// Top 3 sorted traits for bar rendering
function topTraits(totals: Record<TraitKey, number>): Array<{ key: TraitKey; score: number }> {
  return TRAIT_KEYS
    .map((key) => ({ key, score: totals[key] }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, 3)
}

// ---------------------------------------------------------------------------
// Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const fr = useT()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [allRows, setAllRows] = useState<SessionRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  async function fetchStats(uid?: string) {
    setDataLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('user_session_stats')
      .select('*')
      .order('played_at', { ascending: false })
    setDataLoading(false)
    if (error) {
      console.error('[profile] fetchStats error:', error)
      setLoadError(fr.profile.error_load)
      return
    }
    setAllRows((data ?? []) as SessionRow[])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/')
        return
      }
      setUser(data.user)
      setAuthLoading(false)
      fetchStats(data.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.push('/')
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cumulative stats — ALL rows (D-07)
  const cumulative: Cumulative = allRows.reduce(
    (acc, row) => ({
      sessions: acc.sessions + 1,
      designated: acc.designated + (row.designated_count ?? 0),
      confessed: acc.confessed + (row.confessed_count ?? 0),
      volunteered: acc.volunteered + (row.volunteered_count ?? 0),
    }),
    { sessions: 0, designated: 0, confessed: 0, volunteered: 0 }
  )

  // History — last 20 (D-07)
  const history = allRows.slice(0, 20)

  // Archetype (D-08: dormant until tag_scores non-zero)
  const traitTotals = computeTraitTotals(allRows)
  const totalTagScore = traitScoreTotal(traitTotals)
  const hasTraits = totalTagScore > 0
  const top3 = hasTraits ? topTraits(traitTotals) : []
  const maxTraitScore = hasTraits ? Math.max(...top3.map((t) => t.score), 1) : 1

  const displayName = user ? (getGoogleFirstName(user) || user.email?.split('@')[0] || '?') : '?'

  // Loading state — auth not yet resolved
  if (authLoading) {
    return (
      <main style={{ background: C.bg, color: C.text, minHeight: '100svh' }}>
        <div className="flex items-center justify-center" style={{ minHeight: '100svh' }}>
          <div className="rounded-2xl p-8" style={{ background: C.surface, color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.common.loading}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100svh', paddingBottom: 40 }}>

      {/* Top bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6 pt-5">
        <Link href="/" className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)', textDecoration: 'none' }}>
          <span style={{ color: '#FFFFFF' }}>Klu</span><span style={{ color: '#39FF14' }}>up</span>
        </Link>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={handleSignOut}
              className="flex items-center text-xs px-2.5 py-1.5 rounded-xl max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ background: C.surface, border: `1px solid ${C.border}`, fontFamily: 'var(--font-body)' }}
            >
              <span style={{ color: '#fff', fontWeight: 800 }}>{displayName}</span>
              <span style={{ color: C.faint }}> · </span>
              <span style={{ color: C.muted }}>{fr.auth.sign_out}</span>
            </button>
          )}
          <LangSwitch />
        </div>
      </div>

      {/* Page content — centered column, max-w-md (A-01 locked) */}
      <div className="max-w-md mx-auto px-5 pt-8">

        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <PlayerAvatar pseudo={displayName} index={0} size={56} />
          <p
            className="font-extrabold"
            style={{ fontSize: 20, fontFamily: 'var(--font-display)', marginTop: 8 }}
          >
            {displayName}
          </p>
          <p style={{ fontSize: 12, color: C.muted, fontFamily: 'var(--font-body)' }}>
            {fr.profile.sessions_played(cumulative.sessions)}
          </p>
        </div>

        {/* Loading / error state for data */}
        {dataLoading && (
          <div
            className="rounded-2xl p-5 text-center mb-4"
            style={{ background: C.surface, color: C.muted, fontFamily: 'var(--font-body)' }}
          >
            {fr.common.loading}
          </div>
        )}

        {loadError && !dataLoading && (
          <div className="rounded-2xl p-5 mb-4" style={{ background: C.surface }}>
            <p style={{ fontSize: 14, color: C.muted, fontFamily: 'var(--font-body)' }}>{loadError}</p>
            <GhostBtn onClick={() => fetchStats(user?.id)}>{fr.profile.error_load.split('.')[0] + '…'}</GhostBtn>
          </div>
        )}

        {!dataLoading && !loadError && (
          <>
            {/* Archetype block */}
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <p
                className="uppercase"
                style={{ fontSize: 12, fontWeight: 500, color: C.muted, fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}
              >
                {fr.archetypes.card_title}
              </p>
              {hasTraits ? (
                <>
                  {/* Non-zero path — lights up in v3.0 without redeploy (D-08) */}
                  <p
                    className="font-extrabold"
                    style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: C.a, marginTop: 4 }}
                  >
                    {fr.archetypes.archetype_fallback}
                  </p>
                  <div style={{ marginTop: 12 }}>
                    {top3.map((t, i) => {
                      const barColor = i === 0 ? C.a : i === 1 ? C.b : C.c
                      const pct = Math.max(4, Math.round((t.score / maxTraitScore) * 100))
                      const traitLabel = fr.archetypes[`trait_${t.key}` as keyof typeof fr.archetypes] as string
                      return (
                        <div key={t.key} className="flex items-center gap-2" style={{ marginTop: i === 0 ? 0 : 8 }}>
                          <span
                            style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)', color: C.muted, minWidth: 80 }}
                          >
                            {traitLabel}
                          </span>
                          <div className="flex-1 rounded-full" style={{ height: 6, background: C.border }}>
                            <div
                              className="rounded-full"
                              style={{ height: 6, width: `${pct}%`, background: barColor }}
                            />
                          </div>
                          <span
                            style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-body)', color: C.text, minWidth: 32, textAlign: 'right' }}
                          >
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                /* Dormant fallback (D-08 — tag_scores all zero in v2.0) */
                <>
                  <p
                    className="font-extrabold"
                    style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: C.a, marginTop: 4 }}
                  >
                    {fr.archetypes.archetype_fallback}
                  </p>
                  <p style={{ fontSize: 14, color: C.muted, fontFamily: 'var(--font-body)', marginTop: 8 }}>
                    {fr.archetypes.archetype_fallback}
                  </p>
                </>
              )}
            </div>

            {/* Cumulative stats 2×2 grid */}
            {cumulative.sessions > 0 && (
              <div
                className="rounded-2xl p-5 mb-6"
                style={{ background: C.surface }}
              >
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: cumulative.sessions, label: fr.profile.sessions_played(cumulative.sessions).replace(/^\d+\s*/, '') || 'sessions' },
                    { value: cumulative.designated, label: fr.profile.stat_designated_total },
                    { value: cumulative.confessed, label: fr.profile.stat_confessed_total },
                    { value: cumulative.volunteered, label: fr.profile.stat_volunteered_total },
                  ].map((cell) => (
                    <div key={cell.label} className="flex flex-col gap-1">
                      <span
                        className="font-extrabold"
                        style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: C.a, lineHeight: 1.1 }}
                      >
                        {cell.value}
                      </span>
                      <span style={{ fontSize: 12, color: C.muted, fontFamily: 'var(--font-body)' }}>
                        {cell.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session history */}
            {cumulative.sessions === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center text-center" style={{ marginTop: 64 }}>
                <p
                  className="font-extrabold"
                  style={{ fontSize: 20, fontFamily: 'var(--font-body)' }}
                >
                  {fr.profile.empty_heading}
                </p>
                <p style={{ fontSize: 14, color: C.muted, fontFamily: 'var(--font-body)', marginTop: 8 }}>
                  {fr.profile.empty_body}
                </p>
                <div style={{ marginTop: 32 }}>
                  <Link
                    href="/"
                    className="block py-3 px-6 rounded-2xl text-sm font-medium"
                    style={{ color: C.muted, fontFamily: 'var(--font-body)', background: C.surface, border: `1px solid ${C.border}` }}
                  >
                    {fr.profile.empty_cta}
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p
                  className="font-extrabold"
                  style={{ fontSize: 16, fontFamily: 'var(--font-body)', marginBottom: 12 }}
                >
                  {fr.profile.history_title}
                </p>
                <div className="flex flex-col gap-2">
                  {history.map((row) => {
                    const designated = row.designated_count ?? 0
                    const confessed = row.confessed_count ?? 0
                    const volunteered = row.volunteered_count ?? 0
                    // Group title i18n — NULL-safe (pre-Phase-5 rows may not have a title)
                    const titleEntry = row.group_title
                      ? (fr.titles as Record<string, { name: string; desc: string }>)[row.group_title]
                      : null
                    const titleName = titleEntry?.name ?? row.group_title ?? '—'
                    // Date formatting
                    const dateStr = row.played_at
                      ? new Date(row.played_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                      : ''
                    // Theme caption — NULL-safe (Pitfall 4)
                    const themeEntry = row.theme
                      ? (fr.lobby.themes as Record<string, { name: string }>)[row.theme]
                      : null
                    const themeCaption = themeEntry?.name ?? null
                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl p-4"
                        style={{ background: C.surface }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-extrabold overflow-hidden text-ellipsis whitespace-nowrap flex-1"
                            style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: C.a }}
                          >
                            {titleName}
                          </span>
                          <span style={{ fontSize: 12, color: C.muted, fontFamily: 'var(--font-body)', flexShrink: 0 }}>
                            {dateStr}
                          </span>
                        </div>
                        {(themeCaption || row.rounds_played) && (
                          <p style={{ fontSize: 12, color: C.muted, fontFamily: 'var(--font-body)', marginTop: 2 }}>
                            {[themeCaption, row.rounds_played != null ? `· ${row.rounds_played} manches` : null].filter(Boolean).join(' ')}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
                          {designated > 0 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${C.a}22`, color: C.a, fontFamily: 'var(--font-body)' }}
                            >
                              {fr.end.stat_designated(designated)}
                            </span>
                          )}
                          {confessed > 0 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${C.b}22`, color: C.b, fontFamily: 'var(--font-body)' }}
                            >
                              {fr.end.stat_confessed(confessed)}
                            </span>
                          )}
                          {volunteered > 0 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${C.c}22`, color: C.c, fontFamily: 'var(--font-body)' }}
                            >
                              {fr.end.stat_volunteered(volunteered)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
