'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { use } from 'react'
import { useRouter } from 'next/navigation'

type Player = {
  id: string
  pseudo: string
  is_host: boolean
  is_online: boolean
}

export default function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [players, setPlayers] = useState<Player[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const router = useRouter()

useEffect(() => {
  const id = localStorage.getItem('player_id')
  setMyId(id)

  async function loadPlayers() {
    const { data: room } = await supabase
      .from('rooms')
      .select()
      .eq('code', code)
      .single()

    if (!room) return

    const { data } = await supabase
      .from('players')
      .select()
      .eq('room_id', room.id)

    if (data) setPlayers(data)
  }

  loadPlayers()

  const channel = supabase
    .channel(`lobby-${code}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'players',
    }, (payload) => {
      setPlayers((prev) => {
        const exists = prev.find((p) => p.id === payload.new.id)
        if (exists) return prev
        return [...prev, payload.new as Player]
      })
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [code])

  const me = players.find((p) => p.id === myId)
  const isHost = me?.is_host ?? false

  async function startGame() {
    router.push(`/room/${code}/game`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-2">Lobby</h1>
      <p className="text-gray-400 mb-8">
        Code : <span className="text-white font-bold">{code}</span>
      </p>

      <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
        {players.map((player) => (
          <div
            key={player.id}
            className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span className="font-medium">
              {player.pseudo}
              {player.id === myId && (
                <span className="text-gray-400 text-sm ml-2">(toi)</span>
              )}
            </span>
            {player.is_host && (
              <span className="text-xs text-gray-400">Hôte</span>
            )}
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={startGame}
          disabled={players.length < 3}
          className="bg-white text-black font-bold py-4 px-8 rounded-2xl text-lg disabled:opacity-40 w-full max-w-xs"
        >
          {players.length < 3
            ? `Encore ${3 - players.length} joueur(s)...`
            : 'Lancer la partie 🎉'}
        </button>
      ) : (
        <p className="text-gray-500 text-sm">En attente de l'hôte...</p>
      )}
    </main>
  )
}