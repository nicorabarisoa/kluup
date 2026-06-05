import { createClient } from '@supabase/supabase-js'

// NOTE: NEXT_PUBLIC_* vars are inlined at BUILD time. If these are missing when
// the app is built (e.g. on Railway without the Variables set), the client is
// created with undefined values and every request fails. Warn loudly so the
// cause is obvious in the console instead of failing silently.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in your hosting provider (Railway → Variables) and rebuild — ' +
      'these values are baked in at build time, not runtime.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')