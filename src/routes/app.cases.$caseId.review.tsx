import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { EmergencyBanner, EmergencyModal } from '@/components/emergency'
import { ExtractionEditor } from '@/components/extraction-editor'
import { TriageBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Callout, Section, Spinner } from '@/components/ui/form'
import { TRIAGE_LABEL } from '@/lib/clinical/constants'
import type { ClinicalExtraction } from '@/lib/clinical/schemas'
import { acknowledgeEmergency, confirmCase, getCase, getClinic, reopenCase, resendCase, saveReview } from '@/lib/data'
import { useAsync } from '@/lib/hooks/use-async'
import { casePath, parseStructured, rescanExtraction, validateForConfirm, type CaseRow } from '@/lib/intake'
import { privateHead } from '@/lib/site'
import { AskAssistantButton } from '@/components/assistant/ask-button'

export const Route = createFileRoute('/app/cases/$caseId/review')({
  head: () => privateHead('Review your summary'), component: ReviewPage })

function ReviewPage() {
  const { caseId } = Route.useParams()
  const c = useAsync(() => getCase(caseId), [caseId])
  if (c.loading && !c.data) return <Spinner label="Loading your summary" />
  if (c.error || !c.data) return <Callout tone="danger" title="Could not open this case">{c.error} <Link to="/app" className="font-semibold underline">Back to my cases</Link></Callout>
  return <Review row={c.data} reload={c.reload} />
}

