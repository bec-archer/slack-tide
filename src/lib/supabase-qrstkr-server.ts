import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server client for the QRSTKR database — use in API routes and server components
// Read-only data (projects, milestones, features, scope_log)
export async function createQrstkrServerClient() {
  const url = process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_QRSTKR_SUPABASE_URL or NEXT_PUBLIC_QRSTKR_SUPABASE_ANON_KEY environment variables'
    )
  }

  const cookieStore = await cookies()

  return createSupabaseServerClient(
    url,
    key,
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
            // setAll can fail in Server Components (read-only cookies)
          }
        },
      },
    }
  )
}
