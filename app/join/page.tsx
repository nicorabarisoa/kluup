'use client'

import { Suspense, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPlayerId, setPlayerId, getLastPseudo, setLastPseudo, getGoogleFirstName } from '@/lib/utils'
import { useT, LangSwitch } from '@/lib/locale'

// Room codes: 6 chars from the no-ambiguity alphabet (no 0/O/1/I — cf landing
// CODE_ALPHABET). Anything else in ?code= (e.g. a stray PKCE uuid) is ignored.
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/

// IDEN-02 guard: before silently reusing a player row matched by user_id, check
// whether another device is actively using it (typical case: the joiner signed
// in with the SAME Google account as the host). Joins the room's presence
// channel as an observer and reads the synced state. On timeout (realtime
// hiccup) assume offline, so the legit cross-device reconnect keeps working.
function isPlayerOnline(roomId: string, playerId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const channel = supabase.channel(`presence-${roomId}`)
    const finish = (online: boolean) => {
      if (done) return
      done = true
      supabase.removeChannel(channel)
      resolve(online)
    }
    channel
      .on('presence', { event: 'sync' }, () => {
        finish(playerId in channel.presenceState())
      })
      .subscribe()
    setTimeout(() => finish(false), 2500)
  })
}

function JoinForm() {
  const fr = useT()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [loading, setLoading] = useState(false)
  const [pseudoError, setPseudoError] = useState<string | null>(null)
  const [storedPseudo, setStoredPseudo] = useState<string | null>(null)
  const [googlePrefill, setGooglePrefill] = useState<string | null>(null)
  const router = useRouter()

  // Auth state — one network call on mount, then kept live via onAuthStateChange (WR-01).
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

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

  async function handleSignIn() {
    // CR-03: route the round-trip through /auth/callback with ?next=<here>.
    // NEVER redirectTo the current URL directly: the PKCE flow comes back with
    // Supabase's own ?code=<uuid>, which collides with our ?code=<room code>
    // and was shown in the code field (playtest bug).
    const next = window.location.pathname + window.location.search
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    // browser navigates to Google — no cleanup needed
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    // Don't redirect — user can continue anonymously from the current page (WR-03).
  }

  // searchParams effect: pre-fill code field and stored-pseudo from localStorage.
  useEffect(() => {
    const c = searchParams.get('code')
    if (!c) return
    const upperCode = c.toUpperCase()
    if (!ROOM_CODE_RE.test(upperCode)) return // not a room code (e.g. PKCE uuid)
    setCode(upperCode)

    // Baseline fallback: pre-fill from the id/row-independent pseudo key.
    // This survives an explicit quit (clearPlayerId removes the pid key but
    // leaves kluup_pseudo_<CODE> intact — SC-4).
    const remembered = getLastPseudo(upperCode)
    if (remembered) {
      setStoredPseudo(remembered)
      setPseudo(remembered)
    }

    // Authoritative override: if the player id is still present and the DB row
    // still exists (reconnect path — browser closed without quitting), prefer
    // the DB value over the remembered pseudo.
    const pid = getPlayerId(upperCode)
    if (!pid) return
    supabase.from('players').select('pseudo').eq('id', pid).maybeSingle()
      .then(({ data }) => {
        if (data?.pseudo) {
          setStoredPseudo(data.pseudo)
          setPseudo(data.pseudo)
        }
      })
   
  }, [searchParams])

  // Separate Google prefill effect (CR-01): runs whenever user or storedPseudo
  // changes. By keeping this independent from the searchParams effect, the
  // Google first-name is applied correctly even when auth resolves after the
  // initial render (the common new-device scenario).
  useEffect(() => {
    if (storedPseudo) return       // stored/DB pseudo wins
    if (pseudo && pseudo !== '') return  // user already typed something
    if (!user) return
    const firstName = getGoogleFirstName(user)
    if (firstName) {
      setPseudo(firstName)
      setGooglePrefill(firstName)
      // Do NOT set storedPseudo — this is Google pre-fill, not a remembered game pseudo.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, storedPseudo])

  async function joinRoom() {
    if (!code.trim() || !pseudo.trim()) return
    setLoading(true)

    const normalizedCode = code.trim().toUpperCase()
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select()
      .eq('code', normalizedCode)
      .maybeSingle()

    if (roomError) {
      console.error('[joinRoom] room lookup failed:', roomError)
      alert(fr.join.join_error)
      setLoading(false)
      return
    }

    if (!room) {
      alert(fr.join.room_not_found)
      setLoading(false)
      return
    }

    // Hoist stored lookup — shared by IDEN-02 guard and localStorage reconnect block.
    let playerId: string | null = null
    const stored = getPlayerId(normalizedCode)
    // user_id written on insert — nulled out when the account's row is already
    // live on another device, so a room never holds two rows with the same
    // user_id (the IDEN-02 lookup below uses maybeSingle()).
    let insertUserId: string | null = user?.id ?? null

    // IDEN-02: signed-in user on a new device — match existing player row by user_id.
    // Only attempted when signed in AND no localStorage entry for this room (D-14).
    if (user && !stored) {
      const { data: existingByUid } = await supabase
        .from('players')
        .select('id, pseudo')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingByUid) {
        // Same-account guard: if that row is live on another device (typically
        // the joiner signed in with the host's Google account), don't hijack
        // it — fall through and join as a brand-new anonymous player.
        const online = await isPlayerOnline(room.id, existingByUid.id)
        if (online) {
          insertUserId = null
        } else {
          setPlayerId(normalizedCode, existingByUid.id)
          // WR-04: update the DB row if the user typed a different pseudo on this device.
          if (existingByUid.pseudo !== pseudo.trim()) {
            await supabase.from('players').update({ pseudo: pseudo.trim() }).eq('id', existingByUid.id)
          }
          setLastPseudo(normalizedCode, pseudo.trim())
          router.push(
            room.status === 'playing'
              ? `/room/${room.code}/game`
              : `/room/${room.code}/lobby`
          )
          setLoading(false)
          return  // skip insert — reconnected silently (D-12)
        }
      }
    }

    // Reconnect: if we still hold an identity for this room and that row still
    // exists, reuse it instead of inserting a duplicate (browser was closed,
    // the old row hasn't been pruned yet). If the player changed their pseudo,
    // update the row so they appear with the new name.
    if (stored) {
      const { data: existing } = await supabase
        .from('players').select('id, pseudo').eq('room_id', room.id).eq('id', stored).maybeSingle()
      if (existing) {
        playerId = existing.id
        if (existing.pseudo !== pseudo.trim()) {
          await supabase.from('players').update({ pseudo: pseudo.trim() }).eq('id', existing.id)
        }
      }
    }

    if (!playerId) {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false, user_id: insertUserId })
        .select()
        .single()

      if (playerError) {
        if (playerError.code === '23505') {
          setPseudoError(fr.join.pseudo_taken)
        } else {
          console.error('[joinRoom] player insert failed:', playerError)
          alert(fr.join.join_error)
        }
        setLoading(false)
        return
      }
      if (!player) { setLoading(false); return }
      playerId = player.id
    }

    if (!playerId) { setLoading(false); return }
    setPlayerId(room.code, playerId)
    setLastPseudo(room.code, pseudo.trim())

    const dest = room.status === 'playing' ? `/room/${room.code}/game` : `/room/${room.code}/lobby`
    router.push(dest)
  }

  return (
    <main className="flex min-h-screen flex-col p-6" style={{ background: '#0D0D0D' }}>
      <div className="w-full flex justify-between items-center">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-sm font-medium px-2 py-1"
          style={{ color: '#888', fontFamily: 'var(--font-body)' }}
        >
          {fr.join.back_home}
        </button>
        <div className="flex items-center gap-2">
          {!authLoading && !user && (
            <button
              onClick={handleSignIn}
              className="text-xs font-extrabold px-2.5 py-1.5 rounded-xl"
              style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#fff', fontFamily: 'var(--font-body)' }}
            >
              {fr.auth.sign_in}
            </button>
          )}
          {!authLoading && user && (
            <button
              onClick={handleSignOut}
              className="flex items-center text-xs px-2.5 py-1.5 rounded-xl max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
            >
              <span style={{ color: '#fff', fontWeight: 800 }}>{getGoogleFirstName(user)}</span>
              <span style={{ color: '#555555' }}> · </span>
              <span style={{ color: '#888888' }}>{fr.auth.sign_out}</span>
            </button>
          )}
          <LangSwitch />
        </div>
      </div>

      {/* Title + form grouped and vertically centered. */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
            {fr.join.title}
          </h1>
          <p style={{ color: '#888' }} className="text-sm">{fr.join.subtitle}</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="text"
            placeholder={fr.join.code_placeholder}
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setPseudoError(null) }}
            maxLength={6}
            className="rounded-2xl px-4 py-4 text-white text-xl font-bold outline-none text-center tracking-widest"
            style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
          />
          <input
            type="text"
            placeholder={fr.common.pseudo_placeholder}
            value={pseudo}
            onChange={(e) => { setPseudo(e.target.value); setPseudoError(null) }}
            maxLength={20}
            className="rounded-2xl px-4 py-4 text-white text-base outline-none"
            style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
          />
          {storedPseudo && pseudo === storedPseudo && (
            <p className="text-xs" style={{ color: '#888', fontFamily: 'var(--font-body)' }}>{fr.join.pseudo_prefilled_hint}</p>
          )}
          {!storedPseudo && googlePrefill && pseudo === googlePrefill && (
            <p className="text-xs" style={{ color: '#888', fontFamily: 'var(--font-body)' }}>{fr.auth.pseudo_prefilled_hint}</p>
          )}
          {pseudoError && (
            <p className="text-xs text-center" style={{ color: 'rgba(255,60,111,0.85)', fontFamily: 'var(--font-body)' }}>{pseudoError}</p>
          )}
          <button
            type="button"
            onClick={joinRoom}
            disabled={loading || !code.trim() || !pseudo.trim()}
            className="font-bold py-4 rounded-2xl text-base disabled:opacity-40"
            style={{ background: '#FF3C6F', color: '#fff', fontFamily: 'var(--font-body)' }}
          >
            {loading ? fr.join.joining : fr.join.join_btn}
          </button>
        </div>
      </div>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
