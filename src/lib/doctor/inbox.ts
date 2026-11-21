import type { CaseStatus, TriageLevel } from '../clinical/constants'

export interface InboxItem {
  id: string
  clinic_id: string | null
  status: CaseStatus | null
  effective_triage: TriageLevel | null
  triage_rank: number | null
  has_red_flags: boolean | null
  chief_complaint: string | null
  specialty_hint: string | null
  assigned_doctor_id: string | null
  reviewed_at: string | null
  sent_at: string | null
  symptom_onset: string | null
  patient_age: number | null
  patient_sex: string | null
  patient_name: string | null
}

export type AssignmentFilter = 'all' | 'unassigned' | 'mine' | 'reviewed'

export interface InboxFilters {
  triage: TriageLevel | 'all'
  specialty: string // slug or 'all'
  assignment: AssignmentFilter
  clinicId: string // id or 'all'
  showDone: boolean // include consultation_ready
  search: string
}

export const DEFAULT_FILTERS: InboxFilters = { triage: 'all', specialty: 'all', assignment: 'all', clinicId: 'all', showDone: false, search: '' }

export function filterInbox(items: InboxItem[], f: InboxFilters, me: string): InboxItem[] {
  const q = f.search.trim().toLowerCase()
  return items.filter((i) => {
    if (!f.showDone && i.status === 'consultation_ready') return false
    if (f.triage !== 'all' && i.effective_triage !== f.triage) return false
    if (f.specialty !== 'all' && i.specialty_hint !== f.specialty) return false
    if (f.clinicId !== 'all' && i.clinic_id !== f.clinicId) return false
    if (f.assignment === 'unassigned' && i.assigned_doctor_id) return false
    if (f.assignment === 'mine' && i.assigned_doctor_id !== me) return false
    if (f.assignment === 'reviewed' && !i.reviewed_at) return false
    if (q && !`${i.patient_name ?? ''} ${i.chief_complaint ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
}

/** Red flags pinned first, then urgency, then longest-waiting first. */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  const waiting = (i: InboxItem) => (i.sent_at ? Date.parse(i.sent_at) : Number.MAX_SAFE_INTEGER)
  return [...items].sort((a, b) =>
    Number(Boolean(b.has_red_flags)) - Number(Boolean(a.has_red_flags)) ||
    (a.triage_rank ?? 2) - (b.triage_rank ?? 2) ||
    waiting(a) - waiting(b))
}

export function waitingLabel(sentAt: string | null, now = Date.now()): string {
  if (!sentAt) return '-'
  const mins = Math.max(0, Math.round((now - Date.parse(sentAt)) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  const h = Math.round(mins / 60)
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}

export interface ChecklistItem { text: string; done: boolean }

export function defaultChecklist(missing: string[]): ChecklistItem[] {
  return [
    { text: 'Confirm patient identity', done: false },
    { text: 'Record vitals', done: false },
    { text: 'Confirm allergies and current medicines with the patient', done: false },
    ...missing.slice(0, 6).map((m) => ({ text: `Ask: ${m}`, done: false })),
  ]
}

export function parseChecklist(json: unknown): ChecklistItem[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((x) => (x && typeof x === 'object' && typeof (x as ChecklistItem).text === 'string'
    ? [{ text: (x as ChecklistItem).text.slice(0, 200), done: Boolean((x as ChecklistItem).done) }] : []))
}
