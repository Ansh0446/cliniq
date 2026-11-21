import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Wordmark } from '@/components/wordmark'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/form'
import { acceptInvite } from '@/lib/clinic-admin'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/join')({
  head: () => privateHead('Join a clinic'),
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: typeof s.token === 'string' && /^[0-9a-f-]{36}$/i.test(s.token) ? s.token : undefined }),
  beforeLoad: async ({ location }) => {
    const { loadAuthState } = await import('@/lib/auth')
    const s = await loadAuthState()
    if (!s.session) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: Join,
})

function Join() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    if (!token) return
    setBusy(true); setError(null)
    try { await acceptInvite(token); await navigate({ to: '/doctor/inbox' }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not accept the invite.'); setBusy(false) }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Wordmark className="mb-8" />
      <h1 className="text-2xl font-bold">Join a clinic</h1>
      {token ? (
        <>
          <p className="mt-1 text-sm text-muted">Accepting gives you access to cases that patients send to this clinic. You must be signed in with the email address the invite was sent to.</p>
          {error && <Callout tone="danger" className="mt-4">{error}</Callout>}
          <Button size="lg" className="mt-6" onClick={accept} disabled={busy}>{busy ? 'Joining' : 'Accept invite'}</Button>
        </>
      ) : <Callout tone="warn" className="mt-4">This invite link is missing its code. Ask the clinic admin to send it again.</Callout>}
    </div>
  )
}
