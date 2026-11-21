import { useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Loader2, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { EmergencyModal } from '@/components/emergency'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { scanForRedFlags } from '@/lib/clinical/redflags'
import type { ProfileSnapshot } from '@/lib/clinical/schemas'
import { createDraft, getProfile } from '@/lib/data'
import { emergencyResult, pageFromPath } from '@/lib/assistant/guard'
import { MAX_MESSAGE_CHARS, type AssistantMode, type AssistantPage, type AssistantResult } from '@/lib/assistant/schemas'
import { profileToSnapshot } from '@/lib/intake'
import { askAssistant } from '@/server/assistant.functions'
import { ASSISTANT_OPEN_EVENT } from './ask-button'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode: AssistantMode
  suggestions?: string[]
  actions?: AssistantResult['actions']
  /** Shown to the patient but never sent to the model. */
  local?: boolean
  failed?: boolean
}

const WELCOME: Record<AssistantPage, string[]> = {
  review: ['What does urgency mean?', 'What happens after I confirm?', 'Help me describe my symptoms', 'How does ClinIQ work?'],
  send: ['How does sending work?', 'Why is my clinic not listed?', 'What can the clinic see?', 'Help me describe my symptoms'],
  dashboard: ['Help me describe my symptoms', 'How does ClinIQ work?', 'What happens after I send?', 'How do I delete my data?'],
  describe: ['Help me describe my symptoms', 'How does dictation work?', 'What happens next?', 'How does ClinIQ work?'],
  profile: ['Why add a health profile?', 'Who can see my profile?', 'Help me describe my symptoms', 'How does ClinIQ work?'],
  account: ['How do I download my data?', 'What does deleting my account do?', 'Who can see my data?', 'How does ClinIQ work?'],
  case: ['What do the statuses mean?', 'What if the clinic asks for more information?', 'How do I print the slip?', 'How does ClinIQ work?'],
  slip: ['How do I save the slip as PDF?', 'What happens after I send?', 'How does ClinIQ work?', 'What can the clinic see?'],
  other: ['Help me describe my symptoms', 'How does ClinIQ work?', 'What does urgency mean?', 'What happens after I send?'],
}

const GREETING = "Hi, I'm the ClinIQ assistant. I can explain how ClinIQ works, or ask a few short questions to help you describe your symptoms for your clinic. I can't give medical advice or say what symptoms mean."

const uid = () => Math.random().toString(36).slice(2, 10)

