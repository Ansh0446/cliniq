import { mostUrgent } from './clinical/merge'
import { scanForRedFlags } from './clinical/redflags'
import {
  clinicalExtractionSchema,
  type ClinicalExtraction,
  type ProfileSnapshot,
  type RedFlag,
} from './clinical/schemas'
import type { Tables } from './database.types'

export type CaseRow = Tables<'cases'>
export type ProfileRow = Tables<'profiles'>

export function ageFromDob(dob: string | null | undefined, now = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const beforeBirthday =
    now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (beforeBirthday) age -= 1
  return age >= 0 && age <= 130 ? age : null
}

export function profileToSnapshot(p: ProfileRow | null): ProfileSnapshot {
  const sex = p?.sex
  return {
    allergies: p?.allergies ?? [],
    medications: p?.medications ?? [],
    chronicConditions: p?.chronic_conditions ?? [],
    age: ageFromDob(p?.dob),
    sex: sex === 'female' || sex === 'male' || sex === 'other' || sex === 'unspecified' ? sex : null,
  }
}

export function parseStructured(json: unknown): ClinicalExtraction | null {
  if (json == null) return null
  const parsed = clinicalExtractionSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/**
 * Text the patient can change during review that should be re-checked for red
 * flags. Negatives, history and medications are left out on purpose: "denies
 * chest pain" and "history of chest pain in 2019" must not raise an alarm.
 */
export function reviewScanText(ex: ClinicalExtraction): string {
  return [
    ex.chiefComplaint,
    ex.hpi,
    ...ex.symptoms.flatMap((s) => [s.name, s.notes ?? '']),
    ...ex.pertinentPositives,
    ...ex.timeline.map((t) => t.event),
  ]
    .filter(Boolean)
    .join('. ')
}

export interface RescanResult {
  extraction: ClinicalExtraction
  /** Flags that were not present before this edit. Non-empty means show the emergency modal. */
  added: RedFlag[]
}

/** Re-runs the deterministic rules after edits. Only ever raises urgency. */
export function rescanExtraction(ex: ClinicalExtraction): RescanResult {
  const scan = scanForRedFlags(reviewScanText(ex))
  const known = new Set(ex.redFlags.map((f) => f.label.toLowerCase()))
  const added = scan.flags.filter((f) => !known.has(f.label.toLowerCase()))
  if (added.length === 0) return { extraction: ex, added }
  return {
    extraction: {
      ...ex,
      redFlags: [...ex.redFlags, ...added],
      triage: {
        ...ex.triage,
        level: mostUrgent(ex.triage.level, 'urgent'),
        rationale: `Urgent because the summary now matches a red-flag rule (${added.map((f) => f.label).join(', ')}). ${ex.triage.rationale}`.slice(0, 400),
      },
    },
    added,
  }
}

export type IntakeStep = 'describe' | 'review' | 'send' | 'detail'

/** Where "Resume" should take the patient. */
export function resumeStep(c: Pick<CaseRow, 'status' | 'ai_extraction'>): IntakeStep {
  if (c.status === 'draft') return c.ai_extraction ? 'review' : 'describe'
  if (c.status === 'confirmed') return 'send'
  if (c.status === 'info_requested') return 'detail'
  return 'detail'
}

export function casePath(id: string, step: IntakeStep): string {
  switch (step) {
    case 'describe': return `/app/intake/${id}`
    case 'review': return `/app/cases/${id}/review`
    case 'send': return `/app/cases/${id}/send`
    default: return `/app/cases/${id}`
  }
}

export function splitList(text: string): string[] {
  return [...new Set(text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))]
}

/** Plain-language problems that stop a summary from being confirmed. Empty means it is valid. */
export function validateForConfirm(ex: ClinicalExtraction): string[] {
  const problems: string[] = []
  if (!ex.chiefComplaint.trim()) problems.push('Describe the main problem in a few words.')
  if (!ex.hpi.trim()) problems.push('Add a short description under "What happened".')
  ex.symptoms.forEach((s, i) => { if (!s.name.trim()) problems.push(`Symptom ${i + 1} needs a name, or remove it.`) })
  ex.timeline.forEach((t, i) => { if (!t.when.trim() || !t.event.trim()) problems.push(`Timeline entry ${i + 1} needs both a time and what happened, or remove it.`) })
  if (problems.length === 0) {
    const parsed = clinicalExtractionSchema.safeParse(ex)
    if (!parsed.success) problems.push('Some text is too long. Shorten it and try again.')
  }
  return problems
}
