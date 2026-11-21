import { useEffect } from 'react'
import { CONSENT_EVENT, analyticsConfig, readConsent } from '@/lib/consent'

const ID = 'cliniq-analytics'

/**
 * Adds a Plausible-compatible script only after consent. The exclusion list keeps
 * signed-in pages (which contain case IDs) out of analytics entirely. If you use a
 * different provider, check that it has an equivalent path-exclusion setting.
 */
export function AnalyticsLoader() {
  useEffect(() => {
    const cfg = analyticsConfig()
    if (!cfg) return
    const apply = () => {
      const existing = document.getElementById(ID)
      if (readConsent()?.analytics) {
        if (existing) return
        const s = document.createElement('script')
        s.id = ID; s.defer = true; s.src = cfg.src
        s.setAttribute('data-domain', cfg.domain)
        s.setAttribute('data-exclude', cfg.exclude)
        document.head.appendChild(s)
      } else if (existing) {
        existing.remove() // already-sent hits cannot be recalled; no new page loads will be counted
      }
    }
    apply()
    window.addEventListener(CONSENT_EVENT, apply)
    return () => window.removeEventListener(CONSENT_EVENT, apply)
  }, [])
  return null
}
