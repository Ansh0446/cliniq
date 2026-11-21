import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppRole } from '@/lib/clinical/constants'
import { cn } from '@/lib/cn'
import { Button } from './ui/button'
import { Wordmark } from './wordmark'

export interface NavItem { to: string; label: string }

/** Shared frame for the three role areas. `wide` gives the clinician desktop layout. */
export function AppShell({ role, nav, wide, children }: { role: AppRole | 'operator'; nav: NavItem[]; wide?: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const signOut = async () => {
    const { getBrowserSupabase } = await import('@/lib/supabase')
    await getBrowserSupabase().auth.signOut()
    await navigate({ to: '/login', search: { redirect: undefined } })
  }
  const roleLabel = { patient: 'Patient', doctor: 'Clinician', clinic_admin: 'Clinic admin', operator: 'Operator' }[role]
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-panel print:hidden">
        {/* On a phone the navigation drops to its own scrollable row instead of overflowing. */}
        <div className={cn('mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0', wide ? 'max-w-7xl' : 'max-w-3xl')}>
          <Wordmark />
          <nav
            aria-label={`${roleLabel} navigation`}
            className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto pb-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:pb-0"
          >
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-control px-3 py-2 text-sm font-medium text-muted hover:bg-teal-50 hover:text-ink sm:py-1.5"
                activeProps={{ className: 'bg-teal-50 text-teal-700' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="hidden text-sm text-muted sm:inline">{roleLabel}</span>
          <Button variant="ghost" size="sm" className="ml-auto sm:ml-0" onClick={signOut}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>
      </header>
      <main className={cn('mx-auto px-4 py-8 print:max-w-none print:p-0', wide ? 'max-w-7xl' : 'max-w-3xl')}>{children}</main>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-surface border border-dashed border-line bg-panel px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}
