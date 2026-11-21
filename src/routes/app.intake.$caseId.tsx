import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Mic, MicOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmergencyBanner, EmergencyModal } from '@/components/emergency'
import { Button } from '@/components/ui/button'
import { Callout, SelectField, Spinner, TextArea } from '@/components/ui/form'
import { scanForRedFlags } from '@/lib/clinical/redflags'
import type { ClinicalExtraction } from '@/lib/clinical/schemas'
import { createDraft, getCase, getProfile, saveStructuringResult, saveTranscript } from '@/lib/data'
import { useSpeechRecognition } from '@/lib/hooks/use-speech'
import { casePath, profileToSnapshot } from '@/lib/intake'
import { structureIntake } from '@/server/intake.functions'
import { privateHead } from '@/lib/site'
import { AskAssistantButton } from '@/components/assistant/ask-button'

export const Route = createFileRoute('/app/intake/$caseId')({
  head: () => privateHead('Describe your symptoms'), component: Describe })

const MAX = 8000
const LANGS = [
  { value: 'en-IN', label: 'English (India)' }, { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' }, { value: 'hi-IN', label: 'Hindi' },
]
const PROMPTS = ['What is bothering you most?', 'When did it start, and is it getting better or worse?', 'How bad is it, from 1 to 10?', 'Anything that makes it better or worse, and anything else you have noticed?']

function Describe() {
  const { caseId } = Route.useParams()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [source, setSource] = useState<'text' | 'voice'>('text')
  const [lang, setLang] = useState('en-IN')
  const [loading, setLoading] = useState(caseId !== 'new')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasSummary, setHasSummary] = useState(false)
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acked, setAcked] = useState<string[]>([])
  const [pending, setPending] = useState<{ ex: ClinicalExtraction; signature: string } | null>(null)

  const idRef = useRef<string | null>(caseId === 'new' ? null : caseId)
  const hydrated = useRef(caseId === 'new')
  const chain = useRef<Promise<void>>(Promise.resolve())
  const lastSaved = useRef('')

  // Load an existing draft once.
  useEffect(() => {
    if (caseId === 'new' || hydrated.current) return
    let cancelled = false
    getCase(caseId).then((c) => {
      if (cancelled) return
      if (c.status !== 'draft') { void navigate({ to: casePath(c.id, 'detail'), replace: true }); return }
      hydrated.current = true
      setText(c.raw_transcript)
      setSource(c.transcript_source === 'voice' ? 'voice' : 'text')
      setHasSummary(Boolean(c.ai_extraction))
      lastSaved.current = c.raw_transcript
      setLoading(false)
    }, (e: unknown) => { if (!cancelled) { setLoadError(e instanceof Error ? e.message : 'Could not load this draft.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [caseId, navigate])

  const scan = useMemo(() => scanForRedFlags(text), [text])
  const unacked = scan.flags.filter((f) => !acked.includes(f.label))
  const flagLabels = scan.flags.map((f) => f.label)
  const selfHarm = scan.categories.includes('mental_health')

  const speech = useSpeechRecognition((phrase) => {
    if (!phrase) return
    setSource('voice')
    setText((prev) => (prev ? `${prev.replace(/\s+$/, '')} ${phrase}` : phrase).slice(0, MAX))
  }, lang)
  useEffect(() => { if (unacked.length > 0 && speech.listening) speech.stop() }, [unacked.length, speech])

  /** Serialises saves so a slow request can never overwrite a newer one. */
  const persist = (value: string, src: 'text' | 'voice') => {
    chain.current = chain.current.then(async () => {
      if (value === lastSaved.current && idRef.current) return
      setSave('saving')
      try {
        if (!idRef.current) {
          const c = await createDraft(value, src)
          idRef.current = c.id
          await navigate({ to: casePath(c.id, 'describe'), replace: true })
        } else {
          await saveTranscript(idRef.current, value, src)
        }
        lastSaved.current = value
        setSave('saved')
      } catch { setSave('error') }
    })
    return chain.current
  }

  useEffect(() => {
    if (!hydrated.current || text.trim().length < 10) return
    const t = setTimeout(() => { void persist(text, source) }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, source])

  async function finish(ex: ClinicalExtraction, signature: string, ackLabels: string[]) {
    const id = idRef.current
    if (!id) return
    const ackAt = ackLabels.length ? new Date().toISOString() : null
    await saveStructuringResult(id, text.trim(), source, ex, ackAt, signature)
    await navigate({ to: casePath(id, 'review') })
  }

  async function onContinue() {
    setError(null); setBusy(true); speech.stop()
    try {
      await persist(text, source)
      if (!idRef.current) throw new Error('Your draft could not be saved. Check your connection and try again.')
      const profile = await getProfile()
      const result = await structureIntake({ data: { caseId: idRef.current, transcript: text.trim(), profile: profileToSnapshot(profile) } })
      const ex = result.extraction
      const needAck = ex.redFlags.filter((f) => !acked.includes(f.label))
      if (needAck.length > 0) { setPending({ ex, signature: result.signature }); return }
      await finish(ex, result.signature, acked)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Your description is saved. Try again.')
    } finally { setBusy(false) }
  }

  if (loading) return <Spinner label="Loading your draft" />
  if (loadError) return <Callout tone="danger" title="Could not open this draft">{loadError} <Link to="/app" className="font-semibold underline">Back to my cases</Link></Callout>

  const modalFlags = pending ? pending.ex.redFlags.filter((f) => !acked.includes(f.label)).map((f) => f.label) : unacked.map((f) => f.label)
  const modalOpen = pending !== null || unacked.length > 0
  const tooShort = text.trim().length < 10

  return (
    <div className="space-y-5">
      <EmergencyModal
        open={modalOpen}
        flags={modalFlags}
        selfHarm={selfHarm || modalFlags.some((f) => /self-harm|suicide/i.test(f))}
        onAcknowledge={async () => {
          const next = [...new Set([...acked, ...modalFlags])]
          setAcked(next)
          if (pending) {
            const held = pending
            setPending(null); setBusy(true)
            try { await finish(held.ex, held.signature, next) } catch (e) { setError(e instanceof Error ? e.message : 'Could not continue.') } finally { setBusy(false) }
          }
        }}
        onClose={pending ? () => setPending(null) : undefined}
      />

      <div>
        <h1 className="text-2xl font-bold">Describe what you are feeling</h1>
        <p className="mt-1 text-sm text-muted">Speak or type in your own words. Next you will review a structured summary and fix anything that is wrong before it goes anywhere.{' '}
          Prefer questions one at a time? <AskAssistantButton prompt="Help me describe my symptoms">Chat with the assistant</AskAssistantButton>.</p>
      </div>

      <EmergencyBanner flags={acked.length ? flagLabels.filter((l) => acked.includes(l)) : []} />
      {hasSummary && (
        <Callout tone="info">You already have a summary for this draft. <Link to="/app/cases/$caseId/review" params={{ caseId }} className="font-semibold underline">Go to review</Link>, or change your description below and continue to make a new one.</Callout>
      )}

      <div className="rounded-surface border border-line bg-panel p-5">
        <ul className="mb-4 list-disc space-y-0.5 pl-5 text-sm text-muted">{PROMPTS.map((p) => <li key={p}>{p}</li>)}</ul>
        <TextArea id="transcript" label="Your description" className="min-h-48 text-base" maxLength={MAX} value={text}
          onChange={(e) => { setText(e.target.value); if (source === 'voice' && e.target.value === '') setSource('text') }}
          placeholder="For example: I have had a dry cough and fever for four days. It is worse at night..." />
        {speech.interim && <p className="mt-2 text-sm italic text-muted" aria-live="polite">{speech.interim}</p>}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          {speech.supported ? (
            <>
              <Button type="button" variant={speech.listening ? 'danger' : 'secondary'} onClick={speech.listening ? speech.stop : speech.start} aria-pressed={speech.listening}>
                {speech.listening ? <><MicOff className="size-4" aria-hidden /> Stop dictation</> : <><Mic className="size-4" aria-hidden /> Dictate</>}
              </Button>
              <div className="w-44"><SelectField id="lang" label="Speech language" options={LANGS} value={lang} disabled={speech.listening} onChange={(e) => setLang(e.target.value)} /></div>
            </>
          ) : (
            <p className="text-sm text-muted">Voice dictation is not available in this browser. Type your description instead. Chrome and Edge support dictation.</p>
          )}
          <p className="ml-auto text-xs text-muted" aria-live="polite">
            {text.length}/{MAX} · {save === 'saving' ? 'Saving draft' : save === 'saved' ? 'Draft saved' : save === 'error' ? 'Could not save draft' : ''}
          </p>
        </div>
        {speech.error && <p role="alert" className="mt-2 text-sm text-urgent">{speech.error}</p>}
        {speech.supported && <p className="mt-3 text-xs text-muted">Dictation uses your browser's speech service, which may send audio to its provider to be turned into text. ClinIQ stores only the text.</p>}
      </div>

      {error && <Callout tone="danger" title="Could not build your summary">{error}</Callout>}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={onContinue} disabled={tooShort || busy}>
          {busy ? <><Loader2 className="size-5 animate-spin" aria-hidden /> Building your summary</> : 'Continue to review'}
        </Button>
        <Link to="/app" className="text-sm font-medium text-teal-700 hover:underline">Save and finish later</Link>
        {tooShort && <span className="text-sm text-muted">Write a little more to continue.</span>}
      </div>
      <p className="text-xs text-muted">ClinIQ does not diagnose or recommend treatment. If you think this is an emergency, call 112 or 911 now.</p>
    </div>
  )
}
