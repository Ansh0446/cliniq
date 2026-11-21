import { TRIAGE_RANK, type TriageLevel } from '../clinical/constants'
import type { ClinicalExtraction } from '../clinical/schemas'

/**
 * Urgency a clinician should trust. It is the most urgent of the stored value,
 * the untouched AI assessment, and the patient-confirmed summary, and any red
 * flag forces "urgent". A patient can edit their own row, so a lowered stored
 * value alone must never hide a case.
 */
export function effectiveTriage(input: {
  stored: TriageLevel | null
  ai: ClinicalExtraction | null
  confirmed: ClinicalExtraction | null
  redFlagLabels: string[]
  /** Result of checking the AI output's server signature. 'unknown' while the check is still running. */
  aiTrust?: 'valid' | 'missing' | 'invalid' | 'unknown'
}): { level: TriageLevel; lowered: boolean; reasons: string[] } {
  const candidates: TriageLevel[] = []
  if (input.stored) candidates.push(input.stored)
  if (input.ai) candidates.push(input.ai.triage.level)
  if (input.confirmed) candidates.push(input.confirmed.triage.level)
  const flagged = input.redFlagLabels.length > 0 || (input.ai?.redFlags.length ?? 0) > 0 || (input.confirmed?.redFlags.length ?? 0) > 0
  if (flagged) candidates.push('urgent')
  // If the original AI assessment cannot be verified, do not let the case look routine.
  const unverified = input.aiTrust === 'missing' || input.aiTrust === 'invalid'
  if (unverified) candidates.push('soon')
  const level = candidates.reduce<TriageLevel>((a, b) => (TRIAGE_RANK[b] < TRIAGE_RANK[a] ? b : a), 'routine')
  const lowered = input.stored !== null && TRIAGE_RANK[input.stored] > TRIAGE_RANK[level]
  const reasons: string[] = []
  if (flagged) reasons.push('Red-flag phrases were detected')
  if (input.ai && input.ai.triage.level !== 'routine') reasons.push(`AI assessment: ${input.ai.triage.level}`)
  if (unverified) reasons.push('Original AI assessment could not be verified')
  return { level, lowered, reasons }
}

/** Fields the patient changed between the untouched AI output and what they confirmed. */
export interface FieldChange { field: string; before: string; after: string }

const list = (xs: string[]) => (xs.length ? xs.join('; ') : '(none)')

export function diffExtractions(ai: ClinicalExtraction | null, confirmed: ClinicalExtraction | null): FieldChange[] {
  if (!ai || !confirmed) return []
  const out: FieldChange[] = []
  const add = (field: string, before: string, after: string) => { if (before !== after) out.push({ field, before: before || '(blank)', after: after || '(blank)' }) }
  add('Main problem', ai.chiefComplaint, confirmed.chiefComplaint)
  add('Onset', ai.onset ?? '', confirmed.onset ?? '')
  add('History of present illness', ai.hpi, confirmed.hpi)
  add('Symptoms', ai.symptoms.map((s) => `${s.name} ${s.severity ?? '?'}/10 ${s.duration ?? ''}`.trim()).join('; ') || '(none)',
    confirmed.symptoms.map((s) => `${s.name} ${s.severity ?? '?'}/10 ${s.duration ?? ''}`.trim()).join('; ') || '(none)')
  add('Also has', list(ai.pertinentPositives), list(confirmed.pertinentPositives))
  add('Does not have', list(ai.pertinentNegatives), list(confirmed.pertinentNegatives))
  add('Past medical history', list(ai.pastMedicalHistory), list(confirmed.pastMedicalHistory))
  add('Medications', list(ai.medications), list(confirmed.medications))
  add('Allergies', list(ai.allergies), list(confirmed.allergies))
  add('Specialty', ai.triage.suggestedSpecialty, confirmed.triage.suggestedSpecialty)
  add('Urgency', ai.triage.level, confirmed.triage.level)
  add('Red flags', list(ai.redFlags.map((f) => f.label)), list(confirmed.redFlags.map((f) => f.label)))
  return out
}
