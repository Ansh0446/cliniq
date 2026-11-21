import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/clinic')({
  head: () => privateHead('Clinic'),
  ssr: false,
  beforeLoad: async ({ location }) => {
    const s = await (await import('@/lib/auth')).guardRole('clinic_admin', location)
    return { roles: s.roles, userId: s.session?.user.id ?? '', email: s.session?.user.email ?? '' }
  },
  component: ClinicLayout,
})

function ClinicLayout() {
  const { roles } = Route.useRouteContext()
  const nav = [{ to: '/clinic/settings', label: 'Settings' }, ...(roles.includes('doctor') ? [{ to: '/doctor/inbox', label: 'Doctor inbox' }] : [])]
  return <AppShell role="clinic_admin" wide nav={nav}><Outlet /></AppShell>
}
