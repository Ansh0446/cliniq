import { z } from 'zod'
import { profileSnapshotSchema } from '../clinical/schemas'

export const ASSISTANT_PAGES = ['dashboard', 'profile', 'account', 'describe', 'review', 'send', 'case', 'slip', 'other'] as const
export type AssistantPage = (typeof ASSISTANT_PAGES)[number]

/** The only places the assistant may offer to take someone. Case pages need an ID, so they are not listed. */
export const ASSISTANT_ROUTES = ['/app', '/app/profile', '/app/account', '/app/intake/new'] as const
export type AssistantRoute = (typeof ASSISTANT_ROUTES)[number]

export const MAX_MESSAGE_CHARS = 1000
export type AssistantMode = 'help' | 'intake'

export const assistantTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  /** Which mode the conversation was in when this message was sent. */
  mode: z.enum(['help', 'intake']).optional(),
})
export type AssistantTurn = z.infer<typeof assistantTurnSchema>

export const assistantRequestSchema = z.object({
  messages: z.array(assistantTurnSchema).min(1).max(40),
  page: z.enum(ASSISTANT_PAGES).default('other'),
  mode: z.enum(['help', 'intake']).default('help'),
  profile: profileSnapshotSchema.nullable().default(null),
})
export type AssistantRequest = z.infer<typeof assistantRequestSchema>

/** What the model is asked to return. Deliberately lenient: everything is cleaned up afterwards. */
export const modelReplySchema = z.object({
  reply: z.string().min(1).max(4000),
  mode: z.enum(['help', 'intake']).default('help'),
  suggestions: z.array(z.string()).max(12).default([]),
  actions: z.array(z.object({ label: z.string().max(120), to: z.string().max(200) })).max(8).default([]),
  intake: z.object({ ready: z.boolean().default(false), transcript: z.string().max(10000).nullable().default(null) })
    .default({ ready: false, transcript: null }),
})
export type ModelReply = z.infer<typeof modelReplySchema>

export interface AssistantResult {
  reply: string
  mode: AssistantMode
  suggestions: string[]
  actions: { label: string; to: AssistantRoute }[]
  intake: { ready: boolean; transcript: string | null }
  /** Set when a red-flag rule matched. The reply is then fixed text, not model output. */
  emergency: { flags: string[]; selfHarm: boolean } | null
}