function Review({ row, reload }: { row: CaseRow; reload: () => void }) {
  const navigate = useNavigate()
  const initial = parseStructured(row.structured)
  const resending = row.status === 'info_requested'

  const [ex, setEx] = useState<ClinicalExtraction | null>(initial)
  const [accurate, setAccurate] = useState(false)
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ackedAt, setAckedAt] = useState<string | null>(row.emergency_acknowledged_at)
  const [modalFlags, setModalFlags] = useState<string[]>([])
  const clinic = useAsync(() => (row.clinic_id ? getClinic(row.clinic_id) : Promise.resolve(null)), [row.clinic_id])

  // Re-run the red-flag rules shortly after the patient edits. Rules can only raise urgency.
  const firstRun = useRef(true)
  useEffect(() => {
    if (!ex) return
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => {
      const r = rescanExtraction(ex)
      if (r.added.length > 0) { setEx(r.extraction); setModalFlags(r.added.map((f) => f.label)); setAckedAt(null) }
    }, 800)
    return () => clearTimeout(t)
  }, [ex])

  if (row.status !== 'draft' && row.status !== 'info_requested') {
    return (
      <div className="space-y-4">
        <Callout tone="info" title={row.status === 'confirmed' ? 'This summary is already confirmed' : 'This case has been sent'}>
          {row.status === 'confirmed' ? 'Choose a clinic to send it to, or reopen it to make changes.' : 'It can no longer be edited here.'}
        </Callout>
        <div className="flex gap-3">
          {row.status === 'confirmed' && <>
            <Button onClick={() => navigate({ to: casePath(row.id, 'send') })}>Choose a clinic</Button>
            <Button variant="secondary" onClick={async () => { await reopenCase(row.id); reload() }}>Edit again</Button>
          </>}
          <Link to="/app/cases/$caseId" params={{ caseId: row.id }} className="self-center text-sm font-semibold text-teal-700 hover:underline">View case</Link>
        </div>
      </div>
    )
  }

  if (!ex) {
    return (
      <Callout tone="warn" title="There is no summary to review yet">
        <Link to="/app/intake/$caseId" params={{ caseId: row.id }} className="font-semibold underline">Describe your symptoms first</Link>
      </Callout>
    )
  }

  const flagLabels = ex.redFlags.map((f) => f.label)
  const needsAck = flagLabels.length > 0 && !ackedAt
  const modalOpen = modalFlags.length > 0 || needsAck
  const shownFlags = modalFlags.length > 0 ? modalFlags : flagLabels

  async function acknowledge() {
    try { setAckedAt(await acknowledgeEmergency(row.id)) } catch { setAckedAt(new Date().toISOString()) }
    setModalFlags([])
  }

  async function saveLater() {
    if (!ex) return
    setBusy('save'); setError(null)
    try { await saveReview(row.id, ex); await navigate({ to: '/app' }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') } finally { setBusy(null) }
  }

  async function confirm() {
    if (!ex) return
    const found = validateForConfirm(ex)
    setProblems(found)
    if (found.length > 0) return
    setBusy('confirm'); setError(null)
    try {
      if (resending) { await resendCase(row.id, ex); await navigate({ to: casePath(row.id, 'detail') }) }
      else { await confirmCase(row.id, ex, flagLabels.length ? ackedAt : null); await navigate({ to: casePath(row.id, 'send') }) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm.') } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      <EmergencyModal open={modalOpen} flags={shownFlags} selfHarm={shownFlags.some((f) => /self-harm|suicide/i.test(f))} onAcknowledge={acknowledge} />

      <div>
        <h1 className="text-2xl font-bold">{resending ? 'Add the information the clinic asked for' : 'Check your summary'}</h1>
        <p className="mt-1 text-sm text-muted">This is a draft written by AI from your words. It can contain mistakes. Read each section, correct anything wrong, then confirm.</p>
      </div>

      {resending && row.info_request_note && (
        <Callout tone="warn" title={`${clinic.data?.name ?? 'The clinic'} asked:`}>{row.info_request_note}</Callout>
      )}
      <EmergencyBanner flags={ackedAt ? flagLabels : []} />

      <Section title="Suggested urgency" hint="Worked out from standard warning-sign rules. It is not a diagnosis and you cannot lower it. A doctor makes the final call.">
        <div className="flex flex-wrap items-center gap-3">
          <TriageBadge level={ex.triage.level} />
          <span className="text-sm text-muted">{TRIAGE_LABEL[ex.triage.level]} review suggested</span>
        </div>
        <p className="text-sm leading-relaxed">{ex.triage.rationale}</p>
        <p className="text-sm"><AskAssistantButton prompt="What does the suggested urgency mean?">What does this mean?</AskAssistantButton></p>
        {ex.redFlags.length > 0 && (
          <ul className="list-disc pl-5 text-sm font-medium text-urgent">
            {ex.redFlags.map((f) => <li key={f.label}>{f.label}{f.evidence ? <span className="font-normal text-muted"> (you said: "{f.evidence}")</span> : null}</li>)}
          </ul>
        )}
      </Section>

      {ex.missingInformation.length > 0 && (
        <Callout tone="info" title="Details that would help the clinic">
          <ul className="list-disc pl-5">{ex.missingInformation.map((m) => <li key={m}>{m}</li>)}</ul>
          <p className="mt-1">Add them in the sections below, or <Link to="/app/intake/$caseId" params={{ caseId: row.id }} className="font-semibold underline">go back and say more</Link> (this makes a new summary and replaces your edits).</p>
        </Callout>
      )}

      <ExtractionEditor value={ex} onChange={setEx} />

      <details className="rounded-surface border border-line bg-panel p-4 text-sm">
        <summary className="cursor-pointer font-semibold">What you originally said</summary>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{row.raw_transcript}</p>
        <Link to="/app/intake/$caseId" params={{ caseId: row.id }} className="mt-2 inline-block font-semibold text-teal-700 hover:underline">Edit what I said</Link>
      </details>

      <Section title={resending ? 'Send again' : 'Confirm'}>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-teal-600" checked={accurate} onChange={(e) => setAccurate(e.target.checked)} />
          <span>I have read this summary and it correctly describes what I told you. I understand it is not a diagnosis.</span>
        </label>
        {problems.length > 0 && <Callout tone="danger" title="Fix these first"><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Callout>}
        {error && <Callout tone="danger">{error}</Callout>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!accurate || busy !== null || needsAck} onClick={confirm}>
            {busy === 'confirm' ? 'Saving' : resending ? `Save and send to ${clinic.data?.name ?? 'the clinic'}` : 'Confirm summary'}
          </Button>
          {!resending && <Button variant="secondary" size="lg" disabled={busy !== null} onClick={saveLater}>{busy === 'save' ? 'Saving' : 'Save and finish later'}</Button>}
        </div>
      </Section>
    </div>
  )
}
