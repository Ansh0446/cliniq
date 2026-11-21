import type { ClinicalExtraction } from './clinical/schemas'
import type { Json, Tables } from './database.types'
import type { CaseRow } from './intake'
import { getBrowserSupabase } from './supabase'

const db = () => getBrowserSupabase()

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export async function currentUserId(): Promise<string> {
  const { data } = await db().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Please sign in again.')
  return id
}

// ───────── Profile
export type ProfileRow = Tables<'profiles'>
export type ProfileInput = Pick<ProfileRow,
  'full_name' | 'dob' | 'sex' | 'blood_group' | 'emergency_contact_name' | 'emergency_contact_phone' |
  'allergies' | 'chronic_conditions' | 'medications'>

export async function getProfile(): Promise<ProfileRow | null> {
  const id = await currentUserId()
  const { data, error } = await db().from('profiles').select('*').eq('id', id).maybeSingle()
  fail(error)
  return data
}

export async function saveProfile(values: ProfileInput): Promise<void> {
  const id = await currentUserId()
  const { error } = await db().from('profiles').update(values).eq('id', id)
  fail(error)
}

// ───────── Cases
export type CaseListItem = Pick<CaseRow,
  'id' | 'status' | 'triage_level' | 'chief_complaint' | 'created_at' | 'updated_at' | 'sent_at' | 'ai_extraction' | 'clinic_id'>

export async function listCases(): Promise<CaseListItem[]> {
  const { data, error } = await db()
    .from('cases')
    .select('id,status,triage_level,chief_complaint,created_at,updated_at,sent_at,ai_extraction,clinic_id')
    .order('updated_at', { ascending: false })
    .limit(100)
  fail(error)
  return data ?? []
}

export async function getCase(id: string): Promise<CaseRow> {
  const { data, error } = await db().from('cases').select('*').eq('id', id).maybeSingle()
  fail(error)
  if (!data) throw new Error('This case was not found.')
  return data
}

export async function createDraft(transcript: string, source: 'text' | 'voice'): Promise<CaseRow> {
  const patient_id = await currentUserId()
  const { data, error } = await db()
    .from('cases')
    .insert({ patient_id, raw_transcript: transcript, transcript_source: source })
    .select('*')
    .single()
  fail(error)
  return data
}

export async function saveTranscript(id: string, transcript: string, source: 'text' | 'voice'): Promise<void> {
  const { error } = await db().from('cases').update({ raw_transcript: transcript, transcript_source: source }).eq('id', id)
  fail(error)
}

function extractionColumns(ex: ClinicalExtraction) {
  return {
    structured: ex as unknown as Json,
    chief_complaint: ex.chiefComplaint,
    specialty_hint: ex.triage.suggestedSpecialty,
    triage_level: ex.triage.level,
    red_flags: ex.redFlags.map((f) => f.label),
  }
}

/** Stores the untouched AI output plus an editable copy for the patient to review. */
export async function saveStructuringResult(
  id: string, transcript: string, source: 'text' | 'voice', ex: ClinicalExtraction, acknowledgedAt: string | null, signature: string,
): Promise<void> {
  const { error } = await db()
    .from('cases')
    .update({
      raw_transcript: transcript,
      transcript_source: source,
      ai_extraction: ex as unknown as Json,
      ai_signature: signature,
      emergency_acknowledged_at: acknowledgedAt,
      ...extractionColumns(ex),
    })
    .eq('id', id)
  fail(error)
}

export async function acknowledgeEmergency(id: string): Promise<string> {
  const at = new Date().toISOString()
  const { error } = await db().from('cases').update({ emergency_acknowledged_at: at }).eq('id', id)
  fail(error)
  return at
}

export async function saveReview(id: string, ex: ClinicalExtraction): Promise<void> {
  const { error } = await db().from('cases').update(extractionColumns(ex)).eq('id', id)
  fail(error)
}

export async function confirmCase(id: string, ex: ClinicalExtraction, acknowledgedAt: string | null): Promise<void> {
  const { error } = await db()
    .from('cases')
    .update({
      ...extractionColumns(ex),
      ...(acknowledgedAt ? { emergency_acknowledged_at: acknowledgedAt } : {}),
      status: 'confirmed',
    })
    .eq('id', id)
  fail(error)
}

/** After a clinic asked for more information: save the additions and send the case back. */
export async function resendCase(id: string, ex: ClinicalExtraction): Promise<void> {
  const { error } = await db().from('cases').update({ ...extractionColumns(ex), status: 'sent' }).eq('id', id)
  fail(error)
}

export async function reopenCase(id: string): Promise<void> {
  const { error } = await db().from('cases').update({ status: 'draft' }).eq('id', id)
  fail(error)
}

export async function sendCase(id: string, clinicId: string): Promise<void> {
  const { error } = await db().from('cases').update({ clinic_id: clinicId, status: 'sent' }).eq('id', id)
  fail(error)
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await db().from('cases').delete().eq('id', id)
  fail(error)
}

// ───────── Clinics and activity
export type ClinicRow = Pick<Tables<'clinics'>, 'id' | 'name' | 'specialties' | 'address' | 'phone' | 'lat' | 'lng'>

export async function listClinics(): Promise<ClinicRow[]> {
  const { data, error } = await db()
    .from('clinics')
    .select('id,name,specialties,address,phone,lat,lng')
    .eq('verified', true)
    .eq('accepting_intakes', true)
    .order('name')
  fail(error)
  return data ?? []
}

export async function getClinic(id: string): Promise<ClinicRow | null> {
  const { data, error } = await db().from('clinics').select('id,name,specialties,address,phone,lat,lng').eq('id', id).maybeSingle()
  fail(error)
  return data
}

export type AuditRow = Pick<Tables<'audit_log'>, 'id' | 'action' | 'from_value' | 'to_value' | 'created_at' | 'actor_id'>

export async function listActivity(caseId: string): Promise<AuditRow[]> {
  const { data, error } = await db()
    .from('audit_log')
    .select('id,action,from_value,to_value,created_at,actor_id')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(100)
  fail(error)
  return data ?? []
}

/** Live changes to the signed-in patient's cases. RLS limits what is delivered. Returns an unsubscribe. */
export function subscribeToCases(onChange: () => void, caseId?: string): () => void {
  const supabase = db()
  const name = `cases-${caseId ?? 'all'}-${Math.random().toString(36).slice(2, 8)}`
  const channel = supabase
    .channel(name)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cases', ...(caseId ? { filter: `id=eq.${caseId}` } : {}) },
      onChange,
    )
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

// ───────── Account: export and deletion
/** Everything ClinIQ holds for this patient, as one JSON-friendly object. */
export async function exportMyData(): Promise<unknown> {
  const id = await currentUserId()
  const [profile, cases] = await Promise.all([
    db().from('profiles').select('*').eq('id', id).maybeSingle(),
    db().from('cases').select('*').order('created_at'),
  ])
  fail(profile.error); fail(cases.error)
  const ids = (cases.data ?? []).map((c) => c.id)
  const audit = ids.length ? await db().from('audit_log').select('case_id,action,from_value,to_value,created_at').in('case_id', ids).order('created_at') : { data: [], error: null }
  fail(audit.error)
  return {
    exportedAt: new Date().toISOString(),
    note: 'Everything ClinIQ stores about you. ai_signature is an internal integrity code.',
    profile: profile.data,
    cases: cases.data,
    activity: audit.data,
  }
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await db().rpc('delete_my_account')
  fail(error)
  await db().auth.signOut({ scope: 'local' })
}
