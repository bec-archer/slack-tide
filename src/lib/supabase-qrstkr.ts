import { createBrowserClient } from '@supabase/ssr'

export function createQrstkrClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_ANON_KEY!
  )
}
