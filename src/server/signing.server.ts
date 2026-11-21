import { createHmac, timingSafeEqual } from 'node:crypto'
import { canonicalJson } from '@/lib/clinical/canonical'

/**
 * Key for signing AI output. Set AI_SIGNING_SECRET to a long random string in
 * production. Without it, a key is derived from GEMINI_API_KEY, which is also a
 * server-only secret, so signing still works out of the box.
 */
function key(): string {
  const dedicated = process.env.AI_SIGNING_SECRET
  if (dedicated && dedicated.length >= 16) return dedicated
  const fallback = process.env.GEMINI_API_KEY
  if (!fallback) throw new Error('Set AI_SIGNING_SECRET (or GEMINI_API_KEY) on the server')
  return `cliniq-ai-signing:${fallback}`
}

const mac = (caseId: string, extraction: unknown) =>
  createHmac('sha256', key()).update(`${caseId}.${canonicalJson(extraction)}`).digest('hex')

export function signExtraction(caseId: string, extraction: unknown): string {
  return mac(caseId, extraction)
}

export type SignatureStatus = 'valid' | 'missing' | 'invalid'

export function checkSignature(caseId: string, extraction: unknown, signature: string | null): SignatureStatus {
  if (extraction == null || !signature) return 'missing'
  const expected = Buffer.from(mac(caseId, extraction), 'hex')
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected) ? 'valid' : 'invalid'
}
