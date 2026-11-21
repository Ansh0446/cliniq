import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Flag, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@/components/app-shell'
import { StatusBadge, TriageBadge } from '@/components/ui/badges'
import { Callout, SelectField, Spinner } from '@/components/ui/form'
import { SPECIALTIES, TRIAGE_LABEL } from '@/lib/clinical/constants'
import { subscribeToCases } from '@/lib/data'
import { clinicStaff, listInbox, listMyClinics, type StaffMember } from '@/lib/doctor/data'
import { DEFAULT_FILTERS, filterInbox, sortInbox, waitingLabel, type AssignmentFilter, type InboxFilters } from '@/lib/doctor/inbox'
import { useAsync } from '@/lib/hooks/use-async'
import { cn } from '@/lib/cn'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/doctor/inbox')({
  head: () => privateHead('Inbox'), component: Inbox })

const specLabel = (slug: string | null) => SPECIALTIES.find((s) => s.slug === slug)?.label ?? '-'

function Inbox() {
  const { userId } = Route.useRouteContext()
  const navigate = useNavigate()
  const inbox = useAsync(listInbox, [])
  const clinics = useAsync(() => listMyClinics(userId), [userId])
  const staff = useAsync(async () => {
    const list = await listMyClinics(userId)
    return (await Promise.all(list.map((c) => clinicStaff(c.id)))).flat()
  }, [userId])
  const [f, setF] = useState<InboxFilters>(DEFAULT_FILTERS)
  const set = <K extends keyof InboxFilters>(k: K, v: InboxFilters[K]) => setF((p) => ({ ...p, [k]: v }))

  // New and changed cases appear without a refresh. Every 60 s also keeps "waiting" times honest.
  useEffect(() => subscribeToCases(inbox.reload), [inbox.reload])
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t) }, [])

  const names = useMemo(() => new Map((staff.data ?? []).map((s: StaffMember) => [s.user_id, s.full_name || 'Colleague'])), [staff.data])
  const rows = useMemo(() => sortInbox(filterInbox(inbox.data ?? [], f, userId)), [inbox.data, f, userId])
  const open = (inbox.data ?? []).filter((i) => i.status !== 'consultation_ready')
  const urgent = open.filter((i) => i.effective_triage === 'urgent').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted">{open.length} open · <span className={cn(urgent > 0 && 'font-semibold text-urgent')}>{urgent} urgent</span> · cases with red flags are pinned to the top</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-surface border border-line bg-panel p-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <label htmlFor="q" className="text-sm font-medium">Search</label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted" aria-hidden />
            <input id="q" value={f.search} onChange={(e) => set('search', e.target.value)} placeholder="Patient or complaint"
              className="h-10 w-full rounded-control border border-line bg-panel pl-9 pr-3 text-sm" />
          </div>
        </div>
        <SelectField id="f-triage" label="Urgency" value={f.triage} onChange={(e) => set('triage', e.target.value as InboxFilters['triage'])}
          options={[{ value: 'all', label: 'All' }, ...(['urgent', 'soon', 'routine'] as const).map((t) => ({ value: t, label: TRIAGE_LABEL[t] }))]} />
        <SelectField id="f-spec" label="Specialty" value={f.specialty} onChange={(e) => set('specialty', e.target.value)}
          options={[{ value: 'all', label: 'All' }, ...SPECIALTIES.map((s) => ({ value: s.slug, label: s.label }))]} />
        <SelectField id="f-assign" label="Assignment" value={f.assignment} onChange={(e) => set('assignment', e.target.value as AssignmentFilter)}
          options={[{ value: 'all', label: 'All' }, { value: 'unassigned', label: 'Unassigned' }, { value: 'mine', label: 'Assigned to me' }, { value: 'reviewed', label: 'Reviewed' }]} />
        {(clinics.data?.length ?? 0) > 1 && (
          <SelectField id="f-clinic" label="Clinic" value={f.clinicId} onChange={(e) => set('clinicId', e.target.value)}
            options={[{ value: 'all', label: 'All my clinics' }, ...(clinics.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-teal-600" checked={f.showDone} onChange={(e) => set('showDone', e.target.checked)} /> Show completed
        </label>
      </div>

      {inbox.loading && !inbox.data && <Spinner label="Loading inbox" />}
      {inbox.error && <Callout tone="danger" title="Could not load the inbox">{inbox.error}</Callout>}
      {inbox.data && rows.length === 0 && (
        <EmptyState title={inbox.data.length === 0 ? 'No cases waiting' : 'No cases match these filters'}>
          {inbox.data.length === 0 ? 'Cases that patients send to your clinic appear here, urgent ones first.' : 'Clear a filter to see more.'}
        </EmptyState>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-surface border border-line bg-panel">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>{['Urgency', 'Patient', 'Chief complaint', 'Onset', 'Specialty', 'Waiting', 'Status', 'Assigned'].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} onClick={() => void navigate({ to: '/doctor/cases/$caseId', params: { caseId: i.id } })}
                  className={cn('cursor-pointer border-b border-line last:border-0 hover:bg-teal-50', i.has_red_flags && 'border-l-4 border-l-urgent')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {i.effective_triage && <TriageBadge level={i.effective_triage} />}
                      {i.has_red_flags && <Flag className="size-4 text-urgent" aria-label="Red flags present" />}
                    </div>
                  </td>
                  <td className="px-4 py-3"><p className="font-medium">{i.patient_name || 'Unnamed patient'}</p><p className="text-xs text-muted">{i.patient_age ?? '?'} y · {i.patient_sex ?? 'sex not stated'}</p></td>
                  <td className="max-w-xs px-4 py-3">
                    <Link to="/doctor/cases/$caseId" params={{ caseId: i.id }} className="font-medium text-teal-700 hover:underline" onClick={(e) => e.stopPropagation()}>{i.chief_complaint || 'No complaint recorded'}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{i.symptom_onset || '-'}</td>
                  <td className="px-4 py-3 text-muted">{specLabel(i.specialty_hint)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{waitingLabel(i.sent_at)}</td>
                  <td className="px-4 py-3">{i.status && <StatusBadge status={i.status} />}</td>
                  <td className="px-4 py-3 text-muted">{!i.assigned_doctor_id ? 'Unassigned' : i.assigned_doctor_id === userId ? 'Me' : names.get(i.assigned_doctor_id) ?? 'Colleague'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
