import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, MapPin, Phone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CaseTimeline } from '@/components/case-timeline'
import { SummaryView } from '@/components/summary-view'
import { StatusBadge, TriageBadge } from '@/components/ui/badges'
import { Button, buttonStyles } from '@/components/ui/button'
import { Callout, Section, Spinner } from '@/components/ui/form'
import { ACTIVITY_LABEL, STATUS_EVENT, formatWhen } from '@/lib/clinical/display'
import type { CaseStatus } from '@/lib/clinical/constants'
import { deleteDraft, getCase, getClinic, listActivity, reopenCase, subscribeToCases, type AuditRow } from '@/lib/data'
import { useAsync } from '@/lib/hooks/use-async'
import { casePath, parseStructured, resumeStep } from '@/lib/intake'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/app/cases/$caseId/')({
  head: () => privateHead('Your case'), component: CaseDetail })

function describeActivity(a: AuditRow): string | null {
  if (a.action === 'status_change' && a.to_value) return STATUS_EVENT[a.to_value as CaseStatus] ?? null
  return (ACTIVITY_LABEL as Record<string, string>)[a.action] ?? null
}

function CaseDetail() {
  const { caseId } = Route.useParams()
  const navigate = useNavigate()
  const data = useAsync(async () => {
    const row = await getCase(caseId)
    const [activity, clinic] = await Promise.all([listActivity(caseId), row.clinic_id ? getClinic(row.clinic_id) : Promise.resolve(null)])
    return { row, activity, clinic }
  }, [caseId])
  const [actionError, setActionError] = useState<string | null>(null)

  // Status changes made by the clinic show up without a refresh.
  useEffect(() => subscribeToCases(data.reload, caseId), [caseId, data.reload])

  if (data.loading && !data.data) return <Spinner label="Loading case" />
  if (data.error || !data.data) return <Callout tone="danger" title="Could not open this case">{data.error} <Link to="/app" className="font-semibold underline">Back to my cases</Link></Callout>

  const { row, activity, clinic } = data.data
  const ex = parseStructured(row.structured)
  const step = resumeStep(row)
  const events = activity.map((a) => ({ a, text: describeActivity(a) })).filter((e): e is { a: AuditRow; text: string } => e.text !== null)

  async function remove() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    try { await deleteDraft(row.id); await navigate({ to: '/app' }) } catch (e) { setActionError(e instanceof Error ? e.message : 'Could not delete.') }
  }
  async function editAgain() {
    try { await reopenCase(row.id); await navigate({ to: casePath(row.id, 'review') }) } catch (e) { setActionError(e instanceof Error ? e.message : 'Could not reopen.') }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app" className="text-sm font-medium text-teal-700 hover:underline">All cases</Link>
        <h1 className="mt-2 text-2xl font-bold">{row.chief_complaint || 'Intake not described yet'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={row.status} />{row.triage_level && <TriageBadge level={row.triage_level} />}</div>
      </div>

      {row.status === 'info_requested' && (
        <Callout tone="warn" title={`${clinic?.name ?? 'The clinic'} needs more information`}>
          <p>{row.info_request_note ?? 'Please add more detail to your summary.'}</p>
          <Link to="/app/cases/$caseId/review" params={{ caseId: row.id }} className={`${buttonStyles({ size: 'sm' })} mt-2`}>Add information and send again</Link>
        </Callout>
      )}
      {row.status === 'consultation_ready' && <Callout tone="success" title="Your clinic has reviewed your summary and you are ready for your consultation." />}
      {actionError && <Callout tone="danger">{actionError}</Callout>}

      <div className="flex flex-wrap gap-3">
        {(row.status === 'draft' || row.status === 'confirmed') && (
          <Link to={casePath(row.id, step)} className={buttonStyles()}>{row.status === 'draft' ? 'Resume' : 'Choose a clinic'}</Link>
        )}
        {row.status === 'confirmed' && <Button variant="secondary" onClick={editAgain}>Edit summary</Button>}
        {ex && row.status !== 'draft' && <Link to="/app/cases/$caseId/slip" params={{ caseId: row.id }} className={buttonStyles({ variant: 'secondary' })}><FileText className="size-4" aria-hidden /> Intake slip</Link>}
        {row.status === 'draft' && <Button variant="ghost" onClick={remove}><Trash2 className="size-4" aria-hidden /> Delete draft</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-6">
          <Section title="Progress"><CaseTimeline status={row.status} createdAt={row.created_at} activity={activity} clinicName={clinic?.name} /></Section>
          {clinic && (
            <Section title="Clinic">
              <p className="font-semibold">{clinic.name}</p>
              {clinic.address && <p className="flex gap-1.5 text-sm text-muted"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{clinic.address}</p>}
              {clinic.phone && <a href={`tel:${clinic.phone}`} className="flex gap-1.5 text-sm font-medium text-teal-700"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden />{clinic.phone}</a>}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          {ex ? <Section title="Your summary"><SummaryView ex={ex} /></Section> : <Callout tone="info">There is no summary yet. Resume your draft to create one.</Callout>}
          <details className="rounded-surface border border-line bg-panel p-4 text-sm">
            <summary className="cursor-pointer font-semibold">What you originally said</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{row.raw_transcript || 'Nothing yet.'}</p>
          </details>
          {events.length > 0 && (
            <Section title="Activity">
              <ul className="space-y-2 text-sm">{events.map(({ a, text }) => <li key={a.id} className="flex justify-between gap-4"><span>{text}</span><span className="shrink-0 text-xs text-muted">{formatWhen(a.created_at)}</span></li>)}</ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
