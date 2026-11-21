import { Link } from '@tanstack/react-router'
import { CookieSettingsButton } from './consent'

export function SiteFooter() {
  const link = 'text-sm text-muted underline-offset-2 hover:text-ink hover:underline'
  return (
    <footer className="mt-16 border-t border-line py-8 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted">ClinIQ prepares information for your clinic. It does not diagnose or recommend treatment. In an emergency call 112 or 911.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privacy" className={link}>Privacy policy</Link>
          <Link to="/terms" className={link}>Terms</Link>
          <CookieSettingsButton className={link} />
        </nav>
      </div>
    </footer>
  )
}
