'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

type Player = {
  id: string
  pseudo: string
  is_host: boolean
  is_online: boolean
}

export default function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    // Charger les joueurs existants
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

    // Écouter les nouveaux joueurs en temps réel
    const channel = supabase
      .channel(`lobby-${code}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        setPlayers((prev) => [...prev, payload.new as Player])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [code])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-2">Lobby</h1>
      <p className="text-gray-400 mb-8">Code : <span className="text-white font-bold">{code}</span></p>

      <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
        {players.map((player) => (
          <div
            key={player.id}
            className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span className="font-medium">{player.pseudo}</span>
            {player.is_host && (
              <span className="text-xs text-gray-400">Hôte</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-gray-500 text-sm">En attente des joueurs...</p>
    </main>
  )
}