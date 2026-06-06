'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useT, LangSwitch } from '@/lib/locale'

// Unambiguous alphabet (no 0/O, 1/I) so codes read off a screen don't get
// mistyped. Always exactly 6 chars — the old Math.random().substring could
// occasionally yield fewer.
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
  const router = useRouter()

  async function createRoom() {
    if (!pseudo.trim()) return
    setLoading(true)

    // Opportunistic maintenance: sweep dead rooms (>3h idle). Fire-and-forget —
    // never let it block or break room creation.
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
        .insert({ code })
        .select()
        .single()
      if (data) { room = data; break }
      lastError = error
      // 23505 = unique_violation → retry with a fresh code; otherwise bail.
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
      .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: true })
      .select()
      .single()

    if (playerError || !player) {
      console.error('[createRoom] player insert failed:', playerError)
      alert(fr.home.create_error)
      setLoading(false)
      return
    }

    sessionStorage.setItem('player_id', player.id)

    router.push(`/room/${room.code}/lobby`)
  }

  return (
    <main className="flex min-h-screen flex-col p-6" style={{ background: '#0D0D0D' }}>
      <div className="w-full flex justify-end">
        <LangSwitch />
      </div>

      {/* Logo + form grouped and vertically centered (sits higher than pinned-to-bottom). */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-6xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Klu<span style={{ color: '#FF3C6F' }}>up</span>
          </h1>
          <p style={{ color: '#888' }} className="text-sm text-center">
            {fr.home.tagline}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="text"
            placeholder={fr.common.pseudo_placeholder}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            maxLength={20}
            className="rounded-2xl px-4 py-4 text-white text-base outline-none"
            style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
          />
          <button
            type="button"
            onClick={createRoom}
            disabled={loading || !pseudo.trim()}
            className="font-bold py-4 rounded-2xl text-base disabled:opacity-40"
            style={{ background: '#FF3C6F', color: '#fff', fontFamily: 'var(--font-body)' }}
          >
            {loading ? fr.home.creating : fr.home.create_btn}
          </button>
          <button
            type="button"
            onClick={() => router.push('/join')}
            className="font-medium py-4 rounded-2xl text-base text-white"
            style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
          >
            {fr.home.join_btn}
          </button>
        </div>
      </div>
    </main>
  )
}
