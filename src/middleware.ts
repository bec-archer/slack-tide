import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DASHBOARD_WHITELIST = ['beckeeper78@gmail.com']

const GATE_COOKIE = 'as_gate'

// Edge-compatible SHA-256 → hex
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Constant-time string compare (Edge has no Node timingSafeEqual)
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function isGateAuthorized(cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false
  const pin = process.env.ARCHERSTOCKS_PIN
  if (!pin) return false
  const expected = await sha256Hex(`archerstocks:${pin}`)
  return constantTimeEqual(cookie, expected)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- ArcherStocks PIN gate ---
  if (pathname.startsWith('/archerstocks') && !pathname.startsWith('/archerstocks-gate')) {
    const cookie = request.cookies.get(GATE_COOKIE)?.value
    const authorized = await isGateAuthorized(cookie)
    if (!authorized) {
      const url = request.nextUrl.clone()
      url.pathname = '/archerstocks-gate'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // --- Dashboard auth (existing) ---
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads from cookie — no network call, no timeout risk.
  // getUser() would verify server-side but hangs on Vercel's edge → 504.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // Not logged in → redirect to auth
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Logged in but not whitelisted → redirect to home
  if (!DASHBOARD_WHITELIST.includes(user.email || '')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/archerstocks',
    '/archerstocks/:path*',
  ],
}
