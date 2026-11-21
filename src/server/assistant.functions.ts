import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from './auth-middleware'
import { scanForRedFlags } from '@/lib/clinical/redflags'
import { assistantRequestSchema, modelReplySchema, type AssistantResult } from '@/lib/assistant/schemas'
import { emergencyResult, finalizeReply, lastUserText, normalizeTurns } from '@/lib/assistant/guard'
import { buildAssistantPrompt } from '@/lib/assistant/prompt'

/**
 * Patient assistant. Order matters:
 *  1. rate limit  2. red-flag rules on the latest message (fixed emergency text, no model call)
 *  3. the model, with a strict system prompt  4. the reply is checked and cleaned before it is returned.
 * Nothing is stored and message text is never logged.
 */
export const askAssistant = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator(assistantRequestSchema)
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    const { rateLimit } = await import('./rate-limit.server')
    const { generateStructuredContents } = await import('./gemini.server')
    rateLimit(context.userId, 'assistant', 24, 10 * 60_000)

    const turns = normalizeTurns(data.messages)
    if (turns.length === 0) throw new Error('Type a message first.')

    const scan = scanForRedFlags(lastUserText(turns))
    if (scan.emergency) return emergencyResult(scan)

    const raw = await generateStructuredContents({
      system: buildAssistantPrompt({ page: data.page, mode: data.mode, profile: data.profile }),
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
      schema: modelReplySchema,
      temperature: 0.4,
    })
    return finalizeReply(raw, { history: turns })
  })
