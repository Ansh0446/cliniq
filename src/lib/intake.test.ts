import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageFromDob, profileToSnapshot, rescanExtraction, resumeStep, splitList, validateForConfirm, casePath, reviewScanText } from './intake'
import type { ClinicalExtraction } from './clinical/schemas'

const base: ClinicalExtraction = {
  schemaVersion: 1, chiefComplaint: 'Cough', onset: '4 days ago', hpi: 'Dry cough for four days, worse at night.',
  symptoms: [{ name: 'Cough', bodyRegion: 'Chest', severity: 4, onset: null, duration: '4 days', progression: 'stable', notes: null }],
  pertinentPositives: ['Mild fever'], pertinentNegatives: ['No chest pain', 'No shortness of breath'], timeline: [],
  pastMedicalHistory: ['Chest pain in 2019, normal tests'], medications: [], allergies: [], redFlags: [],
  triage: { level: 'routine', rationale: 'Stable symptoms.', suggestedSpecialty: 'general_practice' },
  missingInformation: [],
}

test('age is computed from date of birth, respecting the birthday', () => {
  const now = new Date('2026-10-01')
  assert.equal(ageFromDob('2000-10-02', now), 25)
  assert.equal(ageFromDob('2000-10-01', now), 26)
  assert.equal(ageFromDob(null, now), null)
  assert.equal(ageFromDob('2100-01-01', now), null)
})

test('profile snapshot never invents values', () => {
  const s = profileToSnapshot(null)
  assert.deepEqual(s, { allergies: [], medications: [], chronicConditions: [], age: null, sex: null })
})

test('negatives and history do not trigger a re-scan alarm', () => {
  assert.ok(!reviewScanText(base).includes('No chest pain'))
  assert.equal(rescanExtraction(base).added.length, 0)
})

test('editing in a red flag raises urgency and records the flag', () => {
  const edited = { ...base, hpi: 'Dry cough for four days and now crushing chest pressure.' }
  const r = rescanExtraction(edited)
  assert.equal(r.added.length, 1)
  assert.equal(r.extraction.triage.level, 'urgent')
  assert.equal(r.extraction.redFlags[0]?.source, 'rule')
  // running again adds nothing, so the modal cannot loop
  assert.equal(rescanExtraction(r.extraction).added.length, 0)
})

test('re-scan never lowers an urgent level', () => {
  const urgent = { ...base, triage: { ...base.triage, level: 'urgent' as const } }
  assert.equal(rescanExtraction(urgent).extraction.triage.level, 'urgent')
})

test('validation explains problems in plain language', () => {
  assert.deepEqual(validateForConfirm(base), [])
  const bad = { ...base, chiefComplaint: ' ', symptoms: [{ ...base.symptoms[0]!, name: '' }] }
  const problems = validateForConfirm(bad)
  assert.equal(problems.length, 2)
  assert.match(problems[1] ?? '', /Symptom 1/)
})

test('resume goes to the right step', () => {
  assert.equal(resumeStep({ status: 'draft', ai_extraction: null }), 'describe')
  assert.equal(resumeStep({ status: 'draft', ai_extraction: {} }), 'review')
  assert.equal(resumeStep({ status: 'confirmed', ai_extraction: {} }), 'send')
  assert.equal(resumeStep({ status: 'sent', ai_extraction: {} }), 'detail')
  assert.equal(casePath('abc', 'review'), '/app/cases/abc/review')
})

test('splitList trims and de-duplicates', () => {
  assert.deepEqual(splitList('a, b;\n a ,, c'), ['a', 'b', 'c'])
})
