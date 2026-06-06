'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useT, LangSwitch } from '@/lib/locale'

function JoinForm() {
  const fr = useT()
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

    const normalizedCode = code.trim().toUpperCase()
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select()
      .eq('code', normalizedCode)
      .maybeSingle()

    // Log to help diagnose RLS / env issues: check browser console if join fails.
    console.log('[join] lookup:', { code: normalizedCode, found: !!room, error: roomError?.message })

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

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ room_id: room.id, pseudo: pseudo.trim(), is_host: false })
      .select()
      .single()

    if (playerError || !player) {
      console.error('[joinRoom] player insert failed:', playerError)
      alert(fr.join.join_error)
      setLoading(false)
      return
    }

    sessionStorage.setItem('player_id', player.id)

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
        <LangSwitch />
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
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="rounded-2xl px-4 py-4 text-white text-xl font-bold outline-none text-center tracking-widest"
            style={{ background: '#1A1A1A', border: '1px solid #252525', fontFamily: 'var(--font-body)' }}
          />
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
