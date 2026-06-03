'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [pseudo, setPseudo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function joinRoom() {
    if (!pseudo.trim()) return
    setLoading(true)

    const { data: room, error } = await supabase
      .from('rooms')
      .select()
      .eq('code', code)
      .single()

    if (error || !room) {
      alert('Room introuvable')
      setLoading(false)
      return
    }

    const { data: player } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        pseudo: pseudo.trim(),
        is_host: false,
      })
      .select()
      .single()

    if (player) {
      localStorage.setItem('player_id', player.id)
    }

    router.push(`/room/${code}/lobby`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-2">Rejoindre</h1>
      <p className="text-gray-400 mb-8">Room : {code}</p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder="Ton pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          maxLength={20}
          className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white placeholder-gray-500 text-lg outline-none"
        />
        <button
          onClick={joinRoom}
          disabled={loading || !pseudo.trim()}
          className="bg-white text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-40"
        >
          {loading ? 'Connexion...' : 'Entrer'}
        </button>
      </div>
    </main>
  )
}