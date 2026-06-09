import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // MUST be declared with `let` — it is reassigned inside setAll() when the
  // Supabase client writes refreshed session cookies back to the response.
  // Using `const` here breaks session persistence (Pitfall 4).
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to both the cloned request and the response so cookies
          // are readable by downstream Route Handlers in the same pass.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Triggers token refresh if a session cookie is present.
  // Returns { user: null } silently for anonymous requests — no error, no redirect.
  // Uses getUser() (authoritative server-side validation) not the deprecated
  // session accessor which reads storage without validating against the Auth server.
  await supabase.auth.getUser()

  return supabaseResponse
}
