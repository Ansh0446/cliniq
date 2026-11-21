export interface Consent { analytics: boolean; decidedAt: string }
const KEY = 'cliniq:consent:v1'
export const CONSENT_EVENT = 'cliniq:consent-changed'

export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Consent>
    return typeof v.analytics === 'boolean' ? { analytics: v.analytics, decidedAt: String(v.decidedAt ?? '') } : null
  } catch { return null }
}

export function writeConsent(analytics: boolean): Consent {
  const c: Consent = { analytics, decidedAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* storage unavailable: the choice lasts for this page only */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: c }))
  return c
}

export function clearConsent(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }))
}

export const OPEN_SETTINGS_EVENT = 'cliniq:open-cookie-settings'

export interface AnalyticsConfig { src: string; domain: string; exclude: string }

/** Analytics is off unless a script URL is configured. Signed-in areas are always excluded. */
export function analyticsConfig(): AnalyticsConfig | null {
  const src = import.meta.env.VITE_ANALYTICS_SRC?.trim()
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN?.trim()
  if (!src || !domain) return null
  try { if (new URL(src).protocol !== 'https:') return null } catch { return null }
  const exclude = import.meta.env.VITE_ANALYTICS_EXCLUDE?.trim() || '/app/*,/doctor/*,/clinic/*,/operator/*,/join,/register-clinic'
  return { src, domain, exclude }
}
