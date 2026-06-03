'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function Home() {
  const router = useRouter()

  async function createRoom() {
    const code = generateCode()
    const hostId = crypto.randomUUID()

    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, host_id: hostId })
      .select()
      .single()

    if (error) {
      console.error(error)
      return
    }

    router.push(`/room/${data.code}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-5xl font-bold mb-2">Kluup</h1>
      <p className="text-gray-400 mb-12 text-center">
        Le party game qui révèle tout
      </p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={createRoom}
          className="bg-white text-black font-bold py-4 rounded-2xl text-lg"
        >
          Créer une room
        </button>
        <button className="border border-white text-white font-bold py-4 rounded-2xl text-lg">
          Rejoindre une room
        </button>
      </div>
    </main>
  )
}