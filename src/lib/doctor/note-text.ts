import { SPECIALTIES, TRIAGE_LABEL } from '../clinical/constants'
import type { ClinicalExtraction } from '../clinical/schemas'

export interface PatientFacts {
  name: string | null
  age: number | null
  sex: string | null
  bloodGroup: string | null
  allergies: string[]
  conditions: string[]
  medications: string[]
  emergencyContact: string | null
}

const dash = (s: string | null | undefined) => (s && s.trim() ? s.trim() : 'Not stated')
const items = (xs: string[]) => (xs.length ? xs.join('; ') : 'None reported')
const unique = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]
const spec = (slug: string) => SPECIALTIES.find((s) => s.slug === slug)?.label ?? slug

function symptomLine(s: ClinicalExtraction['symptoms'][number]): string {
  const bits = [s.bodyRegion, s.severity ? `severity ${s.severity}/10` : null, s.duration ? `for ${s.duration}` : s.onset ? `since ${s.onset}` : null,
    s.progression !== 'unknown' ? s.progression : null, s.notes].filter(Boolean)
  return bits.length ? `${s.name} (${bits.join(', ')})` : s.name
}

/** Medicines and allergies from the confirmed summary plus the saved profile, without duplicates. */
export function mergedBackground(ex: ClinicalExtraction, p: PatientFacts) {
  return {
    allergies: unique([...ex.allergies, ...p.allergies]),
    medications: unique([...ex.medications, ...p.medications]),
    history: unique([...ex.pastMedicalHistory, ...p.conditions]),
  }
}

export interface Soap { s: string; o: string; a: string; p: string }

/**
 * Pre-visit SOAP draft built only from what the patient reported. Objective,
 * Assessment and Plan are left for the clinician: nothing here diagnoses or treats.
 */
export function generateSoap(ex: ClinicalExtraction, p: PatientFacts): Soap {
  const bg = mergedBackground(ex, p)
  const s = [
    `Chief complaint: ${ex.chiefComplaint}${ex.onset ? ` (onset: ${ex.onset})` : ''}`,
    `HPI: ${ex.hpi}`,
    ex.symptoms.length ? `Symptoms: ${ex.symptoms.map(symptomLine).join('; ')}` : null,
    `Pertinent positives: ${items(ex.pertinentPositives)}`,
    `Pertinent negatives: ${items(ex.pertinentNegatives)}`,
    `Past medical history: ${items(bg.history)}`,
    `Medications: ${items(bg.medications)}`,
    `Allergies: ${items(bg.allergies)}`,
    'Source: patient-reported before the visit, structured with AI and confirmed by the patient.',
  ].filter(Boolean).join('\n')
  const o = 'Not yet assessed. Vitals and examination to be recorded at the visit.\nVitals: BP ___  HR ___  Temp ___  RR ___  SpO2 ___\nExam: ___'
  const a = `Pre-visit urgency (rule-based, not a diagnosis): ${TRIAGE_LABEL[ex.triage.level]}. ${ex.triage.rationale}\nClinician assessment: ___`
  const plan = 'Plan: ___'
  return { s, o, a, p: plan }
}

export const soapToText = (x: Soap) => `S:\n${x.s}\n\nO:\n${x.o}\n\nA:\n${x.a}\n\nP:\n${x.p}`

/** Reads back text written by soapToText, tolerating edits. Returns null if the headings are gone. */
export function parseSoapText(text: string): Soap | null {
  const m = text.match(/^S:\n([\s\S]*?)\n\nO:\n([\s\S]*?)\n\nA:\n([\s\S]*?)\n\nP:\n([\s\S]*)$/)
  return m ? { s: m[1] ?? '', o: m[2] ?? '', a: m[3] ?? '', p: m[4] ?? '' } : null
}

export type EhrStyle = 'sectioned' | 'compact'

/** Plain text for pasting into an EHR note field (Epic, Cerner, Athena and similar). */
export function ehrNote(style: EhrStyle, ex: ClinicalExtraction, p: PatientFacts, opts: { soap?: Soap | null; when: string; clinic?: string | null }): string {
  const bg = mergedBackground(ex, p)
  const head = `Pre-visit patient intake (patient-reported, AI-structured, patient-confirmed ${opts.when})${opts.clinic ? ` - ${opts.clinic}` : ''}`
  const who = `${dash(p.name)}, ${p.age ?? '?'} y, ${dash(p.sex)}${p.bloodGroup ? `, blood group ${p.bloodGroup}` : ''}`
  const urgency = `Pre-visit urgency (rule-based): ${TRIAGE_LABEL[ex.triage.level]}${ex.redFlags.length ? `; red flags: ${ex.redFlags.map((f) => f.label).join(', ')}` : ''}`

  if (style === 'compact') {
    const lines = [
      head, who,
      `CC: ${ex.chiefComplaint}. ${ex.onset ? `Onset ${ex.onset}. ` : ''}${ex.hpi}`,
      ex.symptoms.length ? `Sx: ${ex.symptoms.map(symptomLine).join('; ')}` : null,
      `Pos: ${items(ex.pertinentPositives)} | Neg: ${items(ex.pertinentNegatives)}`,
      `PMH: ${items(bg.history)} | Meds: ${items(bg.medications)} | All: ${items(bg.allergies)}`,
      urgency,
      opts.soap ? `\n${soapToText(opts.soap)}` : null,
    ]
    return lines.filter(Boolean).join('\n')
  }

  const lines = [
    head, '', `PATIENT: ${who}`, '',
    `CHIEF COMPLAINT:\n${ex.chiefComplaint}${ex.onset ? ` (onset: ${ex.onset})` : ''}`, '',
    `HISTORY OF PRESENT ILLNESS:\n${ex.hpi}`, '',
    ex.symptoms.length ? `SYMPTOMS:\n${ex.symptoms.map((s) => `- ${symptomLine(s)}`).join('\n')}\n` : null,
    `REVIEW OF SYSTEMS (patient-reported):\nPertinent positives: ${items(ex.pertinentPositives)}\nPertinent negatives: ${items(ex.pertinentNegatives)}`, '',
    `PAST MEDICAL HISTORY:\n${items(bg.history)}`, '',
    `MEDICATIONS:\n${items(bg.medications)}`, '',
    `ALLERGIES:\n${items(bg.allergies)}`, '',
    ex.timeline.length ? `TIMELINE:\n${ex.timeline.map((t) => `- ${t.when}: ${t.event}`).join('\n')}\n` : null,
    `TRIAGE:\n${urgency}\nSuggested specialty: ${spec(ex.triage.suggestedSpecialty)}`,
    p.emergencyContact ? `\nEMERGENCY CONTACT: ${p.emergencyContact}` : null,
    opts.soap ? `\n${soapToText(opts.soap)}` : null,
  ]
  return lines.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
