import type { ZodType } from 'zod'
import { serverEnv } from './env.server'

type Part = { text: string }
export type Content = { role: 'user' | 'model'; parts: Part[] }

interface GeminiOptions<T> {
  system: string
  user: string
  schema: ZodType<T>
  /** One repair attempt when the first reply is not valid JSON for the schema. */
  retries?: number
}

function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(cleaned)
}


async function callGemini(
  system: string,
  contents: Content[],
  temperature = 0.1,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(serverEnv.geminiModel)}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': serverEnv.geminiApiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents,
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const errorData = (await res.json().catch(() => null)) as {
      error?: {
        message?: string
        status?: string
      }
    } | null

    console.error('[Gemini API Error]', {
      httpStatus: res.status,
      status: errorData?.error?.status,
      message: errorData?.error?.message,
      model: serverEnv.geminiModel,
    })

    throw new Error(`AI service returned ${res.status}`)
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { text?: string }[]
      }
    }[]
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('') ?? ''

  if (!text) {
    throw new Error('AI service returned an empty response')
  }

  return text
}


/** Runs the model over an existing conversation and validates the JSON it returns, with one repair attempt. */
export async function generateStructuredContents<T>(opts: {
  system: string; contents: Content[]; schema: ZodType<T>; retries?: number; temperature?: number
}): Promise<T> {
  const contents = [...opts.contents]
  let lastError = 'unknown'
  for (let attempt = 0; attempt <= (opts.retries ?? 1); attempt++) {
    const raw = await callGemini(opts.system, contents, opts.temperature)
    try {
      const parsed = opts.schema.safeParse(extractJson(raw))
      if (parsed.success) return parsed.data
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    } catch {
      lastError = 'reply was not valid JSON'
    }
    contents.push(
      { role: 'model', parts: [{ text: raw }] },
      { role: 'user', parts: [{ text: `That reply was rejected (${lastError}). Return only the corrected JSON object.` }] },
    )
  }
  throw new Error('The AI reply could not be validated. Please try again.')
}

export async function generateStructured<T>({ system, user, schema, retries = 1 }: GeminiOptions<T>): Promise<T> {
  return generateStructuredContents({ system, contents: [{ role: 'user', parts: [{ text: user }] }], schema, retries })
}
