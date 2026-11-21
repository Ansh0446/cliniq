import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AssistantWidget } from '@/components/assistant/assistant'
import { AppShell } from '@/components/app-shell'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/app')({
  head: () => privateHead('My account'),
  ssr: false, // the session lives in the browser
  beforeLoad: async ({ location }) => (await import('@/lib/auth')).guardRole('patient', location),
  component: () => (
    <>
      <AppShell role="patient" nav={[{ to: '/app', label: 'My cases' }, { to: '/app/profile', label: 'Health profile' }, { to: '/app/account', label: 'Account' }]}>
        <Outlet />
      </AppShell>
      <AssistantWidget />
    </>
  ),
})
