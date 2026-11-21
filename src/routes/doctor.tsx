import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/doctor')({
  head: () => privateHead('Doctor'),
  ssr: false,
  beforeLoad: async ({ location }) => {
    const s = await (await import('@/lib/auth')).guardRole('doctor', location)
    return { roles: s.roles, userId: s.session?.user.id ?? '' }
  },
  component: DoctorLayout,
})

function DoctorLayout() {
  const { roles } = Route.useRouteContext()
  const nav = [{ to: '/doctor/inbox', label: 'Inbox' }, ...(roles.includes('clinic_admin') ? [{ to: '/clinic/settings', label: 'Clinic settings' }] : [])]
  return <AppShell role="doctor" wide nav={nav}><Outlet /></AppShell>
}
