import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanForRedFlags } from './redflags'
import { mergeWithRules, mostUrgent } from './merge'
import { modelOutputSchema, clinicalExtractionSchema } from './schemas'

test('flags chest pressure and breathing trouble', () => {
  const r = scanForRedFlags('I have had crushing chest pressure and I cannot breathe properly since morning')
  assert.equal(r.emergency, true)
  assert.ok(r.categories.includes('cardiac'))
  assert.ok(r.categories.includes('respiratory'))
})

test('does not flag plainly negated symptoms', () => {
  assert.equal(scanForRedFlags('I have a cough. No chest pain and no shortness of breath.').emergency, false)
})

test('negation does not leak across sentences', () => {
  assert.equal(scanForRedFlags('I have no fever. Chest pain started an hour ago.').emergency, true)
})

test('flags facial drooping and self-harm thoughts', () => {
  assert.equal(scanForRedFlags('my mother\'s face is drooping on one side').emergency, true)
  assert.equal(scanForRedFlags('I keep thinking I want to die').emergency, true)
})

test('ordinary complaint is not an emergency', () => {
  assert.equal(scanForRedFlags('Dry cough for four days, mild fever at night, sore throat').emergency, false)
})

const base = {
  schemaVersion: 1 as const, chiefComplaint: 'Cough', onset: null, hpi: 'Cough for 4 days.',
  symptoms: [], pertinentPositives: [], pertinentNegatives: [], timeline: [],
  pastMedicalHistory: [], medications: [], allergies: [], redFlags: [],
  triage: { level: 'routine' as const, rationale: 'Stable.', suggestedSpecialty: 'general_practice' as const },
  missingInformation: [],
}

test('model cannot downgrade a rule-based urgent result', () => {
  const scan = scanForRedFlags('sudden chest pain')
  const merged = mergeWithRules(base, scan)
  assert.equal(merged.triage.level, 'urgent')
  assert.equal(merged.redFlags[0]?.source, 'rule')
  assert.equal(mostUrgent('routine', 'soon'), 'soon')
})

test('schema rejects out-of-range severity and accepts valid output', () => {
  assert.equal(modelOutputSchema.safeParse(base).success, true)
  const bad = { ...base, symptoms: [{ name: 'Pain', bodyRegion: null, severity: 11, onset: null, duration: null, progression: 'unknown', notes: null }] }
  assert.equal(clinicalExtractionSchema.safeParse(bad).success, false)
})

test('schema has no diagnosis field', () => {
  assert.ok(!('diagnosis' in clinicalExtractionSchema.shape))
})
