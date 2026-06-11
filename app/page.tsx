'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { genId, setPlayerId, getGoogleFirstName } from '@/lib/utils'
import { useT, LangSwitch } from '@/lib/locale'
import type { User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Design tokens (match the app)
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

const THEME_IDS = ['hello-stranger', 'apero', 'no-filter', 'unmasked'] as const
const THEME_COLORS: Record<string, string> = {
  'hello-stranger': '#00C896',
  'apero': '#FFB800',
  'no-filter': '#FF3C6F',
  'unmasked': '#7B2FFF',
}

// Unambiguous alphabet (no 0/O, 1/I) so codes read off a screen don't get
// mistyped. Always exactly 6 chars.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateCode() {
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export default function Home() {
  const fr = useT()
  const [pseudo, setPseudo] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Auth state — one network call on mount, then kept live via onAuthStateChange (WR-01).
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [googlePrefill, setGooglePrefill] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Pre-fill pseudo from Google name when user is signed in and field is empty.
  // Uses getGoogleFirstName from lib/utils (WR-02: no duplicate).
  useEffect(() => {
    if (user && !pseudo) {
      const firstName = getGoogleFirstName(user)
      if (firstName) {
        setPseudo(firstName)
        setGooglePrefill(firstName)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Return user to the landing page after the OAuth round-trip (CR-03).
        redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })
    // browser navigates to Google — no cleanup needed
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    // Stay on the landing page — no redirect needed (WR-03: router.push('/') was a no-op here anyway).
  }

  async function createRoom() {
    if (!pseudo.trim()) { inputRef.current?.focus(); return }
    setLoading(true)

    // Opportunistic maintenance: sweep dead rooms. Fire-and-forget.
    supabase.rpc('cleanup_dead_rooms').then(({ error }) => {
      if (error) console.warn('[cleanup_dead_rooms]', error.message)
    })

    // Retry on the rare code collision (UNIQUE constraint on rooms.code).
    let room: { id: string; code: string } | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5 && !room; attempt++) {
      const code = generateCode()
      const { data, error } = await supabase
        .from('rooms')
        // host_id is NOT NULL in the DB — always provide it (vestigial but required).
        .insert({ code, host_id: genId() })
        .select()
        .single()
      if (data) { room = data; break }
      lastError = error
      if (error?.code !== '23505') break
    }

    if (!room) {
      console.error('[createRoom] room insert failed:', lastError)
      alert(fr.home.create_error)
      setLoading(false)
      return
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true, user_id: user?.id ?? null })
      .select()
      .single()

    if (playerError || !player) {
      console.error('[createRoom] player insert failed:', playerError)
      alert(fr.home.create_error)
      setLoading(false)
      return
    }

    setPlayerId(room.code, player.id)
    router.push(`/room/${room.code}/lobby`)
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => inputRef.current?.focus(), 400)
  }

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100svh' }}>

      {/* Top bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6 pt-5">
        <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          <span style={{ color: '#FFFFFF' }}>Klu</span><span style={{ color: '#39FF14' }}>up</span>
        </span>
        <div className="flex items-center gap-2">
          {!authLoading && !user && (
            <button
              onClick={handleSignIn}
              className="text-xs font-extrabold px-2.5 py-1.5 rounded-xl"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: '#fff', fontFamily: 'var(--font-body)' }}
            >
              {fr.auth.sign_in}
            </button>
          )}
          {!authLoading && user && (
            <button
              onClick={handleSignOut}
              className="flex items-center text-xs px-2.5 py-1.5 rounded-xl max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ background: C.surface, border: `1px solid ${C.border}`, fontFamily: 'var(--font-body)' }}
            >
              <span style={{ color: '#fff', fontWeight: 800 }}>{getGoogleFirstName(user)}</span>
              <span style={{ color: C.faint }}> · </span>
              <span style={{ color: C.muted }}>{fr.auth.sign_out}</span>
            </button>
          )}
          <LangSwitch />
        </div>
      </div>

      {/* ===== Hero ===== */}
      <section
        className="flex flex-col items-center text-center px-6"
        style={{ minHeight: 'calc(100svh - 64px)', justifyContent: 'center', paddingBottom: 24 }}
      >
        <h1
          className="font-extrabold tracking-tight leading-none text-7xl sm:text-8xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span style={{ color: '#FFFFFF' }}>Klu</span><span style={{ color: '#39FF14' }}>up</span>
        </h1>
        <p className="mt-4 font-bold text-xl sm:text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
          {fr.home.tagline}
        </p>
        <p className="mt-4 text-sm sm:text-base leading-relaxed mx-auto" style={{ color: C.muted, maxWidth: 460 }}>
          {fr.landing.pitch}
        </p>

        {/* Create / join form (kept narrow — forms shouldn't be wide) */}
        <div className="flex flex-col gap-3 w-full mt-8" style={{ maxWidth: 340 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={fr.common.pseudo_placeholder}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            maxLength={20}
            className="rounded-2xl px-4 py-4 text-base outline-none text-center"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontFamily: 'var(--font-body)' }}
          />
          {googlePrefill && pseudo === googlePrefill && (
            <p className="text-center -mt-1" style={{ fontSize: 12, color: C.muted, fontFamily: 'var(--font-body)' }}>
              {fr.auth.pseudo_prefilled_hint}
            </p>
          )}
          <button
            type="button"
            onClick={createRoom}
            disabled={loading}
            className="font-bold py-4 rounded-2xl text-base disabled:opacity-50 transition-transform active:scale-95"
            style={{ background: C.a, color: '#fff', fontFamily: 'var(--font-body)' }}
          >
            {loading ? fr.home.creating : fr.home.create_btn}
          </button>
          <Link
            href="/join"
            className="font-medium py-4 rounded-2xl text-base text-center block"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontFamily: 'var(--font-body)' }}
          >
            {fr.home.join_btn}
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-5 text-xs" style={{ color: C.faint }}>
          <span>✓ {fr.landing.badge_free}</span>
          <span>✓ {fr.landing.badge_nosignup}</span>
          <span>✓ {fr.landing.badge_browser}</span>
        </div>
        <p className="mt-2 text-xs" style={{ color: C.faint }}>{fr.landing.players_hint}</p>

        <div className="mt-10 animate-bounce" style={{ color: C.faint, fontSize: 20 }}>↓</div>
      </section>

      {/* ===== How it works ===== */}
      <section className="w-full max-w-4xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 sm:mb-12" style={{ fontFamily: 'var(--font-display)' }}>
          {fr.landing.how_title}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: 1, t: fr.landing.how_1_title, b: fr.landing.how_1_body, color: C.a },
            { n: 2, t: fr.landing.how_2_title, b: fr.landing.how_2_body, color: C.b },
            { n: 3, t: fr.landing.how_3_title, b: fr.landing.how_3_body, color: C.c },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-4 md:flex-col rounded-2xl p-5" style={{ background: C.surface }}>
              <div
                className="flex items-center justify-center font-extrabold flex-shrink-0"
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${s.color}22`, color: s.color,
                  fontFamily: 'var(--font-display)', fontSize: 20,
                }}
              >
                {s.n}
              </div>
              <div>
                <p className="font-bold text-base" style={{ fontFamily: 'var(--font-body)' }}>{s.t}</p>
                <p className="text-sm mt-1 leading-snug" style={{ color: C.muted }}>{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Themes ===== */}
      <section className="w-full max-w-4xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center" style={{ fontFamily: 'var(--font-display)' }}>
          {fr.landing.themes_title}
        </h2>
        <p className="text-sm sm:text-base text-center mt-2 mb-8 sm:mb-12 mx-auto" style={{ color: C.muted, maxWidth: 420 }}>
          {fr.landing.themes_sub}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {THEME_IDS.map((id) => {
            const theme = fr.lobby.themes[id]
            const color = THEME_COLORS[id]
            return (
              <div key={id} className="rounded-2xl p-4 sm:p-5" style={{ background: C.surface, border: `1px solid ${color}33` }}>
                <div className="text-3xl sm:text-4xl mb-2">{theme.emoji}</div>
                <p className="font-bold text-sm sm:text-base" style={{ color, fontFamily: 'var(--font-body)' }}>{theme.name}</p>
                <p className="text-xs sm:text-sm mt-1 leading-snug" style={{ color: C.muted }}>{theme.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ===== Ways to play ===== */}
      <section className="w-full max-w-4xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 sm:mb-12" style={{ fontFamily: 'var(--font-display)' }}>
          {fr.landing.types_title}
        </h2>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {[
            { label: fr.designation.label, body: fr.landing.type_a_body, color: C.a },
            { label: fr.confession.label, body: fr.landing.type_b_body, color: C.b },
            { label: fr.question_ouverte.label, body: fr.landing.type_c_body, color: C.c },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl p-5" style={{ background: C.surface }}>
              <div className="h-1 w-10 rounded-full mb-3" style={{ background: t.color }} />
              <p className="font-extrabold uppercase text-sm" style={{ color: t.color, letterSpacing: '0.04em', fontFamily: 'var(--font-display)' }}>
                {t.label}
              </p>
              <p className="text-sm mt-1 leading-snug" style={{ color: C.muted }}>{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Closing CTA ===== */}
      <section className="px-6 py-16 sm:py-24 text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {fr.landing.closing_title}
        </h2>
        <p className="text-3xl sm:text-5xl font-extrabold leading-tight" style={{ fontFamily: 'var(--font-display)', color: C.a }}>
          {fr.landing.closing_body}
        </p>
        <button
          type="button"
          onClick={scrollToTop}
          className="font-bold py-4 px-10 rounded-2xl text-base mt-8 transition-transform active:scale-95"
          style={{ background: C.a, color: '#fff', fontFamily: 'var(--font-body)' }}
        >
          {fr.landing.start_cta}
        </button>
      </section>

      {/* ===== Footer ===== */}
      <footer className="px-6 py-10 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
        <span className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          Klu<span style={{ color: '#FF6B35' }}>up</span>
        </span>
        <p className="text-xs mt-1" style={{ color: C.faint }}>kluup.app</p>
      </footer>

    </main>
  )
}
