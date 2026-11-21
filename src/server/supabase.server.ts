import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { serverEnv } from './env.server'

/** Supabase client that acts as the signed-in user, so Row Level Security applies. */
export function createUserClient(accessToken: string) {
  return createClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
