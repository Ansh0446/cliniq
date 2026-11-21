import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { getBrowserSupabase } from '@/lib/supabase'

/**
 * Attaches the browser session token to every server function call, then
 * verifies it server-side and exposes a user-scoped Supabase client.
 */
export const requireAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const { data } = await getBrowserSupabase().auth.getSession()
    const token = data.session?.access_token
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} })
  })
  .server(async ({ next }) => {
    const { createUserClient } = await import('./supabase.server')
    const header = getRequestHeader('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw new Error('Not signed in')
    const supabase = createUserClient(token)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new Error('Session expired. Please sign in again.')
    return next({ context: { supabase, userId: data.user.id } })
  })
