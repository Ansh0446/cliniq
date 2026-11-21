import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'

process.env.GEMINI_API_KEY = 'test-key'
process.env.GEMINI_MODEL = 'gemini-test'
const { generateStructuredContents } = await import('./gemini.server')

const schema = z.object({ reply: z.string() })
const ok = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 })

function mockFetch(responses: Response[]) {
  const calls: { url: string; init: RequestInit & { body: string } }[] = []
  const real = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit & { body: string }) => { calls.push({ url, init }); return responses.shift() ?? new Response('', { status: 500 }) }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = real } }
}

test('chat request has the system prompt, alternating roles, the chosen temperature and the key in a header', async () => {
  const m = mockFetch([ok({ reply: 'hi' })])
  try {
    const out = await generateStructuredContents({
      system: 'SYSTEM TEXT', temperature: 0.4, schema,
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }, { role: 'model', parts: [{ text: 'hey' }] }, { role: 'user', parts: [{ text: 'question' }] }],
    })
    assert.deepEqual(out, { reply: 'hi' })
    const call = m.calls[0]!
    assert.match(call.url, /models\/gemini-test:generateContent$/)
    assert.ok(!call.url.includes('test-key'), 'key must not be in the URL')
    assert.equal((call.init.headers as Record<string, string>)['x-goog-api-key'], 'test-key')
    const body = JSON.parse(call.init.body)
    assert.equal(body.systemInstruction.parts[0].text, 'SYSTEM TEXT')
    assert.deepEqual(body.contents.map((c: { role: string }) => c.role), ['user', 'model', 'user'])
    assert.equal(body.generationConfig.temperature, 0.4)
    assert.equal(body.generationConfig.responseMimeType, 'application/json')
  } finally { m.restore() }
})

test('an invalid reply is sent back once for repair, then accepted', async () => {
  const m = mockFetch([ok({ wrong: true }), ok({ reply: 'fixed' })])
  try {
    const out = await generateStructuredContents({ system: 's', schema, contents: [{ role: 'user', parts: [{ text: 'x' }] }] })
    assert.equal(out.reply, 'fixed')
    assert.equal(m.calls.length, 2)
    const second = JSON.parse(m.calls[1]!.init.body)
    assert.match(second.contents.at(-1).parts[0].text, /rejected/)
    assert.equal(second.contents.at(-2).role, 'model')
  } finally { m.restore() }
})

test('two bad replies fail cleanly; provider errors never echo the response body', async () => {
  let m = mockFetch([ok({ a: 1 }), ok({ b: 2 })])
  try { await assert.rejects(generateStructuredContents({ system: 's', schema, contents: [{ role: 'user', parts: [{ text: 'x' }] }] }), /could not be validated/) } finally { m.restore() }
  m = mockFetch([new Response('SECRET patient text echoed by provider', { status: 403 })])
  try {
    await assert.rejects(generateStructuredContents({ system: 's', schema, contents: [{ role: 'user', parts: [{ text: 'x' }] }] }), (e: Error) => e.message === 'AI service returned 403' && !e.message.includes('SECRET'))
  } finally { m.restore() }
})
