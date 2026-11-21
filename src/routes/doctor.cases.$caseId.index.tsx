import { Link, createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useEffect } from 'react'
import { ActionBar } from '@/components/doctor/action-bar'
import { ChecklistPanel, NotesPanel, SoapPanel } from '@/components/doctor/panels'
import { SummaryView } from '@/components/summary-view'
import { StatusBadge, TriageBadge } from '@/components/ui/badges'
import { Callout, Section, Spinner } from '@/components/ui/form'
import { formatWhen } from '@/lib/clinical/display'
import { getCase, getClinic, listActivity, subscribeToCases, type AuditRow } from '@/lib/data'
import { clinicStaff, getPatientProfile, listNotes, logView, type PatientProfile } from '@/lib/doctor/data'
import { parseSoapText, type PatientFacts } from '@/lib/doctor/note-text'
import { diffExtractions, effectiveTriage } from '@/lib/doctor/triage'
import { useAsync } from '@/lib/hooks/use-async'
import { ageFromDob, parseStructured } from '@/lib/intake'
import { verifyAiOutput } from '@/server/verify.functions'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/doctor/cases/$caseId/')({
  head: () => privateHead('Case review'), component: DoctorCase })

export function toFacts(p: PatientProfile | null): PatientFacts {
  return {
    name: p?.full_name ?? null, age: ageFromDob(p?.dob), sex: p?.sex ?? null, bloodGroup: p?.blood_group ?? null,
    allergies: p?.allergies ?? [], conditions: p?.chronic_conditions ?? [], medications: p?.medications ?? [],
    emergencyContact: p?.emergency_contact_name ? `${p.emergency_contact_name}${p.emergency_contact_phone ? `, ${p.emergency_contact_phone}` : ''}` : null,
  }
}

function describe(a: AuditRow, nameOf: (id: string | null) => string): string | null {
  switch (a.action) {
    case 'case_created': return 'Patient started the intake'
    case 'status_change': return `Status: ${a.from_value ?? '-'} to ${a.to_value ?? '-'}`.replace(/_/g, ' ')
    case 'clinic_transfer': return 'Routed to this clinic'
    case 'assignment': return `Assigned to ${nameOf(a.to_value)}`
    case 'marked_reviewed': return `Marked reviewed by ${nameOf(a.actor_id)}`
    case 'case_viewed': return `Opened by ${nameOf(a.actor_id)}`
    default: return null
  }
}

