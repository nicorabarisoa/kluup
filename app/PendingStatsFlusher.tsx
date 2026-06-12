'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getPendingStats, clearPendingStats } from '@/lib/utils'
import { useT } from '@/lib/locale'

/**
 * Global pending-stats flusher — mounted once in the root layout (inside
 * LocaleProvider) so it fires on every route the OAuth callback can land on.
 *
 * On SIGNED_IN (or mount-while-already-signed-in), it reads the
 * kluup_pending_stats stash (written by handleCTASignIn before the OAuth
 * redirect) and upserts it to user_session_stats. The flush is idempotent:
 * onConflict ignoreDuplicates + stash cleared on success → at most one
 * effective write per session even if SIGNED_IN fires multiple times.
 *
 * The stash lives in localStorage and is independent of room lifetime, so
 * the save succeeds even when the pg_cron sweep deleted the room during a
 * slow OAuth sign-in.
 */
export default function PendingStatsFlusher() {
  const fr = useT()
  const [showToast, setShowToast] = useState(false)
  // Guard: prevents getUser() and SIGNED_IN from both triggering a flush.
  const flushingRef = useRef(false)

  useEffect(() => {
    async function flush(userId: string) {
      if (flushingRef.current) return
      const pending = getPendingStats() // returns null if absent or older than 24h
      if (!pending) return

      flushingRef.current = true
      const { error } = await supabase
        .from('user_session_stats')
        .upsert(
          {
            user_id:           userId,
            session_id:        pending.session_id,
            designated_count:  pending.designated_count,
            confessed_count:   pending.confessed_count,
            volunteered_count: pending.volunteered_count,
            group_title:       pending.group_title,
            theme:             pending.theme,
            rounds_played:     pending.rounds_played,
            tag_scores:        {},
            // note: pending.code and pending.stashed_at are stash-only metadata,
            // NOT user_session_stats columns — deliberately excluded here.
          },
          { onConflict: 'user_id,session_id', ignoreDuplicates: true }
        )

      if (error) {
        console.error('[pending stats flush]', error)
        flushingRef.current = false // allow a retry on next SIGNED_IN
        return
      }

      clearPendingStats()
      setShowToast(true)
      // Auto-hide toast after ~4 s
      setTimeout(() => setShowToast(false), 4000)
    }

    // Case 1: the SIGNED_IN event already fired in the /auth/callback route
    // before this component mounted — check if the user is already signed in.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) flush(data.user.id)
    })

    // Case 2: SIGNED_IN fires while this component is mounted (covers routes
    // where the auth state settles after first render).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          flush(session.user.id)
        }
      }
    )

    return () => { subscription.unsubscribe() }
  }, [])

  if (!showToast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#1A1A1A',
        border: '1px solid #252525',
        color: '#ffffff',
        padding: '0.5rem 1.25rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {fr.save_prompt.flushed}
    </div>
  )
}
