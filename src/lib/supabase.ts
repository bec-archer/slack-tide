import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Browser client — use in client components
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Legacy export for backward compatibility during migration
// Lazy-initialized to avoid build-time errors when env vars aren't set
let _supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseBrowserClient>, {
  get(_target, prop) {
    if (!_supabase) _supabase = createBrowserClient()
    return (_supabase as Record<string | symbol, unknown>)[prop]
  },
})
