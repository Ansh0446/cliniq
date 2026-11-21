import { CRISIS_LINES, EMERGENCY_NUMBERS } from '../clinical/constants'
import type { RedFlagScan } from '../clinical/redflags'
import {
  ASSISTANT_ROUTES, MAX_MESSAGE_CHARS,
  type AssistantMode, type AssistantPage, type AssistantResult, type AssistantRoute, type AssistantTurn, type ModelReply,
} from './schemas'

// ───────── Page

export function pageFromPath(pathname: string): AssistantPage {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/app') return 'dashboard'
  if (p === '/app/profile') return 'profile'
  if (p === '/app/account') return 'account'
  if (/^\/app\/intake\//.test(p)) return 'describe'
  if (/^\/app\/cases\/[^/]+\/review$/.test(p)) return 'review'
  if (/^\/app\/cases\/[^/]+\/send$/.test(p)) return 'send'
  if (/^\/app\/cases\/[^/]+\/slip$/.test(p)) return 'slip'
  if (/^\/app\/cases\/[^/]+$/.test(p)) return 'case'
  return 'other'
}

// ───────── Medical-advice guard
// Defence in depth. The prompt forbids diagnosis and treatment advice; these patterns catch the
// replies where the model ignores that. A match swaps the reply for a safe fixed message.

const DISEASES = 'flu|influenza|covid|corona\\w*|asthma|migraine|pneumonia|diabet\\w+|hypertension|cancer|tumou?rs?|stroke|heart attack|appendicitis|dengue|malaria|typhoid|gastroenteritis|food poisoning|sinusitis|bronchitis|arthritis|an?aemia|infection|ulcer|anxiety disorder|depression'
const DRUGS = 'paracetamol|acetaminophen|ibuprofen|aspirin|antibiotics?|antihistamines?|steroids?|painkillers?|pain relievers?|cough syrup|ointment|cream|fluids|ice|heat pack|compress'

/** Claims about what the patient has, or what symptoms are. Used for replies and for intake transcripts. */
const DIAGNOSTIC: RegExp[] = [
  new RegExp(`\\b(?:you|you're|you are)\\b[^.!?]{0,30}\\b(?:have|having|suffering from|experiencing|got)\\b[^.!?]{0,30}\\b(?:${DISEASES})\\b`, 'i'),
  new RegExp(`\\b(?:this|it|that|these)\\b[^.!?]{0,20}\\b(?:sounds like|looks like|seems like|could be|may be|might be|is probably|is likely|is just)\\b[^.!?]{0,30}\\b(?:${DISEASES}|a viral|a bacterial|stress)\\b`, 'i'),
  new RegExp(`\\b(?:sounds|looks|seems) like (?:an? |the )?(?:${DISEASES})\\b`, 'i'),
  /\b(?:i think|i suspect|probably|likely) (?:you|it|this)\b[^.!?]{0,20}\b(?:have|has|is|are)\b/i,
]

/** Treatment instructions. Not applied to intake transcripts, because patients may mention what they already took. */
const TREATMENT: RegExp[] = [
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|tablets?|pills?|capsules?|drops?|doses?)\b/i,
  new RegExp(`\\b(?:you should|you must|you need to|you can|i recommend|i suggest|i advise|try|consider)\\b[^.!?]{0,40}\\b(?:tak(?:e|ing)|drink(?:ing)?|eat(?:ing)?|rest(?:ing)?|avoid(?:ing)?|apply(?:ing)?|stop(?:ping)?|start(?:ing)?|us(?:e|ing)|put(?:ting)?)\\b[^.!?]{0,40}\\b(?:${DRUGS})\\b`, 'i'),
  new RegExp(`\\b(?:tak(?:e|ing)|drink(?:ing)?|apply(?:ing)?|us(?:e|ing))\\b[^.!?]{0,25}\\b(?:${DRUGS})\\b`, 'i'),
  /\b(?:you should|you must|you need to|it'?s best to|it is best to|i recommend|i advise)\b[^.!?]{0,40}\b(?:wait|rest|see a doctor|go to (?:a|the) (?:doctor|hospital|er)|stay (?:home|in bed))\b/i,
]

export const looksLikeDiagnosis = (t: string) => DIAGNOSTIC.some((r) => r.test(t))
export const looksLikeMedicalAdvice = (t: string) => DIAGNOSTIC.some((r) => r.test(t)) || TREATMENT.some((r) => r.test(t))

export const FALLBACK_REPLY =
  "I can't give medical advice or say what might be causing symptoms. A clinician can do that. I can help you describe what you are feeling so your clinic can read it before your visit."
export const DEFAULT_SUGGESTIONS = ['Help me describe my symptoms', 'How does ClinIQ work?']

// ───────── Emergency (fixed text, never model output)

export function emergencyResult(scan: Pick<RedFlagScan, 'flags' | 'categories'>): AssistantResult {
  const selfHarm = scan.categories.includes('mental_health')
  const numbers = EMERGENCY_NUMBERS.join(' or ')
  const crisis = CRISIS_LINES.map((l) => `${l.name}: ${l.number}`).join('; ')
  const reply = selfHarm
    ? `I'm concerned about what you wrote. Please contact emergency services (${numbers}) or a crisis line now (${crisis}), or tell someone near you. You do not have to handle this alone.`
    : `What you described can be a sign of a serious problem. Please call ${numbers} now, or ask someone nearby to take you to the nearest emergency department. Do not wait for an online review. When you are safe, I can help you prepare your intake.`
  return {
    reply, mode: 'help', suggestions: [], actions: [], intake: { ready: false, transcript: null },
    emergency: { flags: scan.flags.map((f) => f.label), selfHarm },
  }
}

// ───────── Conversation shaping

const MAX_TURNS = 14
const MAX_TOTAL_CHARS = 8000

/** Newest turns only, starting with a user turn, with consecutive same-role turns merged (Gemini needs alternation). */
export function normalizeTurns(messages: AssistantTurn[]): AssistantTurn[] {
  const merged: AssistantTurn[] = []
  for (const m of messages.slice(-MAX_TURNS * 2)) {
    const content = m.content.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!content) continue
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) merged[merged.length - 1] = { ...last, content: `${last.content}\n${content}`.slice(0, MAX_MESSAGE_CHARS * 2) }
    else merged.push({ ...m, content })
  }
  let turns = merged.slice(-MAX_TURNS)
  while (turns[0] && turns[0].role !== 'user') turns = turns.slice(1)
  let total = turns.reduce((n, t) => n + t.content.length, 0)
  while (total > MAX_TOTAL_CHARS && turns.length > 1) {
    total -= turns[0]!.content.length
    turns = turns.slice(1)
    while (turns[0] && turns[0].role !== 'user') { total -= turns[0].content.length; turns = turns.slice(1) }
  }
  return turns
}

