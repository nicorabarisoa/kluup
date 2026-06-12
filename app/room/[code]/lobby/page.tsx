'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { makeInitialGameState, pickCandidates } from '@/lib/game'
import { Player } from '@/lib/types'
import { copyToClipboard, genId, getPlayerId, clearPlayerId } from '@/lib/utils'
import { useT, LangSwitch } from '@/lib/locale'
import { useRoomPresence } from '@/lib/usePresence'

const THEME_IDS = ['hello-stranger', 'apero', 'no-filter', 'unmasked']
const THEME_COLORS: Record<string, string> = {
  'hello-stranger': '#00C896',
  'apero': '#FFB800',
  'no-filter': '#FF3C6F',
  'unmasked': '#7B2FFF',
}

export default function LobbyPage() {
  const fr = useT()
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState('hello-stranger')
  const [starting, setStarting] = useState(false)

  const navigatedRef = useRef(false)
  const roomIdRef = useRef<string | null>(null)

  useEffect(() => {
    const id = getPlayerId(code)
    setMyId(id)

    async function loadRoom() {
      const { data: room, error } = await supabase
        .from('rooms')
        .select()
        .eq('code', code)
        .maybeSingle()

      // Diagnostic: if a freshly-created room reads as missing here, it's almost
      // always RLS (no anon SELECT policy) — run supabase/schema.sql. Check console.
      if (!room || error) {
        console.warn('[lobby] room not found:', { code, error: error?.message })
        router.replace('/')
        return
      }
      setRoomId(room.id)
      roomIdRef.current = room.id

      if (room.status === 'playing' || room.status === 'ended') {
        // Visitor not registered: send them to join before entering the game.
        if (!id) { router.replace(`/join?code=${code}`); return }
        navigate()
        return
      }

      const { data } = await supabase
        .from('players')
        .select()
        .eq('room_id', room.id)

      if (data) {
        setPlayers(data as Player[])
        // Visitor arrived via the lobby URL without going through /join.
        // Redirect them so they can enter their pseudo.
        if (!id || !data.find((p) => p.id === id)) {
          router.replace(`/join?code=${code}`)
          return
        }
      }
    }

    loadRoom()

    const channel = supabase
      .channel(`lobby-${code}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        // No server-side room filter on the realtime sub (room_id isn't known
        // when the channel is created), so guard against players from other rooms.
        if (payload.new.room_id !== roomIdRef.current) return
        setPlayers((prev) => {
          if (prev.find((p) => p.id === payload.new.id)) return prev
          return [...prev, payload.new as Player]
        })
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        // DELETE payloads only carry the primary key; removing an id we don't
        // have is a harmless no-op, so no room filter is needed here.
        setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        if (payload.new.room_id !== roomIdRef.current) return
        setPlayers((prev) => prev.map((p) => p.id === payload.new.id ? { ...p, ...payload.new } as Player : p))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `code=eq.${code}`,
      }, (payload) => {
        if (payload.new.status === 'playing') navigate()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Prune ghosts (closed tabs) and keep the room alive while anyone is here.
  useRoomPresence(roomId, myId)

  // Keep Realtime channels alive for signed-in users in long lobby sessions (>1h).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        await supabase.realtime.setAuth(session.access_token)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function navigate() {
    if (navigatedRef.current) return
    navigatedRef.current = true
    router.push(`/room/${code}/game`)
  }

  const me = players.find((p) => p.id === myId)
  const isHost = me?.is_host ?? false

  async function onQuit() {
    if (!roomId || !myId) { router.push('/'); return }
    const wasHost = isHost

    clearPlayerId(code)
    await supabase.from('players').delete().eq('id', myId)

    const { data: rest } = await supabase.from('players').select().eq('room_id', roomId)
    const remaining = (rest ?? []) as Player[]

    if (remaining.length === 0) {
      await supabase.from('rooms').delete().eq('id', roomId)
    } else if (wasHost) {
      const next = [...remaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
      // TOCTOU guard: verify the intended next host still exists before the update.
      const { data: updated } = await supabase.from('players').update({ is_host: true }).eq('id', next.id).select().single()
      if (!updated) {
        // next host was deleted between our read and our write — re-read and retry.
        const { data: fresh } = await supabase.from('players').select().eq('room_id', roomId)
        const freshRemaining = (fresh ?? []) as Player[]
        if (freshRemaining.length > 0) {
          const fallback = [...freshRemaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
          await supabase.from('players').update({ is_host: true }).eq('id', fallback.id)
        }
      }
    }

    router.push('/')
  }

  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/join?code=${code}`
    await copyToClipboard(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function startGame() {
    if (!roomId) return
    setStarting(true)

    // Wipe any votes from a previous game in this room. Rounds restart at 1, and
    // the UNIQUE(room_id, round, player_id, vote_type) constraint would otherwise
    // reject the new votes (and stale counts would break the resolution threshold).
    await supabase.from('votes').delete().eq('room_id', roomId)

    const candidates = await pickCandidates(selectedTheme, 1, [])
    const gs = makeInitialGameState(candidates)
    gs.session_uuid = genId() // fresh ID per session; also on replay (genId is safe on HTTP/LAN)
    gs.round_started_at = new Date().toISOString()
    gs.vote_round_player_count = players.length

    await supabase
      .from('rooms')
      .update({ status: 'playing', theme: selectedTheme, game_state: gs })
      .eq('id', roomId)

    navigate()
  }

  const AVATAR_COLORS = ['#FF3C6F', '#7B2FFF', '#FFD600', '#00C896']
  const C = { bg: '#0D0D0D', surface: '#1A1A1A', border: '#252525', muted: '#888', a: '#FF3C6F' }

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ background: C.bg, color: '#fff' }}
    >
     {/* Centered column so the lobby doesn't stretch edge-to-edge on desktop. */}
     <div className="w-full max-w-md mx-auto flex flex-col flex-1 pb-8">
      <div className="w-full flex justify-between items-center px-5 pt-4">
        <button
          type="button"
          onClick={onQuit}
          className="text-xs font-medium px-3 h-8 rounded-xl"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontFamily: 'var(--font-body)' }}
        >
          {fr.game.quit}
        </button>
        <LangSwitch />
      </div>
      {/* Header */}
      <div className="flex flex-col items-center pt-6 pb-6 px-5">
        <h1
          className="text-4xl font-extrabold mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Klu<span style={{ color: THEME_COLORS[selectedTheme] ?? '#FF6B35' }}>up</span>
        </h1>
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-extrabold tracking-widest"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.2em' }}
          >
            {code}
          </span>
          <button
            type="button"
            onClick={copyLink}
            className="text-xs font-medium px-3 py-1.5 rounded-xl"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: '#fff', fontFamily: 'var(--font-body)' }}
          >
            {copied ? fr.lobby.copied : fr.lobby.copy_link}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 flex-1">
        {/* Players */}
        <div className="flex flex-col gap-2">
          {players.map((player, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: C.surface }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: `${color}33`, border: `2px solid ${color}`, color, fontFamily: 'var(--font-display)' }}
                >
                  {player.pseudo.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-sm flex-1" style={{ fontFamily: 'var(--font-body)' }}>
                  {player.pseudo}
                  {player.id === myId && (
                    <span className="ml-2 text-xs" style={{ color: '#555' }}>{fr.common.you}</span>
                  )}
                </span>
                {player.is_host && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `${C.a}22`, color: C.a, fontFamily: 'var(--font-body)' }}
                  >
                    {fr.lobby.host_badge}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Theme selector — hôte only */}
        {isHost && (
          <div>
            <p className="text-xs mb-2 font-medium" style={{ color: '#888', fontFamily: 'var(--font-body)' }}>
              {fr.lobby.theme_label}
            </p>
            <div className="flex flex-col gap-2">
              {THEME_IDS.map((id) => {
                const theme = fr.lobby.themes[id]
                const isSelected = selectedTheme === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedTheme(id)}
                    className="rounded-2xl px-4 py-3 text-left flex items-center gap-3 transition-all"
                    style={{
                      background: isSelected ? '#fff' : C.surface,
                      border: `1px solid ${isSelected ? '#fff' : C.border}`,
                    }}
                  >
                    <span className="text-xl">{theme.emoji}</span>
                    <div>
                      <p
                        className="font-bold text-sm"
                        style={{ color: isSelected ? '#0D0D0D' : '#fff', fontFamily: 'var(--font-body)' }}
                      >
                        {theme.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: isSelected ? '#444' : '#666', fontFamily: 'var(--font-body)' }}
                      >
                        {theme.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!isHost && (
          <p className="text-sm text-center" style={{ color: '#555', fontFamily: 'var(--font-body)' }}>
            {fr.lobby.waiting_theme}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 mt-6">
        {isHost ? (
          <button
            type="button"
            onClick={startGame}
            disabled={players.length < 2 || starting}
            className="w-full font-bold py-4 rounded-2xl text-base disabled:opacity-40"
            style={{ background: C.a, color: '#fff', fontFamily: 'var(--font-body)' }}
          >
            {starting
              ? fr.lobby.starting
              : players.length < 2
              ? fr.lobby.need_players(2 - players.length)
              : fr.lobby.start_btn}
          </button>
        ) : (
          <p className="text-sm text-center" style={{ color: '#555', fontFamily: 'var(--font-body)' }}>
            {fr.lobby.waiting_host}
          </p>
        )}
      </div>
     </div>
    </main>
  )
}
