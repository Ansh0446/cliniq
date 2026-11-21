import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Wordmark } from '@/components/wordmark'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Callout } from '@/components/ui/form'
import { registerClinic } from '@/lib/clinic-admin'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/register-clinic')({
  head: () => privateHead('Register your clinic'),
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { loadAuthState } = await import('@/lib/auth')
    const s = await loadAuthState()
    if (!s.session) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: RegisterClinic,
})

function RegisterClinic() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try { await registerClinic(name); await navigate({ to: '/clinic/settings' }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not register the clinic.'); setBusy(false) }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Wordmark className="mb-8" />
      <h1 className="text-2xl font-bold">Register your clinic</h1>
      <p className="mt-1 text-sm text-muted">You become the clinic's admin. You can add doctors, set specialties and hours next. Patients can find the clinic once a platform operator verifies it.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field id="clinic-name" label="Clinic name" value={name} maxLength={120} required onChange={(e) => setName(e.target.value)} />
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" className="w-full" disabled={busy || name.trim().length < 2}>{busy ? 'Registering' : 'Register clinic'}</Button>
      </form>
    </div>
  )
}
