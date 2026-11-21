import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffExtractions, effectiveTriage } from './triage'
import { ehrNote, generateSoap, parseSoapText, soapToText, type PatientFacts } from './note-text'
import { toFhirDraft } from './fhir'
import { DEFAULT_FILTERS, defaultChecklist, filterInbox, parseChecklist, sortInbox, waitingLabel, type InboxItem } from './inbox'
import type { ClinicalExtraction } from '../clinical/schemas'

const ex: ClinicalExtraction = {
  schemaVersion: 1, chiefComplaint: 'Cough and fever', onset: '4 days ago', hpi: 'Dry cough for four days with fever at night.',
  symptoms: [{ name: 'Cough', bodyRegion: 'Chest', severity: 4, onset: null, duration: '4 days', progression: 'stable', notes: null }],
  pertinentPositives: ['Night sweats'], pertinentNegatives: ['No chest pain'], timeline: [{ when: 'Day 2', event: 'Fever 38.9 C' }],
  pastMedicalHistory: ['Asthma'], medications: ['Salbutamol'], allergies: ['Penicillin'], redFlags: [],
  triage: { level: 'soon', rationale: 'Fever for several days.', suggestedSpecialty: 'general_practice' }, missingInformation: ['Any recent travel?'],
}
const patient: PatientFacts = { name: 'A Patient', age: 29, sex: 'female', bloodGroup: 'O+', allergies: ['Penicillin', 'Peanuts'], conditions: ['Asthma'], medications: [], emergencyContact: 'B, 99999 11111' }

test('a patient lowering their stored urgency cannot hide a case', () => {
  const r = effectiveTriage({ stored: 'routine', ai: ex, confirmed: { ...ex, triage: { ...ex.triage, level: 'routine' } }, redFlagLabels: [] })
  assert.equal(r.level, 'soon')
  assert.equal(r.lowered, true)
})

test('any red flag forces urgent even if everything else says routine', () => {
  const routine = { ...ex, triage: { ...ex.triage, level: 'routine' as const } }
  const r = effectiveTriage({ stored: 'routine', ai: routine, confirmed: routine, redFlagLabels: ['Chest pain or pressure'] })
  assert.equal(r.level, 'urgent')
  assert.equal(r.lowered, true)
})

test('no information defaults to routine, not to a crash', () => {
  assert.equal(effectiveTriage({ stored: null, ai: null, confirmed: null, redFlagLabels: [] }).level, 'routine')
})

test('diff lists only what the patient changed', () => {
  assert.deepEqual(diffExtractions(ex, ex), [])
  const changed = { ...ex, hpi: 'Cough for two days.', medications: [] }
  const d = diffExtractions(ex, changed)
  assert.deepEqual(d.map((x) => x.field), ['History of present illness', 'Medications'])
  assert.equal(diffExtractions(null, ex).length, 0)
})

test('SOAP draft leaves objective, assessment and plan to the clinician and never diagnoses', () => {
  const soap = generateSoap(ex, patient)
  assert.match(soap.s, /Chief complaint: Cough and fever/)
  assert.match(soap.s, /Allergies: Penicillin; Peanuts/) // merged without duplicates
  assert.match(soap.o, /Not yet assessed/)
  assert.match(soap.a, /not a diagnosis/)
  assert.match(soap.p, /___/)
  const round = parseSoapText(soapToText(soap))
  assert.deepEqual(round, soap)
  assert.equal(parseSoapText('free text'), null)
})

test('EHR notes come in two styles and carry the key sections', () => {
  const full = ehrNote('sectioned', ex, patient, { when: '1 Oct', clinic: 'Test Clinic' })
  for (const h of ['CHIEF COMPLAINT:', 'HISTORY OF PRESENT ILLNESS:', 'MEDICATIONS:', 'ALLERGIES:', 'TRIAGE:']) assert.match(full, new RegExp(h))
  assert.match(full, /Test Clinic/)
  const compact = ehrNote('compact', ex, patient, { when: '1 Oct', soap: generateSoap(ex, patient) })
  assert.match(compact, /^CC: |\nCC: /m)
  assert.match(compact, /S:\n/)
  assert.ok(compact.length < full.length + 600)
})

