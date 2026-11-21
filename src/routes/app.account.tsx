import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Callout, Section } from '@/components/ui/form'
import { downloadFile } from '@/lib/browser'
import { deleteMyAccount, exportMyData } from '@/lib/data'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/app/account')({
  head: () => privateHead('Account'), component: Account })

function Account() {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportData() {
    setExporting(true); setExportError(null)
    try { downloadFile('cliniq-my-data.json', JSON.stringify(await exportMyData(), null, 2), 'application/json') }
    catch (e) { setExportError(e instanceof Error ? e.message : 'Could not export your data.') }
    finally { setExporting(false) }
  }

  async function remove() {
    setDeleting(true); setError(null)
    try { await deleteMyAccount(); router.history.push('/login') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete your account.'); setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Account</h1>

      <Section title="Download your data" hint="A JSON file with your health profile, every case you created, and the activity on each case.">
        {exportError && <Callout tone="danger">{exportError}</Callout>}
        <Button variant="secondary" onClick={exportData} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? 'Preparing' : 'Download my data'}</Button>
      </Section>

      <Section title="Delete your account">
        <Callout tone="danger" title="This cannot be undone">
          <p>Your profile and all of your cases are deleted, including cases you already sent to a clinic, which disappear from that clinic's inbox. Copies a clinic has already made in its own records are outside ClinIQ and are not affected.</p>
        </Callout>
        <Field id="confirm-delete" label='Type DELETE to confirm' value={confirmText} autoComplete="off" onChange={(e) => setConfirmText(e.target.value)} />
        {error && <Callout tone="danger">{error}</Callout>}
        <Button variant="danger" disabled={confirmText !== 'DELETE' || deleting} onClick={remove}><Trash2 className="size-4" aria-hidden /> {deleting ? 'Deleting' : 'Delete my account'}</Button>
      </Section>
    </div>
  )
}
