'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// 20s grace (D-04/D-06): covers a phone screen-lock + unlock within 20s without
// pruning the player; a closed tab is pruned after 20s. Applies identically to
// signed-in and anonymous players — the prune deletes by player id and never
// looks at user_id, so a player who hasn't resumed within the window is removed
// from the game regardless of auth state.
const GRACE_MS = 20_000
// The elected client refreshes the room's last_activity so the server sweep only
// reclaims rooms that have NO connected clients. 30s keeps presence signal fresher.
const HEARTBEAT_MS = 30_000

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
          try {
            await supabase.from('players').delete().eq('id', key)
            const { data: rest } = await supabase
              .from('players')
              .select('id, is_host, created_at')
              .eq('room_id', roomId)
            const remaining = rest ?? []
            if (remaining.length === 0) {
              await supabase.from('rooms').delete().eq('id', roomId)
            } else if (!remaining.some((p) => p.is_host)) {
              // The pruned ghost was the host (closed tab — onQuit's transfer never
              // ran). Promote the oldest remaining player so the room keeps a host:
              // the lobby's theme selector + "Lancer" (and in-game host-only actions)
              // stay reachable. The players UPDATE sub propagates is_host to everyone.
              const next = [...remaining].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0]
              await supabase.from('players').update({ is_host: true }).eq('id', next.id)
            }
          } catch { /* ignore */ }
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
