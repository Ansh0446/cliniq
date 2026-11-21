import { Link, createFileRoute } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { Wordmark } from '@/components/wordmark'
import { SummaryView } from '@/components/summary-view'
import { TriageBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Callout, Spinner } from '@/components/ui/form'
import { formatWhen } from '@/lib/clinical/display'
import { getCase, getClinic } from '@/lib/data'
import { getPatientProfile, listNotes } from '@/lib/doctor/data'
import { parseSoapText } from '@/lib/doctor/note-text'
import { effectiveTriage } from '@/lib/doctor/triage'
import { useAsync } from '@/lib/hooks/use-async'
import { parseStructured } from '@/lib/intake'
import { toFacts } from './doctor.cases.$caseId.index'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/doctor/cases/$caseId/print')({
  head: () => privateHead('Clinical summary'), component: PrintView })

function PrintView() {
  const { caseId } = Route.useParams()
  const { userId } = Route.useRouteContext()
  const data = useAsync(async () => {
    const row = await getCase(caseId)
    const [profile, clinic, notes] = await Promise.all([getPatientProfile(row.patient_id), row.clinic_id ? getClinic(row.clinic_id) : Promise.resolve(null), listNotes(caseId)])
    return { row, profile, clinic, notes }
  }, [caseId])

  if (data.loading && !data.data) return <Spinner label="Preparing summary" />
  if (data.error || !data.data) return <Callout tone="danger">{data.error}</Callout>
  const { row, profile, clinic, notes } = data.data
  const ex = parseStructured(row.structured)
  if (!ex) return <Callout tone="info">There is no confirmed summary to print.</Callout>
  const facts = toFacts(profile)
  const eff = effectiveTriage({ stored: row.triage_level, ai: parseStructured(row.ai_extraction), confirmed: ex, redFlagLabels: row.red_flags })
  const soapNote = notes.find((n) => n.kind === 'soap_draft' && n.author_id === userId)
  const soap = soapNote ? parseSoapText(soapNote.body) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/doctor/cases/$caseId" params={{ caseId }} className="text-sm font-medium text-teal-700 hover:underline">Back to case</Link>
        <Button onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print or save as PDF</Button>
      </div>
      <article className="space-y-6 rounded-surface border border-line bg-panel p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div><Wordmark /><h1 className="mt-2 text-xl font-bold">Pre-visit clinical summary</h1>
            <p className="text-sm text-muted">{clinic?.name ? `${clinic.name} · ` : ''}Confirmed by patient {formatWhen(row.confirmed_at ?? row.updated_at)}</p></div>
          <TriageBadge level={eff.level} />
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Patient</dt><dd className="font-semibold">{facts.name || '-'}</dd></div>
          <div><dt className="text-muted">Age / sex</dt><dd className="font-semibold">{facts.age ?? '?'} / {facts.sex ?? '-'}</dd></div>
          <div><dt className="text-muted">Blood group</dt><dd className="font-semibold">{facts.bloodGroup ?? '-'}</dd></div>
          <div><dt className="text-muted">Emergency contact</dt><dd className="font-semibold">{facts.emergencyContact ?? '-'}</dd></div>
          <div className="col-span-2"><dt className="text-muted">Allergies (profile)</dt><dd className="font-semibold">{facts.allergies.join(', ') || '-'}</dd></div>
          <div className="col-span-2"><dt className="text-muted">Conditions (profile)</dt><dd className="font-semibold">{facts.conditions.join(', ') || '-'}</dd></div>
        </dl>
        <SummaryView ex={ex} />
        {soap && (
          <section className="space-y-3 border-t border-line pt-4 text-sm">
            <h2 className="text-base font-semibold">SOAP note (clinician draft)</h2>
            {([['S', soap.s], ['O', soap.o], ['A', soap.a], ['P', soap.p]] as const).map(([k, v]) => <div key={k}><h3 className="font-semibold">{k}</h3><p className="whitespace-pre-wrap leading-relaxed">{v}</p></div>)}
          </section>
        )}
        <footer className="border-t border-line pt-3 text-xs text-muted">Patient-reported information, structured with AI and confirmed by the patient. Not a diagnosis. The clinician's own assessment takes priority.</footer>
      </article>
    </div>
  )
}
