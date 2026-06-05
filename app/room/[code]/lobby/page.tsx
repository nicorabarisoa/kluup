'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { makeInitialGameState, pickCandidates } from '@/lib/game'
import { Player } from '@/lib/types'
import { copyToClipboard } from '@/lib/utils'
import { fr } from '@/lib/i18n'

const THEME_IDS = ['hello-stranger', 'apero', 'no-filter', 'unmasked']

export default function LobbyPage() {
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState('hello-stranger')
  const [starting, setStarting] = useState(false)
  const navigatedRef = useRef(false)

  useEffect(() => {
    const id = sessionStorage.getItem('player_id')
    setMyId(id)

    async function loadRoom() {
      const { data: room } = await supabase
        .from('rooms')
        .select()
        .eq('code', code)
        .single()

      if (!room) return
      setRoomId(room.id)

      if (room.status === 'playing' || room.status === 'ended') {
        navigate()
        return
      }

      const { data } = await supabase
        .from('players')
        .select()
        .eq('room_id', room.id)

      if (data) setPlayers(data as Player[])
    }

    loadRoom()

    const channel = supabase
      .channel(`lobby-${code}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        setPlayers((prev) => {
          if (prev.find((p) => p.id === payload.new.id)) return prev
          return [...prev, payload.new as Player]
        })
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

  function navigate() {
    if (navigatedRef.current) return
    navigatedRef.current = true
    router.push(`/room/${code}/game`)
  }

  const me = players.find((p) => p.id === myId)
  const isHost = me?.is_host ?? false

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

    const candidates = await pickCandidates(selectedTheme, 1, [])
    const gs = makeInitialGameState(candidates)

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
      className="flex min-h-screen flex-col pb-8"
      style={{ background: C.bg, color: '#fff' }}
    >
      {/* Header */}
      <div className="flex flex-col items-center pt-12 pb-6 px-5">
        <h1
          className="text-4xl font-extrabold mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Klu<span style={{ color: C.a }}>up</span>
        </h1>
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-extrabold tracking-widest"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.2em' }}
          >
            {code}
          </span>
          <button
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
    </main>
  )
}
