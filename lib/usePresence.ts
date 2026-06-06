'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Wait this long after a disconnect before pruning a player — covers phone locks,
// app backgrounding and brief network blips so we don't kick active players.
const GRACE_MS = 60_000
// The elected client refreshes the room's last_activity so the server sweep only
// reclaims rooms that have NO connected clients.
const HEARTBEAT_MS = 120_000

/**
 * Realtime Presence for a room. Prunes "ghost" player rows when someone
 * disconnects (tab closed, network lost) and doesn't return within a grace
 * period, and keeps the room alive while anyone is connected. The DB deletes
 * propagate to every client via the existing postgres_changes subscriptions.
 */
export function useRoomPresence(roomId: string | null, myId: string | null) {
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (!roomId || !myId) return

    const channel = supabase.channel(`presence-${roomId}`, {
      config: { presence: { key: myId } },
    })

    // Deterministic single actor: the connected player with the smallest id.
    // Avoids every client racing to prune / heartbeat the same room.
    const isCleaner = () => {
      const ids = Object.keys(channel.presenceState())
      return ids.length > 0 && myId === ids.sort()[0]
    }

    const cancelPrune = (key: string) => {
      const t = pending.current.get(key)
      if (t) { clearTimeout(t); pending.current.delete(key) }
    }

    channel
      .on('presence', { event: 'join' }, ({ key }) => cancelPrune(key))
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === myId) return
        cancelPrune(key)
        const t = setTimeout(async () => {
          pending.current.delete(key)
          if (channel.presenceState()[key]) return // reconnected within the grace period
          if (!isCleaner()) return                 // another client will handle it
          try { await supabase.from('players').delete().eq('id', key) } catch { /* ignore */ }
        }, GRACE_MS)
        pending.current.set(key, t)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: Date.now() })
        }
      })

    const bump = async () => {
      if (!isCleaner()) return
      try {
        await supabase.from('rooms').update({ last_activity: new Date().toISOString() }).eq('id', roomId)
      } catch { /* ignore */ }
    }
    const hb = setInterval(bump, HEARTBEAT_MS)

    const timers = pending.current
    return () => {
      clearInterval(hb)
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
      supabase.removeChannel(channel)
    }
  }, [roomId, myId])
}