function DoctorCase() {
  const { caseId } = Route.useParams()
  const { userId } = Route.useRouteContext()
  const data = useAsync(async () => {
    const row = await getCase(caseId)
    const [profile, clinic, staff, notes, activity] = await Promise.all([
      getPatientProfile(row.patient_id),
      row.clinic_id ? getClinic(row.clinic_id) : Promise.resolve(null),
      row.clinic_id ? clinicStaff(row.clinic_id) : Promise.resolve([]),
      listNotes(caseId),
      listActivity(caseId),
    ])
    return { row, profile, clinic, staff, notes, activity }
  }, [caseId])

  const trust = useAsync(() => verifyAiOutput({ data: { caseId } }).then((r) => r.trust), [caseId, data.data?.row.updated_at])
  useEffect(() => { void logView(caseId).catch(() => undefined) }, [caseId])
  useEffect(() => subscribeToCases(data.reload, caseId), [caseId, data.reload])

  if (data.loading && !data.data) return <Spinner label="Loading case" />
  if (data.error || !data.data) return <Callout tone="danger" title="Could not open this case">{data.error} <Link to="/doctor/inbox" className="font-semibold underline">Back to inbox</Link></Callout>

  const { row, profile, clinic, staff, notes, activity } = data.data
  const ex = parseStructured(row.structured)
  const ai = parseStructured(row.ai_extraction)
  const facts = toFacts(profile)
  const aiTrust = trust.data ?? 'unknown'
  const eff = effectiveTriage({ stored: row.triage_level, ai, confirmed: ex, redFlagLabels: row.red_flags, aiTrust })
  const changes = diffExtractions(ai, ex)
  const names = new Map(staff.map((s) => [s.user_id, s.full_name || 'a colleague']))
  const nameOf = (id: string | null) => (id ? (id === userId ? 'you' : names.get(id) ?? 'a colleague') : 'someone')
  const mySoap = notes.find((n) => n.kind === 'soap_draft' && n.author_id === userId)
  const flagLabels = [...new Set([...row.red_flags, ...(ex?.redFlags.map((f) => f.label) ?? []), ...(ai?.redFlags.map((f) => f.label) ?? [])])]
  const background = {
    allergies: [...new Set([...(ex?.allergies ?? []), ...facts.allergies])],
    conditions: [...new Set([...(ex?.pastMedicalHistory ?? []), ...facts.conditions])],
    medications: [...new Set([...(ex?.medications ?? []), ...facts.medications])],
  }
  const events = activity.map((a) => ({ a, text: describe(a, nameOf) })).filter((e): e is { a: AuditRow; text: string } => e.text !== null)

  return (
    <div className="space-y-5">
      <div>
        <Link to="/doctor/inbox" className="text-sm font-medium text-teal-700 hover:underline">Back to inbox</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{facts.name || 'Unnamed patient'}</h1>
            <p className="text-sm text-muted">{facts.age ?? '?'} y · {facts.sex ?? 'sex not stated'}{facts.bloodGroup ? ` · ${facts.bloodGroup}` : ''}{clinic ? ` · ${clinic.name}` : ''}{row.sent_at ? ` · sent ${formatWhen(row.sent_at)}` : ''}</p>
          </div>
          <div className="flex items-center gap-2"><TriageBadge level={eff.level} /><StatusBadge status={row.status} /></div>
        </div>
      </div>

      {flagLabels.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-surface border border-urgent bg-urgent-bg px-4 py-3 text-sm text-urgent">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div><p className="font-semibold">Red flags: {flagLabels.join(', ')}</p><p>Flagged by rules and the AI before the patient sent this case. Contact the patient promptly if they are not already in care.</p></div>
        </div>
      )}
      {eff.lowered && (
        <div role="alert" className="flex gap-3 rounded-surface border border-[#e8c98a] bg-soon-bg px-4 py-3 text-sm text-soon">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div><p className="font-semibold">Stored urgency ({row.triage_level}) is lower than the original assessment.</p><p>The badge above uses the higher value. Check the transcript below.</p></div>
        </div>
      )}
      {(aiTrust === 'invalid' || aiTrust === 'missing') && (
        <div role="alert" className="flex gap-3 rounded-surface border border-[#e8c98a] bg-soon-bg px-4 py-3 text-sm text-soon">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div><p className="font-semibold">{aiTrust === 'missing' ? 'No verified AI assessment is on record for this case.' : 'The stored AI assessment does not match what the server produced.'}</p>
            <p>It may have been edited or created outside the app. Do not rely on the urgency shown: read the transcript and contact the patient if in doubt.</p></div>
        </div>
      )}
      {row.status === 'info_requested' && row.info_request_note && <Callout tone="warn" title="You asked the patient:">{row.info_request_note}</Callout>}

      <ActionBar row={row} me={userId} staff={staff} ex={ex} facts={facts} soap={mySoap ? parseSoapText(mySoap.body) : null}
        clinicName={clinic?.name ?? null} urgency={eff.level} onChanged={data.reload} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Section title="Structured clinical view" hint="Patient-reported, AI-structured and confirmed by the patient. Not a diagnosis.">
            {ex ? <SummaryView ex={ex} /> : <p className="text-sm text-muted">The patient has not confirmed a structured summary.</p>}
          </Section>

          <Section title="Transcript and verification" hint="Check the AI summary against what the patient actually said.">
            <p className="text-xs text-muted">
              {row.transcript_source === 'voice' ? 'Dictated in the browser. Only the text was kept; no audio was stored.' : 'Typed by the patient.'}
            </p>
            <blockquote className="whitespace-pre-wrap rounded-control border-l-4 border-teal-500 bg-canvas p-4 text-sm leading-relaxed">{row.raw_transcript || 'No transcript.'}</blockquote>
            {ai && ex && (
              <div>
                <h3 className="text-sm font-semibold">Edits the patient made to the AI summary</h3>
                {changes.length === 0 ? <p className="mt-1 text-sm text-muted">None. The patient confirmed the AI summary as written.</p> : (
                  <ul className="mt-2 space-y-2">
                    {changes.map((c) => (
                      <li key={c.field} className="rounded-control border border-line p-3 text-sm">
                        <p className="font-medium">{c.field}</p>
                        <p className="mt-1 text-muted"><span className="font-medium text-ink">AI:</span> {c.before}</p>
                        <p className="text-muted"><span className="font-medium text-ink">Patient:</span> {c.after}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {ai && <details className="text-sm"><summary className="cursor-pointer font-semibold">Show the AI's original summary</summary><div className="mt-3"><SummaryView ex={ai} /></div></details>}
          </Section>

          <SoapPanel caseId={caseId} me={userId} notes={notes} onChanged={data.reload} ex={ex} facts={facts} />
          <NotesPanel caseId={caseId} me={userId} notes={notes} onChanged={data.reload} nameOf={(id) => nameOf(id)} />
        </div>

        <aside className="space-y-6">
          <Section title="Patient">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Allergies</dt><dd className="font-medium">{background.allergies.join(', ') || 'None reported'}</dd></div>
              <div><dt className="text-muted">Conditions</dt><dd className="font-medium">{background.conditions.join(', ') || 'None reported'}</dd></div>
              <div><dt className="text-muted">Medicines</dt><dd className="font-medium">{background.medications.join(', ') || 'None reported'}</dd></div>
              <div><dt className="text-muted">Emergency contact</dt><dd className="font-medium">{facts.emergencyContact ?? 'Not given'}</dd></div>
            </dl>
          </Section>
          {ex && ex.missingInformation.length > 0 && (
            <Section title="Open questions"><ul className="list-disc space-y-1 pl-5 text-sm">{ex.missingInformation.map((m) => <li key={m}>{m}</li>)}</ul></Section>
          )}
          <ChecklistPanel caseId={caseId} me={userId} notes={notes} onChanged={data.reload} ex={ex} />
          <Section title="Activity">
            <ul className="space-y-2 text-sm">
              {events.map(({ a, text }) => <li key={a.id} className="flex justify-between gap-3"><span>{text}</span><span className="shrink-0 text-xs text-muted">{formatWhen(a.created_at)}</span></li>)}
            </ul>
          </Section>
        </aside>
      </div>
    </div>
  )
}
