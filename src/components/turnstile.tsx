import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
export const captchaEnabled = Boolean(SITE_KEY)

interface TurnstileApi {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true; s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { loading = null; reject(new Error('Could not load the human check')) }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Cloudflare Turnstile human check. Renders nothing unless VITE_TURNSTILE_SITE_KEY is set.
 * Also switch CAPTCHA on in Supabase (Authentication, Attack protection) with the matching secret.
 * Change `resetKey` to get a fresh challenge after a failed attempt.
 */
export function Turnstile({ onToken, onError, resetKey }: { onToken: (t: string) => void; onError: (m: string) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!SITE_KEY || !box.current) return
    let id: string | undefined
    let cancelled = false
    onToken('')
    loadScript().then(() => {
      if (cancelled || !box.current || !window.turnstile) return
      id = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        callback: (t) => onToken(t),
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); onError('The human check failed to load. Check your connection and try again.') },
      })
    }).catch((e: unknown) => onError(e instanceof Error ? e.message : 'The human check could not load.'))
    return () => { cancelled = true; if (id) window.turnstile?.remove(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])
  if (!SITE_KEY) return null
  return <div ref={box} className="min-h-[65px]" aria-label="Human check" />
}
