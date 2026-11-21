import { createFileRoute, redirect } from '@tanstack/react-router'
import { BadgeCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Callout, Spinner } from '@/components/ui/form'
import { listOperatorClinics, setClinicVerified, type OperatorClinic } from '@/lib/operator'
import { useAsync } from '@/lib/hooks/use-async'
import { SPECIALTIES } from '@/lib/clinical/constants'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/operator')({
  head: () => privateHead('Clinic verification'),
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { homeFor, loadAuthState } = await import('@/lib/auth')
    const { isOperator } = await import('@/lib/operator')
    const s = await loadAuthState()
    if (!s.session) throw redirect({ to: '/login', search: { redirect: location.href } })
    if (!(await isOperator())) throw redirect({ to: homeFor(s.roles) })
  },
  component: Operator,
})

const spec = (slug: string) => SPECIALTIES.find((s) => s.slug === slug)?.label ?? slug

function Operator() {
  const clinics = useAsync(listOperatorClinics, [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(c: OperatorClinic) {
    if (c.verified && !window.confirm(`Remove verification from ${c.name}? Patients will stop seeing it.`)) return
    setBusy(c.id); setError(null)
    try { await setClinicVerified(c.id, !c.verified); clinics.reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update the clinic.') }
    finally { setBusy(null) }
  }

  const list = clinics.data ?? []
  const pending = list.filter((c) => !c.verified).length

  return (
    <AppShell role="operator" wide nav={[{ to: '/operator', label: 'Clinic verification' }]}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Clinic verification</h1>
          <p className="text-sm text-muted">{pending} waiting · {list.length - pending} verified. Contact the clinic admin and check the clinic is real before verifying it: patients are shown verified clinics only.</p>
        </div>
        {clinics.loading && !clinics.data && <Spinner label="Loading clinics" />}
        {clinics.error && <Callout tone="danger">{clinics.error}</Callout>}
        {error && <Callout tone="danger">{error}</Callout>}
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="rounded-surface border border-line bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{c.name} {c.verified ? <span className="ml-2 rounded-full bg-routine-bg px-2 py-0.5 text-xs font-semibold text-routine">Verified</span> : <span className="ml-2 rounded-full bg-soon-bg px-2 py-0.5 text-xs font-semibold text-soon">Waiting</span>}</p>
                  <p className="text-sm text-muted">{c.address || 'No address'}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}</p>
                  <p className="text-sm">Admin: {c.admin_name || 'Unnamed'}{c.admin_email ? ` (${c.admin_email})` : ''}</p>
                  <p className="text-xs text-muted">{c.doctor_count} doctor{c.doctor_count === 1 ? '' : 's'} · {c.case_count} case{c.case_count === 1 ? '' : 's'} · registered {new Date(c.created_at).toLocaleDateString()}{c.specialties.length ? ` · ${c.specialties.slice(0, 4).map(spec).join(', ')}` : ''}</p>
                </div>
                <Button variant={c.verified ? 'secondary' : 'primary'} size="sm" disabled={busy === c.id} onClick={() => void toggle(c)}>
                  {c.verified ? <><ShieldOff className="size-4" aria-hidden /> Remove verification</> : <><BadgeCheck className="size-4" aria-hidden /> Verify clinic</>}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  )
}
