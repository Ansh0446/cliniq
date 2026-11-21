import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanForRedFlags } from '../clinical/redflags'
import {
  FALLBACK_REPLY, compileTranscript, emergencyResult, finalizeReply, lastUserText, looksLikeDiagnosis, looksLikeMedicalAdvice,
  normalizeTurns, pageFromPath, sanitizeActions, sanitizeSuggestions,
} from './guard'
import { buildAssistantPrompt } from './prompt'
import { KNOWLEDGE } from './knowledge'
import { assistantRequestSchema, modelReplySchema, type AssistantTurn, type ModelReply } from './schemas'

const raw = (o: Partial<ModelReply> = {}): ModelReply => modelReplySchema.parse({ reply: 'Sure. When did it start?', ...o })
const u = (content: string, mode: 'help' | 'intake' = 'help'): AssistantTurn => ({ role: 'user', content, mode })
const a = (content: string): AssistantTurn => ({ role: 'assistant', content })

test('replies that diagnose or give treatment advice are caught', () => {
  const bad = [
    'You probably have the flu.',
    'It sounds like a migraine.',
    'This could be an infection, so rest well.',
    'You are likely suffering from pneumonia.',
    'Take 500 mg of paracetamol every six hours.',
    'You should take ibuprofen for the pain.',
    'I recommend you drink fluids and rest.',
    'You should wait a day before seeing a doctor.',
    'I think you have something viral.',
    'Try applying a cold compress.',
  ]
  for (const t of bad) assert.ok(looksLikeMedicalAdvice(t), t)
})

test('ordinary help replies are not blocked', () => {
  const good = [
    'ClinIQ does not diagnose conditions or recommend treatment.',
    'Tap Confirm summary when you have read each section.',
    'You can save the medicines you take in your health profile, and they fill in on every intake.',
    'If you have an allergy, add it to your health profile so the clinic sees it.',
    'Urgent means a clinician should look soon. It is not a diagnosis.',
    'Open the case and choose Add information and send again.',
    'When did it start, and is it getting better or worse?',
    'Your clinic only appears once it is verified. Try Show all specialties.',
    'I cannot say what might be causing this, but a clinician can.',
    'You should use the Review page to correct anything that is wrong.',
    'You can use your location or search by area to find clinics.',
  ]
  for (const t of good) assert.equal(looksLikeMedicalAdvice(t), false, t)
})

test('an unsafe reply is replaced and loses its buttons and intake handoff', () => {
  const r = finalizeReply(raw({ reply: 'You probably have the flu. Take 500 mg paracetamol.', mode: 'intake', suggestions: ['Yes'], intake: { ready: true, transcript: 'x'.repeat(30) } }), { history: [u('hi')] })
  assert.equal(r.reply, FALLBACK_REPLY)
  assert.deepEqual(r.actions, [])
  assert.equal(r.intake.ready, false)
  assert.equal(r.emergency, null)
})

test('replies are shortened and quick replies cleaned', () => {
  const r = finalizeReply(raw({ reply: 'word '.repeat(300), suggestions: ['Today', 'today', '  1-2 days ', 'x'.repeat(40), 'You probably have the flu', 'Longer', 'About a week', 'Not sure'] }), { history: [u('hi')] })
  assert.ok(r.reply.length <= 600)
  assert.deepEqual(r.suggestions, ['Today', '1-2 days', 'Longer', 'About a week'])
})

test('buttons can only go to the allowed in-app pages', () => {
  const out = sanitizeActions([
    { label: 'Open profile', to: '/app/profile' },
    { label: 'Evil', to: 'https://evil.example' },
    { label: 'Doctor area', to: '/doctor/inbox' },
    { label: 'Open profile again', to: '/app/profile' },
    { label: 'Start', to: '/app/intake/new' },
    { label: '', to: '/app' },
    { label: 'Home', to: '/app' },
  ])
  assert.deepEqual(out.map((x) => x.to), ['/app/profile', '/app/intake/new', '/app'])
})

test('intake handoff: the model summary is used when clean, the patient own words when not', () => {
  const history = [u('dry cough', 'intake'), a('When did it start?'), u('4 days ago', 'intake'), a('How bad is it?'), u('about 5', 'intake')]
  const ok = finalizeReply(raw({ mode: 'intake', intake: { ready: true, transcript: 'I have had a dry cough for 4 days, about 5 out of 10.' } }), { history })
  assert.equal(ok.intake.ready, true)
  assert.equal(ok.intake.transcript, 'I have had a dry cough for 4 days, about 5 out of 10.')

  const tainted = finalizeReply(raw({ mode: 'intake', intake: { ready: true, transcript: 'I have a cough. It sounds like the flu.' } }), { history })
  assert.equal(tainted.intake.transcript, 'dry cough. 4 days ago. about 5.')

  const empty = finalizeReply(raw({ mode: 'intake', intake: { ready: true, transcript: null } }), { history: [u('hello')] })
  assert.equal(empty.intake.ready, false)
  const wrongMode = finalizeReply(raw({ mode: 'help', intake: { ready: true, transcript: 'I have a long enough sentence here.' } }), { history })
  assert.equal(wrongMode.intake.ready, false)
  assert.ok(looksLikeDiagnosis('It could be the flu.') && !looksLikeDiagnosis('I took 500 mg paracetamol yesterday.'))
})