export const lastUserText = (messages: AssistantTurn[]): string => [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

/** What the patient said while in intake mode, in order. Used when the model's own summary cannot be trusted. */
export function compileTranscript(messages: AssistantTurn[]): string {
  const parts = messages
    .filter((m) => m.role === 'user' && m.mode === 'intake')
    .map((m) => m.content.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))
  return parts.join(' ').slice(0, 4000)
}

// ───────── Cleaning the model's reply

const clamp = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`)
const isRoute = (to: string): to is AssistantRoute => (ASSISTANT_ROUTES as readonly string[]).includes(to)

export function sanitizeSuggestions(xs: string[]): string[] {
  const out: string[] = []
  for (const raw of xs) {
    const s = raw.trim().replace(/\s+/g, ' ')
    if (!s || s.length > 32 || looksLikeMedicalAdvice(s) || out.some((o) => o.toLowerCase() === s.toLowerCase())) continue
    out.push(s)
    if (out.length === 4) break
  }
  return out
}

export function sanitizeActions(xs: { label: string; to: string }[]): AssistantResult['actions'] {
  const out: AssistantResult['actions'] = []
  for (const a of xs) {
    const label = a.label.trim().replace(/\s+/g, ' ')
    if (!label || label.length > 40 || !isRoute(a.to) || out.some((o) => o.to === a.to)) continue
    out.push({ label, to: a.to })
    if (out.length === 3) break
  }
  return out
}

/** Turns raw model output into something safe to show. Never throws. */
export function finalizeReply(raw: ModelReply, ctx: { history: AssistantTurn[] }): AssistantResult {
  const mode: AssistantMode = raw.mode
  const reply = clamp(raw.reply.trim(), 600)

  if (looksLikeMedicalAdvice(reply)) {
    return { reply: FALLBACK_REPLY, mode, suggestions: DEFAULT_SUGGESTIONS, actions: [], intake: { ready: false, transcript: null }, emergency: null }
  }

  let ready = mode === 'intake' && raw.intake.ready
  let transcript: string | null = null
  if (ready) {
    const candidate = raw.intake.transcript?.trim().replace(/\s+/g, ' ') ?? ''
    transcript = candidate.length >= 10 && candidate.length <= 4000 && !looksLikeDiagnosis(candidate) ? candidate : compileTranscript(ctx.history)
    if (transcript.length < 10) { ready = false; transcript = null }
  }

  return { reply, mode, suggestions: sanitizeSuggestions(raw.suggestions), actions: sanitizeActions(raw.actions), intake: { ready, transcript }, emergency: null }
}
