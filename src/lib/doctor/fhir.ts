import type { ClinicalExtraction } from '../clinical/schemas'
import { mergedBackground, type PatientFacts } from './note-text'

type Json = Record<string, unknown>

/**
 * FHIR R4 draft Bundle (type "collection") of patient-reported information.
 * Everything is free text: no SNOMED, LOINC or RxNorm coding, and nothing is
 * a diagnosis. It has not been run through a FHIR validator, so treat it as a
 * starting point for integration work, not a conformant exchange document.
 */
export function toFhirDraft(input: { caseId: string; confirmedAt: string; ex: ClinicalExtraction; patient: PatientFacts; patientId: string; clinicName?: string | null }): Json {
  const { caseId, confirmedAt, ex, patient, patientId } = input
  const bg = mergedBackground(ex, patient)
  const pid = `patient-${patientId}`
  const subject = { reference: `Patient/${pid}` }
  const sex = patient.sex === 'female' || patient.sex === 'male' || patient.sex === 'other' ? patient.sex : 'unknown'

  const entries: { resource: Json }[] = []
  const push = (resource: Json) => entries.push({ resource })

  push({
    resourceType: 'Patient', id: pid,
    ...(patient.name ? { name: [{ text: patient.name }] } : {}),
    gender: sex,
    ...(patient.age !== null ? { extension: [{ url: 'urn:cliniq:age-years', valueInteger: patient.age }] } : {}),
  })
  push({
    resourceType: 'Encounter', id: `encounter-${caseId}`, status: 'planned',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject,
    reasonCode: [{ text: ex.chiefComplaint }],
    ...(input.clinicName ? { serviceProvider: { display: input.clinicName } } : {}),
  })
  ex.symptoms.forEach((s, i) => push({
    resourceType: 'Condition', id: `symptom-${i + 1}`,
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: { text: s.name },
    subject,
    ...(s.bodyRegion ? { bodySite: [{ text: s.bodyRegion }] } : {}),
    ...(s.onset ? { onsetString: s.onset } : {}),
    note: [{ text: [s.severity ? `Patient-rated severity ${s.severity}/10` : null, s.duration ? `Duration ${s.duration}` : null, s.progression !== 'unknown' ? `Trend ${s.progression}` : null, s.notes].filter(Boolean).join('. ') || 'Patient-reported symptom' }],
  }))
  bg.allergies.forEach((a, i) => push({
    resourceType: 'AllergyIntolerance', id: `allergy-${i + 1}`,
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'unconfirmed' }] },
    code: { text: a }, patient: subject,
  }))
  bg.medications.forEach((m, i) => push({
    resourceType: 'MedicationStatement', id: `medication-${i + 1}`, status: 'unknown',
    medicationCodeableConcept: { text: m }, subject,
    informationSource: subject,
  }))
  bg.history.forEach((h, i) => push({
    resourceType: 'Condition', id: `history-${i + 1}`,
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: { text: h }, subject,
    note: [{ text: 'Patient-reported history' }],
  }))
  push({
    resourceType: 'Composition', id: `intake-${caseId}`, status: 'preliminary',
    type: { text: 'Patient-reported pre-visit intake' }, subject, date: confirmedAt,
    author: [{ display: 'Patient (structured by ClinIQ)' }],
    title: 'Pre-visit intake',
    section: [
      { title: 'Chief complaint', text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${esc(ex.chiefComplaint)}</div>` } },
      { title: 'History of present illness', text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${esc(ex.hpi)}</div>` } },
    ],
  })

  return {
    resourceType: 'Bundle', type: 'collection',
    meta: { tag: [{ system: 'urn:cliniq', code: 'draft', display: 'Draft: not validated, patient-reported' }] },
    timestamp: confirmedAt,
    entry: entries,
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
