import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// NOTE: NEXT_PUBLIC_* vars are inlined at BUILD time. If these are missing when
// the app is built (e.g. on Railway without the Variables set), the client is
// created with undefined values and every request fails. Warn loudly so the
// cause is obvious in the console instead of failing silently.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase/server] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in your hosting provider (Railway → Variables) and rebuild — ' +
      'these values are baked in at build time, not runtime.'
  )
}

export async function createClient() {
  const cookieStore = await cookies() // MUST be awaited in Next.js 15+/16

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component: cookie writes are blocked.
            // Middleware will persist any session updates.
          }
        },
      },
    }
  )
}
