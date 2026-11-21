import type { Json, Tables } from './database.types'
import { getBrowserSupabase } from './supabase'

const db = () => getBrowserSupabase()
function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export type ClinicFull = Tables<'clinics'>
export type InviteRow = Tables<'clinic_invites'>

export async function listAdminClinics(userId: string): Promise<ClinicFull[]> {
  const { data, error } = await db().from('clinic_admins').select('clinics(*)').eq('user_id', userId)
  fail(error)
  return (data ?? []).flatMap((r) => (Array.isArray(r.clinics) ? r.clinics : r.clinics ? [r.clinics] : []))
}

export type ClinicPatch = Partial<Pick<ClinicFull, 'name' | 'address' | 'phone' | 'email' | 'lat' | 'lng' | 'specialties' | 'accepting_intakes' | 'require_triage_signoff'>> & { operating_hours?: Json }

export async function updateClinic(id: string, patch: ClinicPatch): Promise<void> {
  const { error } = await db().from('clinics').update(patch).eq('id', id)
  fail(error)
}

export async function registerClinic(name: string): Promise<string> {
  const { data, error } = await db().rpc('register_clinic', { _name: name })
  fail(error)
  return data as string
}
export async function addSelfAsDoctor(clinicId: string, specialty: string | null): Promise<void> {
  const { error } = await db().rpc('admin_add_self_as_doctor', { _clinic: clinicId, ...(specialty ? { _specialty: specialty } : {}) })
  fail(error)
}
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await db().rpc('accept_clinic_invite', { _token: token })
  fail(error)
  return data as string
}

export async function listInvites(clinicId: string): Promise<InviteRow[]> {
  const { data, error } = await db().from('clinic_invites').select('*').eq('clinic_id', clinicId).is('accepted_at', null).order('created_at', { ascending: false })
  fail(error)
  return data ?? []
}
export async function createInvite(clinicId: string, email: string, specialty: string | null, invitedBy: string): Promise<InviteRow> {
  const { data, error } = await db().from('clinic_invites').insert({ clinic_id: clinicId, email: email.trim().toLowerCase(), specialty, invited_by: invitedBy }).select('*').single()
  fail(error)
  return data
}
export async function revokeInvite(id: string): Promise<void> {
  const { error } = await db().from('clinic_invites').delete().eq('id', id)
  fail(error)
}
export async function setLicense(clinicId: string, userId: string, license_number: string | null, license_verified: boolean): Promise<void> {
  const { error } = await db().from('clinic_doctors').update({ license_number, license_verified }).eq('clinic_id', clinicId).eq('user_id', userId)
  fail(error)
}
export async function removeDoctor(clinicId: string, userId: string): Promise<void> {
  const { error } = await db().from('clinic_doctors').delete().eq('clinic_id', clinicId).eq('user_id', userId)
  fail(error)
}

export const inviteLink = (token: string) => `${window.location.origin}/join?token=${token}`

// ───────── Operating hours
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]
export type Hours = Record<Day, { open: string; close: string } | null>
export const DAY_LABEL: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

export function parseHours(json: unknown): Hours {
  const out = {} as Hours
  const src = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  for (const d of DAYS) {
    const v = src[d] as { open?: unknown; close?: unknown } | null | undefined
    out[d] = v && typeof v.open === 'string' && typeof v.close === 'string' ? { open: v.open, close: v.close } : null
  }
  return out
}