test('FHIR draft is a collection bundle of patient-reported, unconfirmed resources', () => {
  const b = toFhirDraft({ caseId: 'c1', patientId: 'p1', confirmedAt: '2026-10-01T10:00:00Z', ex, patient, clinicName: 'Test Clinic' }) as { resourceType: string; type: string; entry: { resource: Record<string, unknown> }[] }
  assert.equal(b.resourceType, 'Bundle')
  assert.equal(b.type, 'collection')
  const types = b.entry.map((e) => e.resource.resourceType)
  for (const t of ['Patient', 'Encounter', 'Condition', 'AllergyIntolerance', 'MedicationStatement', 'Composition']) assert.ok(types.includes(t), t)
  const symptom = b.entry.find((e) => e.resource.id === 'symptom-1')!.resource as { verificationStatus: { coding: { code: string }[] } }
  assert.equal(symptom.verificationStatus.coding[0]?.code, 'unconfirmed')
  assert.equal(types.filter((t) => t === 'AllergyIntolerance').length, 2)
  assert.ok(!JSON.stringify(b).toLowerCase().includes('diagnosis'))
})

const item = (o: Partial<InboxItem>): InboxItem => ({ id: 'x', clinic_id: 'c', status: 'sent', effective_triage: 'routine', triage_rank: 2, has_red_flags: false, chief_complaint: 'Cough', specialty_hint: 'general_practice', assigned_doctor_id: null, reviewed_at: null, sent_at: '2026-10-01T10:00:00Z', symptom_onset: null, patient_age: 30, patient_sex: 'male', patient_name: 'Sam', ...o })

test('inbox pins red flags, then urgency, then longest waiting', () => {
  const sorted = sortInbox([
    item({ id: 'routine-old', sent_at: '2026-09-30T08:00:00Z' }),
    item({ id: 'soon', effective_triage: 'soon', triage_rank: 1 }),
    item({ id: 'urgent-flag', effective_triage: 'urgent', triage_rank: 0, has_red_flags: true, sent_at: '2026-10-01T12:00:00Z' }),
    item({ id: 'urgent-older', effective_triage: 'urgent', triage_rank: 0, sent_at: '2026-10-01T09:00:00Z' }),
  ])
  assert.deepEqual(sorted.map((i) => i.id), ['urgent-flag', 'urgent-older', 'soon', 'routine-old'])
})

test('inbox filters by triage, assignment, specialty, completed and search', () => {
  const all = [
    item({ id: 'a', effective_triage: 'urgent', assigned_doctor_id: 'me' }),
    item({ id: 'b', specialty_hint: 'cardiology', reviewed_at: '2026-10-01T11:00:00Z' }),
    item({ id: 'c', status: 'consultation_ready' }),
    item({ id: 'd', patient_name: 'Priya', chief_complaint: 'Rash' }),
  ]
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => filterInbox(all, { ...DEFAULT_FILTERS, ...f }, 'me').map((i) => i.id)
  assert.deepEqual(ids({}), ['a', 'b', 'd'])
  assert.deepEqual(ids({ showDone: true }), ['a', 'b', 'c', 'd'])
  assert.deepEqual(ids({ triage: 'urgent' }), ['a'])
  assert.deepEqual(ids({ assignment: 'mine' }), ['a'])
  assert.deepEqual(ids({ assignment: 'unassigned' }), ['b', 'd'])
  assert.deepEqual(ids({ assignment: 'reviewed' }), ['b'])
  assert.deepEqual(ids({ specialty: 'cardiology' }), ['b'])
  assert.deepEqual(ids({ search: 'priya' }), ['d'])
})

test('waiting label and checklist helpers', () => {
  const now = Date.parse('2026-10-01T12:00:00Z')
  assert.equal(waitingLabel('2026-10-01T11:30:00Z', now), '30 min')
  assert.equal(waitingLabel('2026-10-01T06:00:00Z', now), '6 h')
  assert.equal(waitingLabel(null, now), '-')
  const list = defaultChecklist(['Any recent travel?'])
  assert.equal(list.at(-1)?.text, 'Ask: Any recent travel?')
  assert.deepEqual(parseChecklist([{ text: 'x', done: 1 }, 5, { nope: true }]), [{ text: 'x', done: true }])
  assert.deepEqual(parseChecklist('bad'), [])
})

test('an unverifiable AI assessment never lets a case look routine', () => {
  const routine = { ...ex, triage: { ...ex.triage, level: 'routine' as const } }
  const base = { stored: 'routine' as const, ai: routine, confirmed: routine, redFlagLabels: [] }
  assert.equal(effectiveTriage({ ...base, aiTrust: 'valid' }).level, 'routine')
  assert.equal(effectiveTriage({ ...base, aiTrust: 'unknown' }).level, 'routine')
  for (const t of ['missing', 'invalid'] as const) {
    const r = effectiveTriage({ ...base, aiTrust: t })
    assert.equal(r.level, 'soon')
    assert.ok(r.reasons.some((x) => /could not be verified/.test(x)))
  }
})
