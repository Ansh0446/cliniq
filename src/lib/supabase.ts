import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type TypedSupabase = SupabaseClient<Database>

let client: TypedSupabase | null = null

/** Browser client. The session lives in localStorage, so call this only in the browser. */
export function getBrowserSupabase(): TypedSupabase {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
    }
    client = createClient<Database>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
