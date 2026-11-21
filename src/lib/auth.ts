import { redirect } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import type { AppRole } from './clinical/constants'
import { getBrowserSupabase } from './supabase'

export interface AuthState {
  session: Session | null
  roles: AppRole[]
}

const ROLE_HOME: Record<AppRole, string> = {
  doctor: '/doctor/inbox',
  clinic_admin: '/clinic/settings',
  patient: '/app',
}
const ROLE_PRIORITY: AppRole[] = ['doctor', 'clinic_admin', 'patient']

export function homeFor(roles: AppRole[]): string {
  const role = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? 'patient'
  return ROLE_HOME[role]
}

export async function loadAuthState(): Promise<AuthState> {
  const supabase = getBrowserSupabase()
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return { session: null, roles: [] }
  const { data: rows } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
  return { session, roles: (rows ?? []).map((r) => r.role as AppRole) }
}

/** Route guard for `beforeLoad`. Runs in the browser only (routes set ssr: false). */
export async function guardRole(role: AppRole, location: { href: string }) {
  const state = await loadAuthState()
  if (!state.session) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
  if (!state.roles.includes(role)) {
    throw redirect({ to: homeFor(state.roles) })
  }
  return state
}
