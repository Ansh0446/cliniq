import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CONSENT_EVENT, OPEN_SETTINGS_EVENT, analyticsConfig, readConsent, writeConsent, type Consent } from '@/lib/consent'

/**
 * ClinIQ itself only needs "essential" browser storage (it keeps you signed in).
 * Analytics, if configured, loads only after an explicit opt-in and never in signed-in areas.
 */
export function ConsentBanner() {
  const [ready, setReady] = useState(false)
  const [consent, setConsent] = useState<Consent | null>(null)
  const [forceOpen, setForceOpen] = useState(false)
  const cfg = analyticsConfig()

  useEffect(() => {
    setConsent(readConsent()); setReady(true)
    const sync = () => setConsent(readConsent())
    const open = () => setForceOpen(true)
    window.addEventListener(CONSENT_EVENT, sync)
    window.addEventListener(OPEN_SETTINGS_EVENT, open)
    return () => { window.removeEventListener(CONSENT_EVENT, sync); window.removeEventListener(OPEN_SETTINGS_EVENT, open) }
  }, [])

  if (!ready || (consent && !forceOpen)) return null
  const done = (analytics: boolean) => { writeConsent(analytics); setForceOpen(false) }

  return (
    <section aria-label="Privacy notice" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel p-4 shadow-lg print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed">
          {cfg
            ? 'ClinIQ stores only what it needs to keep you signed in. With your permission we also count visits to our public pages with privacy-friendly analytics. We never run analytics inside your account or on anything you tell us about your health.'
            : 'ClinIQ stores only what it needs to keep you signed in. There are no advertising or tracking cookies.'}{' '}
          <Link to="/privacy" className="font-semibold text-teal-700 underline">Privacy policy</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          {cfg ? (
            <>
              <Button variant="secondary" onClick={() => done(false)}>Essential only</Button>
              <Button onClick={() => done(true)}>Allow analytics</Button>
            </>
          ) : <Button onClick={() => done(false)}>OK</Button>}
        </div>
      </div>
    </section>
  )
}

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}>
      Cookie settings
    </button>
  )
}