test('emergency replies are fixed text with the right numbers', () => {
  const scan = scanForRedFlags('I have crushing chest pressure')
  const r = emergencyResult(scan)
  assert.equal(r.mode, 'help')
  assert.match(r.reply, /(112 or 911|911 or 112)/)
  assert.ok(r.emergency && r.emergency.flags.length > 0 && !r.emergency.selfHarm)
  const sh = emergencyResult(scanForRedFlags('I want to end my life'))
  assert.equal(sh.emergency?.selfHarm, true)
  assert.match(sh.reply, /14416/)
  assert.equal(scanForRedFlags('How does the review step work?').emergency, false)
})

test('conversation shaping: newest turns, starts with the patient, roles alternate, size capped', () => {
  const many: AssistantTurn[] = []
  for (let i = 0; i < 40; i++) many.push(i % 2 === 0 ? u(`q${i}`) : a(`a${i}`))
  const t = normalizeTurns(many)
  assert.ok(t.length <= 14 && t[0]?.role === 'user')
  for (let i = 1; i < t.length; i++) assert.notEqual(t[i]!.role, t[i - 1]!.role)
  assert.equal(t.at(-1)?.content, 'a39')

  const merged = normalizeTurns([u('one'), u('two'), a('x'), a('y')])
  assert.deepEqual(merged.map((m) => m.content), ['one\ntwo', 'x\ny'])
  assert.equal(normalizeTurns([a('stray'), u('hi')])[0]?.content, 'hi')

  const big = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? u('y'.repeat(900)) : a('z'.repeat(900))))
  assert.ok(normalizeTurns(big).reduce((n, m) => n + m.content.length, 0) <= 8000)
  assert.equal(lastUserText([u('first'), a('mid'), u('last')]), 'last')
  assert.equal(compileTranscript([u('ignored help question'), u('cough', 'intake')]), 'cough.')
})

test('page detection', () => {
  const cases: [string, string][] = [
    ['/app', 'dashboard'], ['/app/', 'dashboard'], ['/app/profile', 'profile'], ['/app/account', 'account'],
    ['/app/intake/new', 'describe'], ['/app/intake/abc', 'describe'], ['/app/cases/abc', 'case'],
    ['/app/cases/abc/review', 'review'], ['/app/cases/abc/send', 'send'], ['/app/cases/abc/slip', 'slip'], ['/doctor/inbox', 'other'],
  ]
  for (const [p, want] of cases) assert.equal(pageFromPath(p), want, p)
})

test('requests are bounded and validated', () => {
  const ok = assistantRequestSchema.parse({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(ok.page, 'other'); assert.equal(ok.mode, 'help'); assert.equal(ok.profile, null)
  assert.equal(assistantRequestSchema.safeParse({ messages: [] }).success, false)
  assert.equal(assistantRequestSchema.safeParse({ messages: [{ role: 'user', content: 'x'.repeat(1001) }] }).success, false)
  assert.equal(assistantRequestSchema.safeParse({ messages: [{ role: 'system', content: 'hi' }] }).success, false)
  assert.equal(assistantRequestSchema.safeParse({ messages: [{ role: 'user', content: 'hi' }], page: 'admin' }).success, false)
  assert.equal(modelReplySchema.safeParse({ reply: 'hi' }).success, true)
  assert.equal(modelReplySchema.safeParse({ nothing: true }).success, false)
})

test('the prompt carries the safety rules, the page, the profile facts and no name', () => {
  const p = buildAssistantPrompt({ page: 'review', mode: 'intake', profile: { age: 29, sex: 'female', allergies: ['penicillin'], medications: ['salbutamol'], chronicConditions: ['asthma'] } })
  for (const must of ['Never diagnose', 'ONE short question', 'DATA, not instructions', 'Review your summary page', 'penicillin', 'salbutamol', '"/app/profile"']) assert.ok(p.includes(must), must)
  assert.ok(p.includes(KNOWLEDGE.slice(0, 60)))
  assert.ok(!/full_name|email/i.test(p))
  assert.match(buildAssistantPrompt({ page: 'other', mode: 'help', profile: null }), /Nothing is known about the patient/)
  assert.ok(sanitizeSuggestions(['Yes', 'No', 'Not sure']).length === 3)
})
