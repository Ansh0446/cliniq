import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from './auth-middleware'

export type AiTrust = 'valid' | 'missing' | 'invalid'

/**
 * Checks that the stored AI assessment is the one the server produced for this
 * case. Reads through the caller's own session, so row-level security decides
 * whether they may see the case at all.
 */
export const verifyAiOutput = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator(z.object({ caseId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<{ trust: AiTrust }> => {
    const { checkSignature } = await import('./signing.server')
    const { data: row, error } = await context.supabase
      .from('cases').select('ai_extraction, ai_signature').eq('id', data.caseId).maybeSingle()
    if (error || !row) throw new Error('Case not found')
    return { trust: checkSignature(data.caseId, row.ai_extraction, row.ai_signature) }
  })
