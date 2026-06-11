import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function getPublicOrigin(request: NextRequest): string {
  // Railway auto-injects RAILWAY_PUBLIC_DOMAIN (no protocol). Use it first — most reliable.
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  // Generic reverse-proxy fallback (X-Forwarded-Host).
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (fwdHost) return `${fwdProto.split(',')[0].trim()}://${fwdHost.split(',')[0].trim()}`
  // Local dev: use the actual origin.
  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const origin = getPublicOrigin(request)

  // Per D-02: no code → not a real OAuth callback → silent redirect to home.
  if (!code) {
    return NextResponse.redirect(new URL('/', origin))
  }

  const cookieStore = await cookies() // MUST be awaited in Next.js 15+/16

  const supabase = createServerClient(
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
            // Defensive only — Route Handlers can write cookies.
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Per D-02: log server-side only — never expose OAuth error details to the client.
     
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // Redirect to home on both success and error (D-02: silent redirect, no error surface).
  return NextResponse.redirect(new URL('/', origin))
}
