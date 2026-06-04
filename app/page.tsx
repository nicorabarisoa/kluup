'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { genId } from '@/lib/utils'

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
      .insert({ code, host_id: genId() })
      .select()
      .single()

    if (error || !room) {
      console.error(error)
      setLoading(false)
      return
    }

    const { data: player } = await supabase
      .from('players')
      .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true })
      .select()
      .single()

    if (player) sessionStorage.setItem('player_id', player.id)

    router.push(`/room/${code}/lobby`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 pb-10" style={{ background: '#0D0D0D' }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <h1 className="text-6xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Klu<span style={{ color: '#FF3C6F' }}>up</span>
        </h1>
        <p style={{ color: '#888' }} className="text-sm text-center">
          Le party game qui révèle tout
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Ton prénom"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          maxLength={20}
          className="rounded-2xl px-4 py-4 text-white text-base outline-none"
          style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
        />
        <button
          onClick={createRoom}
          disabled={loading || !pseudo.trim()}
          className="font-bold py-4 rounded-2xl text-base disabled:opacity-40"
          style={{ background: '#FF3C6F', color: '#fff', fontFamily: 'var(--font-body)' }}
        >
          {loading ? 'Création…' : 'Créer une room'}
        </button>
        <button
          onClick={() => router.push('/join')}
          className="font-medium py-4 rounded-2xl text-base text-white"
          style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
        >
          Rejoindre une room
        </button>
      </div>
    </main>
  )
}
