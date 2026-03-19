import { createClient } from '@supabase/supabase-js'

export function createQrstkrClient() {
  return createClient(
    process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_ANON_KEY!
  )
}
