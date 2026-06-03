'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function Home() {
  const [pseudo, setPseudo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function createRoom() {
    if (!pseudo.trim()) return
    setLoading(true)

    const code = generateCode()

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ code, host_id: crypto.randomUUID() })
      .select()
      .single()

    if (error || !room) {
      console.error(error)
      setLoading(false)
      return
    }

    const { data: player } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        pseudo: pseudo.trim(),
        is_host: true,
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
      <h1 className="text-5xl font-bold mb-2">Kluup</h1>
      <p className="text-gray-400 mb-12 text-center">
        Le party game qui révèle tout
      </p>

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
          onClick={createRoom}
          disabled={loading || !pseudo.trim()}
          className="bg-white text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-40"
        >
          {loading ? 'Création...' : 'Créer une room'}
        </button>
        <button
          onClick={() => router.push('/join')}
          className="border border-white text-white font-bold py-4 rounded-2xl text-lg"
        >
          Rejoindre une room
        </button>
      </div>
    </main>
  )
}