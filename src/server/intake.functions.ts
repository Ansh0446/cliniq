import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from './auth-middleware'
import {
  modelOutputSchema,
  structureIntakeInputSchema,
  type StructureIntakeResult,
} from '@/lib/clinical/schemas'
import { scanForRedFlags } from '@/lib/clinical/redflags'
import { mergeWithRules } from '@/lib/clinical/merge'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/clinical/prompt'

/**
 * Shared clinical engine entry point. Turns a transcript into a validated,
 * non-diagnostic structured record and merges it with deterministic red-flag
 * rules. It persists nothing: the patient must review and confirm first.
 */
export const structureIntake = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator(structureIntakeInputSchema)
  .handler(async ({ data, context }): Promise<StructureIntakeResult> => {
    const { generateStructured } = await import('./gemini.server')
    const { rateLimit } = await import('./rate-limit.server')
    const { signExtraction } = await import('./signing.server')
    rateLimit(context.userId, 'structure', 8, 10 * 60_000)
    const scan = scanForRedFlags(data.transcript)
    const output = await generateStructured({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(data.transcript, data.profile),
      schema: modelOutputSchema,
    })
    const extraction = mergeWithRules(output, scan)
    return { extraction, signature: signExtraction(data.caseId, extraction), emergency: scan.emergency, emergencyCategories: scan.categories }
  })
