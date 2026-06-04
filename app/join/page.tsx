'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const c = searchParams.get('code')
    if (c) setCode(c.toUpperCase())
  }, [searchParams])

  async function joinRoom() {
    if (!code.trim() || !pseudo.trim()) return
    setLoading(true)

    const { data: room } = await supabase
      .from('rooms')
      .select()
      .eq('code', code.trim().toUpperCase())
      .single()

    if (!room) {
      alert('Room introuvable — vérifie le code')
      setLoading(false)
      return
    }

    const { data: player } = await supabase
      .from('players')
      .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false })
      .select()
      .single()

    if (player) sessionStorage.setItem('player_id', player.id)

    const dest = room.status === 'playing' ? `/room/${room.code}/game` : `/room/${room.code}/lobby`
    router.push(dest)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 pb-10" style={{ background: '#0D0D0D' }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-1">
        <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          Rejoindre
        </h1>
        <p style={{ color: '#888' }} className="text-sm">Entre le code de la room</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Code (ex: 7TKFQU)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="rounded-2xl px-4 py-4 text-white text-xl font-bold outline-none text-center tracking-widest"
          style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
        />
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
          onClick={joinRoom}
          disabled={loading || !code.trim() || !pseudo.trim()}
          className="font-bold py-4 rounded-2xl text-base disabled:opacity-40"
          style={{ background: '#FF3C6F', color: '#fff', fontFamily: 'var(--font-body)' }}
        >
          {loading ? 'Connexion…' : 'Rejoindre'}
        </button>
      </div>
    </main>
  )
}
