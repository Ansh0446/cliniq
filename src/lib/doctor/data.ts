import type { Database, Json, Tables } from '../database.types'
import { getBrowserSupabase } from '../supabase'
import type { InboxItem } from './inbox'

const db = () => getBrowserSupabase()
function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export interface StaffMember {
  user_id: string; full_name: string | null; specialty: string | null; license_number: string | null
  license_verified: boolean; is_admin: boolean; is_doctor: boolean
}
export interface MyClinic { id: string; name: string; specialty: string | null }
export type NoteRow = Tables<'case_notes'>
export type PatientProfile = Tables<'profiles'>

export async function listMyClinics(userId: string): Promise<MyClinic[]> {
  const { data, error } = await db().from('clinic_doctors').select('specialty, clinics(id,name)').eq('user_id', userId)
  fail(error)
  return (data ?? []).flatMap((r) => {
    const c = Array.isArray(r.clinics) ? r.clinics[0] : r.clinics
    return c ? [{ id: c.id, name: c.name, specialty: r.specialty }] : []
  })
}

export async function clinicStaff(clinicId: string): Promise<StaffMember[]> {
  const { data, error } = await db().rpc('clinic_staff', { _clinic: clinicId })
  fail(error)
  return (data ?? []) as StaffMember[]
}

export async function listInbox(): Promise<InboxItem[]> {
  const { data, error } = await db().from('doctor_inbox').select('*').order('triage_rank').order('sent_at').limit(300)
  fail(error)
  return (data ?? []).filter((r) => r.id) as unknown as InboxItem[]
}

export async function getPatientProfile(patientId: string): Promise<PatientProfile | null> {
  const { data, error } = await db().from('profiles').select('*').eq('id', patientId).maybeSingle()
  fail(error)
  return data
}

// ───────── Actions: all go through checked database functions
type Status = Database['public']['Enums']['case_status']
export async function setStatus(caseId: string, status: Status): Promise<void> {
  const { error } = await db().rpc('doctor_set_case_status', { _case_id: caseId, _status: status })
  fail(error)
}
export async function markReviewed(caseId: string): Promise<void> {
  const { error } = await db().rpc('doctor_mark_reviewed', { _case_id: caseId })
  fail(error)
}
export async function assignCase(caseId: string, doctorId: string): Promise<void> {
  const { error } = await db().rpc('doctor_assign_case', { _case_id: caseId, _doctor: doctorId })
  fail(error)
}
export async function requestInfo(caseId: string, note: string): Promise<void> {
  const { error } = await db().rpc('doctor_request_info', { _case_id: caseId, _note: note })
  fail(error)
}

/** Records that this doctor opened the case, at most once per 30 minutes per browser tab session. */
export async function logView(caseId: string): Promise<void> {
  const key = `cliniq:viewed:${caseId}`
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0)
    if (Date.now() - last < 30 * 60_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch { /* storage unavailable: log anyway */ }
  const { error } = await db().rpc('log_case_view', { _case_id: caseId })
  fail(error)
}

// ───────── Notes
export async function listNotes(caseId: string): Promise<NoteRow[]> {
  const { data, error } = await db().from('case_notes').select('*').eq('case_id', caseId).order('created_at', { ascending: true })
  fail(error)
  return data ?? []
}
export async function addNote(caseId: string, authorId: string, kind: NoteRow['kind'], body: string, checklist?: Json): Promise<NoteRow> {
  const { data, error } = await db().from('case_notes').insert({ case_id: caseId, author_id: authorId, kind, body, checklist: checklist ?? null }).select('*').single()
  fail(error)
  return data
}
export async function updateNote(id: string, patch: { body?: string; checklist?: Json }): Promise<void> {
  const { error } = await db().from('case_notes').update(patch).eq('id', id)
  fail(error)
}
export async function deleteNote(id: string): Promise<void> {
  const { error } = await db().from('case_notes').delete().eq('id', id)
  fail(error)
}
