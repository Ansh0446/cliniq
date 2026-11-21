import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalJson } from '../lib/clinical/canonical'

process.env.AI_SIGNING_SECRET = 'test-secret-with-more-than-16-chars'
const { signExtraction, checkSignature } = await import('./signing.server')

const ex = { chiefComplaint: 'Cough', triage: { level: 'soon', rationale: 'x' }, redFlags: [], symptoms: [{ name: 'Cough', severity: 4 }] }
const CASE = '11111111-1111-4111-8111-111111111111'

test('canonical JSON ignores key order and survives a jsonb-style reorder', () => {
  const reordered = { symptoms: [{ severity: 4, name: 'Cough' }], redFlags: [], triage: { rationale: 'x', level: 'soon' }, chiefComplaint: 'Cough' }
  assert.equal(canonicalJson(ex), canonicalJson(reordered))
  assert.equal(canonicalJson({ a: undefined, b: 1 }), '{"b":1}')
})

test('a signature verifies for the same case and content', () => {
  const sig = signExtraction(CASE, ex)
  assert.equal(checkSignature(CASE, JSON.parse(JSON.stringify(ex)), sig), 'valid')
})

test('any change to urgency, red flags or the case id is detected', () => {
  const sig = signExtraction(CASE, ex)
  assert.equal(checkSignature(CASE, { ...ex, triage: { ...ex.triage, level: 'routine' } }, sig), 'invalid')
  assert.equal(checkSignature(CASE, { ...ex, redFlags: [{ label: 'x' }] }, sig), 'invalid')
  assert.equal(checkSignature('22222222-2222-4222-8222-222222222222', ex, sig), 'invalid')
})

test('missing or malformed signatures are reported, never thrown', () => {
  assert.equal(checkSignature(CASE, ex, null), 'missing')
  assert.equal(checkSignature(CASE, null, 'abc'), 'missing')
  assert.equal(checkSignature(CASE, ex, 'not-hex'), 'invalid')
  assert.equal(checkSignature(CASE, ex, signExtraction(CASE, ex).slice(0, 20)), 'invalid')
})
