import { Link, createFileRoute } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout, Spinner } from '@/components/ui/form'
import { SummaryView } from '@/components/summary-view'
import { Wordmark } from '@/components/wordmark'
import { formatWhen } from '@/lib/clinical/display'
import { getCase, getClinic, getProfile } from '@/lib/data'
import { useAsync } from '@/lib/hooks/use-async'
import { ageFromDob, parseStructured } from '@/lib/intake'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/app/cases/$caseId/slip')({
  head: () => privateHead('Intake slip'), component: Slip })

const SEX: Record<string, string> = { female: 'Female', male: 'Male', other: 'Other', unspecified: 'Not stated' }

/**
 * Printable hand-over slip. It prints through the browser ("Save as PDF" in the
 * print dialog) rather than a PDF library so every language and script the
 * patient used is rendered correctly.
 */
function Slip() {
  const { caseId } = Route.useParams()
  const data = useAsync(async () => {
    const row = await getCase(caseId)
    const [profile, clinic] = await Promise.all([getProfile(), row.clinic_id ? getClinic(row.clinic_id) : Promise.resolve(null)])
    return { row, profile, clinic }
  }, [caseId])

  if (data.loading && !data.data) return <Spinner label="Preparing your slip" />
  if (data.error || !data.data) return <Callout tone="danger" title="Could not prepare the slip">{data.error}</Callout>
  const { row, profile, clinic } = data.data
  const ex = parseStructured(row.structured)

  if (!ex || row.status === 'draft') {
    return (
      <Callout tone="info" title="Confirm your summary first">
        The slip is made from the summary you confirm. <Link to="/app/cases/$caseId/review" params={{ caseId }} className="font-semibold underline">Go to review</Link>
      </Callout>
    )
  }

  const age = ageFromDob(profile?.dob)
  const when = row.confirmed_at ?? row.updated_at

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/app/cases/$caseId" params={{ caseId }} className="text-sm font-medium text-teal-700 hover:underline">Back to case</Link>
        <Button onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print or save as PDF</Button>
      </div>
      <p className="text-sm text-muted print:hidden">In the print window, choose "Save as PDF" as the destination to download a file, or print it to hand over at the clinic.</p>

      <article className="space-y-6 rounded-surface border border-line bg-panel p-6 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <Wordmark />
            <h1 className="mt-2 text-xl font-bold">Patient intake slip</h1>
            <p className="text-sm text-muted">Confirmed by the patient on {formatWhen(when)}</p>
          </div>
          {clinic && <div className="text-right text-sm"><p className="text-muted">Prepared for</p><p className="font-semibold">{clinic.name}</p></div>}
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Name</dt><dd className="font-semibold">{profile?.full_name || '-'}</dd></div>
          <div><dt className="text-muted">Age</dt><dd className="font-semibold">{age ?? '-'}</dd></div>
          <div><dt className="text-muted">Sex</dt><dd className="font-semibold">{profile?.sex ? SEX[profile.sex] : '-'}</dd></div>
          <div><dt className="text-muted">Blood group</dt><dd className="font-semibold">{profile?.blood_group ?? '-'}</dd></div>
          <div className="col-span-2"><dt className="text-muted">Emergency contact</dt><dd className="font-semibold">{profile?.emergency_contact_name || '-'}{profile?.emergency_contact_phone ? `, ${profile.emergency_contact_phone}` : ''}</dd></div>
          {profile && profile.chronic_conditions.length > 0 && <div className="col-span-2"><dt className="text-muted">Long-term conditions</dt><dd className="font-semibold">{profile.chronic_conditions.join(', ')}</dd></div>}
        </dl>

        <SummaryView ex={ex} />

        <footer className="border-t border-line pt-3 text-xs text-muted">
          Patient-reported information, structured with AI and confirmed by the patient. This is not a diagnosis or medical advice. The clinician's own assessment takes priority.
        </footer>
      </article>
    </div>
  )
}