export function AssistantWidget() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const page = pageFromPath(pathname)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [mode, setMode] = useState<AssistantMode>('help')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [handoff, setHandoff] = useState<string | null>(null)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const [emergency, setEmergency] = useState<{ flags: string[]; selfHarm: boolean } | null>(null)
  const profileRef = useRef<ProfileSnapshot | null>(null)
  const profileLoaded = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // Latest values for the event handler, which is registered once.
  const sendRef = useRef<(t: string) => void>(() => undefined)

  const loadProfile = useCallback(async () => {
    if (profileLoaded.current) return
    profileLoaded.current = true
    try { profileRef.current = profileToSnapshot(await getProfile()) } catch { profileRef.current = null }
  }, [])

  const run = useCallback(async (history: Msg[], currentMode: AssistantMode) => {
    setBusy(true)
    try {
      const res = await askAssistant({
        data: {
          messages: history.filter((m) => !m.local && !m.failed).map(({ role, content, mode: m }) => ({ role, content, mode: m })),
          page, mode: currentMode, profile: profileRef.current,
        },
      })
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: res.reply, mode: res.mode, suggestions: res.suggestions, actions: res.actions }])
      setMode(res.mode)
      setHandoff(res.intake.ready ? res.intake.transcript : null)
      setHandoffError(null)
      if (res.emergency) setEmergency(res.emergency)
    } catch (e) {
      const text = e instanceof Error && /too many/i.test(e.message) ? e.message : 'Sorry, I could not answer just now.'
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: text, mode: currentMode, failed: true }])
    } finally { setBusy(false) }
  }, [page])

  const send = useCallback((raw: string) => {
    const text = raw.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!text || busy) return
    setInput('')
    const userMsg: Msg = { id: uid(), role: 'user', content: text, mode }
    const next = [...messages, userMsg]
    setMessages(next)

    // Instant, offline-safe emergency check. The same rules run on the server.
    const scan = scanForRedFlags(text)
    if (scan.emergency) {
      const r = emergencyResult(scan)
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: r.reply, mode: 'help' }])
      setEmergency(r.emergency)
      return
    }
    void run(next, mode)
  }, [busy, messages, mode, run])
  sendRef.current = send

  // Open from "Ask the assistant" links anywhere in the patient area.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      setOpen(true)
      if (prompt) setTimeout(() => sendRef.current(prompt), 0)
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (open) { void loadProfile(); setTimeout(() => inputRef.current?.focus(), 50) }
    else if (wasOpen.current) launcherRef.current?.focus()
    wasOpen.current = open
  }, [open, loadProfile])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, busy, handoff])

  /** The assistant may only offer a few fixed pages; "new intake" is a route with a placeholder ID. */
  const go = (to: AssistantResult['actions'][number]['to']) => {
    if (to === '/app/intake/new') void navigate({ to: '/app/intake/$caseId', params: { caseId: 'new' } })
    else void navigate({ to })
  }

  const newChat = () => { setMessages([]); setMode('help'); setHandoff(null); setHandoffError(null); setInput('') }
  const retry = () => {
    const history = messages.filter((m) => !m.failed)
    setMessages(history)
    void run(history, mode)
  }

  async function startIntake() {
    if (!handoff || handoff.trim().length < 10) return
    setHandoffBusy(true); setHandoffError(null)
    try {
      const draft = await createDraft(handoff.trim().slice(0, 8000), 'text')
      setOpen(false)
      newChat()
      await navigate({ to: '/app/intake/$caseId', params: { caseId: draft.id } })
    } catch (e) {
      setHandoffError(e instanceof Error ? e.message : 'Could not start your intake.')
    } finally { setHandoffBusy(false) }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) }
  }

  const last = messages[messages.length - 1]
  const chips = useMemo(() => {
    if (busy || handoff) return []
    if (messages.length === 0) return WELCOME[page]
    return last?.role === 'assistant' && !last.failed ? last.suggestions ?? [] : []
  }, [busy, handoff, messages.length, page, last])

  if (!open) {
    return (
      <button ref={launcherRef} type="button" onClick={() => setOpen(true)} aria-expanded={false} aria-label="Open the ClinIQ assistant"
        className="fixed bottom-4 right-4 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-teal-600 pl-4 pr-5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-teal-700 print:hidden">
        <MessageCircle className="size-5" aria-hidden /> Ask ClinIQ
      </button>
    )
  }

  return (
    <>
      <EmergencyModal open={emergency !== null} flags={emergency?.flags ?? []} selfHarm={emergency?.selfHarm ?? false} onAcknowledge={() => setEmergency(null)} />
      <section
        role="dialog" aria-label="ClinIQ assistant" aria-modal="false"
        onKeyDown={(e) => { if (e.key === 'Escape' && emergency === null) setOpen(false) }}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(38rem,calc(100dvh-6rem))] sm:w-[26rem] sm:rounded-surface print:hidden"
      >
        <header className="flex items-center gap-2 border-b border-line bg-teal-600 px-4 py-3 text-white">
          <Sparkles className="size-5" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-tight">ClinIQ assistant</h2>
            <p className="text-xs text-teal-100">{mode === 'intake' ? 'Helping you describe your symptoms' : 'Help with using ClinIQ'}</p>
          </div>
          <button type="button" onClick={newChat} className="grid size-9 place-items-center rounded-control hover:bg-teal-700" aria-label="Start a new chat" title="New chat"><RotateCcw className="size-4" aria-hidden /></button>
          <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-control hover:bg-teal-700" aria-label="Close assistant"><X className="size-5" aria-hidden /></button>
        </header>

        <div role="log" aria-live="polite" aria-relevant="additions" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <Bubble role="assistant">{GREETING}</Bubble>
          {messages.map((m) => (
            <div key={m.id} className="space-y-2">
              <Bubble role={m.role} failed={m.failed}>{m.content}</Bubble>
              {m.failed && <button type="button" onClick={retry} disabled={busy} className="text-sm font-semibold text-teal-700 underline">Try again</button>}
              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <Button key={a.to} size="sm" variant="secondary" onClick={() => { setOpen(false); go(a.to) }}>{a.label} <ArrowRight className="size-4" aria-hidden /></Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <p role="status" className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Thinking</p>}

          {handoff !== null && (
            <div className="space-y-2 rounded-surface border border-teal-500 bg-teal-50 p-3">
              <p className="text-sm font-semibold text-teal-900">Check what you told me</p>
              <p className="text-xs text-teal-900">This is only your own words. Fix anything that is wrong. Next you will review a structured summary before anything is sent.</p>
              <textarea aria-label="What you told me" value={handoff} maxLength={4000} onChange={(e) => setHandoff(e.target.value)}
                className="min-h-24 w-full rounded-control border border-control bg-panel p-2 text-sm leading-relaxed" />
              {handoffError && <p role="alert" className="text-sm text-urgent">{handoffError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={startIntake} disabled={handoffBusy || handoff.trim().length < 10}>{handoffBusy ? 'Starting' : 'Build my summary'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setHandoff(null)}>Keep chatting</Button>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-line px-4 pt-3">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => send(c)}
                className="rounded-full border border-teal-500 bg-panel px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">{c}</button>
            ))}
          </div>
        )}

        <form className="space-y-1.5 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(input) }}>
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} rows={2} value={input} maxLength={MAX_MESSAGE_CHARS} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
              aria-label="Message the assistant" placeholder="Type a message"
              className={cn('max-h-32 min-h-11 flex-1 resize-none rounded-control border border-control bg-panel px-3 py-2 text-sm placeholder:text-muted')} />
            <Button type="submit" size="lg" className="h-11 px-4" disabled={busy || !input.trim()} aria-label="Send message"><Send className="size-4" aria-hidden /></Button>
          </div>
          <p className="text-[11px] leading-snug text-muted">Not medical advice, and it can make mistakes. Chats are not saved. In an emergency call 112 or 911.</p>
        </form>
      </section>
    </>
  )
}

function Bubble({ role, children, failed }: { role: 'user' | 'assistant'; children: ReactNode; failed?: boolean }) {
  return (
    <div className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <p className={cn('max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
        role === 'user' ? 'rounded-br-md bg-teal-700 text-white' : failed ? 'rounded-bl-md border border-[#e8c98a] bg-soon-bg text-soon' : 'rounded-bl-md border border-line bg-canvas text-ink')}>
        {children}
      </p>
    </div>
  )
}
