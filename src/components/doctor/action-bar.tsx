import { ClipboardCopy, Download, FileJson, Printer, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, buttonStyles } from '@/components/ui/button'
import { Callout, SelectField, TextArea } from '@/components/ui/form'
import { Modal } from '@/components/ui/modal'
import { copyText, downloadFile } from '@/lib/browser'
import type { CaseRow } from '@/lib/intake'
import { assignCase, markReviewed, requestInfo, setStatus, type StaffMember } from '@/lib/doctor/data'
import { ehrNote, type EhrStyle, type PatientFacts, type Soap } from '@/lib/doctor/note-text'
import { toFhirDraft } from '@/lib/doctor/fhir'
import type { ClinicalExtraction } from '@/lib/clinical/schemas'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

export interface ActionBarProps {
  row: CaseRow
  me: string
  staff: StaffMember[]
  ex: ClinicalExtraction | null
  facts: PatientFacts
  soap: Soap | null
  clinicName: string | null
  urgency: string
  onChanged: () => void
}

export function ActionBar({ row, me, staff, ex, facts, soap, clinicName, urgency, onChanged }: ActionBarProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const [style, setStyle] = useState<EhrStyle>('sectioned')
  const [copied, setCopied] = useState(false)
  const doctors = staff.filter((s) => s.is_doctor)
  const status = row.status

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn(); onChanged() } catch (e) { setError(msg(e)) } finally { setBusy(false) }
  }
  const startReview = () => run(() => setStatus(row.id, 'under_review'))
  const ready = () => run(async () => { if (status === 'sent') await setStatus(row.id, 'under_review'); await setStatus(row.id, 'consultation_ready') })
  const reviewed = () => run(() => markReviewed(row.id))
  const assign = (id: string) => { if (id) void run(() => assignCase(row.id, id)) }
  const ask = () => run(async () => { await requestInfo(row.id, note); setNote(''); setAskOpen(false) })

  const when = new Date(row.confirmed_at ?? row.updated_at).toLocaleDateString()
  async function copyEhr() {
    if (!ex) return
    const ok = await copyText(ehrNote(style, ex, facts, { soap, when, clinic: clinicName }))
    setCopied(ok); if (!ok) setError('Copy was blocked by the browser.')
    setTimeout(() => setCopied(false), 2500)
  }
  const fileBase = `cliniq-${row.id.slice(0, 8)}`
  function exportJson() {
    if (!ex) return
    downloadFile(`${fileBase}.json`, JSON.stringify({ caseId: row.id, confirmedAt: row.confirmed_at, clinic: clinicName, patient: facts, summary: ex, effectiveUrgency: urgency, originalTranscript: row.raw_transcript, soapDraft: soap }, null, 2), 'application/json')
  }
  function exportFhir() {
    if (!ex) return
    downloadFile(`${fileBase}.fhir-draft.json`, JSON.stringify(toFhirDraft({ caseId: row.id, patientId: row.patient_id, confirmedAt: row.confirmed_at ?? row.updated_at, ex, patient: facts, clinicName }), null, 2), 'application/fhir+json')
  }

  return (
    <div className="space-y-3 rounded-surface border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'sent' && <Button onClick={startReview} disabled={busy}>Start review</Button>}
        {status === 'info_requested' && <Button variant="secondary" onClick={startReview} disabled={busy}>Resume review</Button>}
        {(status === 'sent' || status === 'under_review') && <Button variant="secondary" onClick={() => setAskOpen(true)} disabled={busy}>Request additional info</Button>}
        {(status === 'sent' || status === 'under_review') && <Button variant="secondary" onClick={ready} disabled={busy}>Ready for consult</Button>}
        {status !== 'consultation_ready' && <Button variant="secondary" onClick={reviewed} disabled={busy || Boolean(row.reviewed_at)}><UserCheck className="size-4" aria-hidden /> {row.reviewed_at ? 'Reviewed' : 'Mark as reviewed'}</Button>}
        {status === 'info_requested' && <span className="text-sm text-muted">Waiting for the patient to reply.</span>}
        {doctors.length > 0 && (
          <div className="ml-auto w-56">
            <SelectField id="assign" label="Assigned to" value={row.assigned_doctor_id ?? ''} disabled={busy || status === 'consultation_ready'} onChange={(e) => assign(e.target.value)}
              options={[{ value: '', label: 'Unassigned' }, ...doctors.map((d) => ({ value: d.user_id, label: d.user_id === me ? `${d.full_name || 'Me'} (me)` : d.full_name || 'Colleague' }))]} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-sm font-medium">Copy for EHR</span>
        <select aria-label="EHR note style" value={style} onChange={(e) => setStyle(e.target.value as EhrStyle)} className="h-9 rounded-control border border-control bg-panel px-2 text-sm">
          <option value="sectioned">Sectioned (Epic / Cerner)</option><option value="compact">Compact (Athena)</option>
        </select>
        <Button variant="secondary" size="sm" onClick={copyEhr} disabled={!ex}><ClipboardCopy className="size-4" aria-hidden /> {copied ? 'Copied' : 'Copy note'}</Button>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <span className="text-sm font-medium">Export</span>
        <Link to="/doctor/cases/$caseId/print" params={{ caseId: row.id }} className={buttonStyles({ variant: 'secondary', size: 'sm' })}><Printer className="size-4" aria-hidden /> PDF</Link>
        <Button variant="secondary" size="sm" onClick={exportJson} disabled={!ex}><Download className="size-4" aria-hidden /> JSON</Button>
        <Button variant="secondary" size="sm" onClick={exportFhir} disabled={!ex}><FileJson className="size-4" aria-hidden /> FHIR draft</Button>
      </div>
      {error && <Callout tone="danger">{error}</Callout>}

      <Modal open={askOpen} title="Request additional information" onClose={() => setAskOpen(false)}>
        <p className="text-sm text-muted">The patient sees this message on their case and can add details and send it back. Ask only for what you need.</p>
        <TextArea id="ask" aria-label="What do you need to know?" className="min-h-28" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: How high did the fever get, and are you taking any blood thinners?" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAskOpen(false)}>Cancel</Button>
          <Button disabled={busy || !note.trim()} onClick={ask}>Send request</Button>
        </div>
      </Modal>
    </div>
  )
}
