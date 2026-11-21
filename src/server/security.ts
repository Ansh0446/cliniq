/** Pure helpers for HTTPS enforcement and response headers, kept separate so they can be unit tested. */

export function isLocalHost(host: string): boolean {
  const h = host.replace(/:\d+$/, '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')
}

/** Returns the https address to redirect to, or null if the request is fine. */
export function httpsRedirect(opts: { proto: string; host: string; pathAndQuery: string; production: boolean; disabled?: boolean }): string | null {
  if (!opts.production || opts.disabled) return null
  if (opts.proto !== 'http' || isLocalHost(opts.host)) return null
  return `https://${opts.host}${opts.pathAndQuery}`
}

const origin = (u: string | undefined): string | null => {
  try { return u ? new URL(u).origin : null } catch { return null }
}

export function buildCsp(env: Record<string, string | undefined>): string {
  const supabase = origin(env.SUPABASE_URL)
  const wss = supabase ? supabase.replace(/^https:/, 'wss:') : null
  const analytics = origin(env.VITE_ANALYTICS_SRC)
  const turnstile = env.VITE_TURNSTILE_SITE_KEY ? 'https://challenges.cloudflare.com' : null
  const list = (...xs: (string | null)[]) => xs.filter(Boolean).join(' ')
  return [
    "default-src 'self'",
    // TanStack Start streams small inline bootstrap scripts, so 'unsafe-inline' is needed until nonces are added.
    `script-src ${list("'self'", "'unsafe-inline'", analytics, turnstile)}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${list("'self'", supabase, wss, analytics)}`,
    `frame-src ${turnstile ?? "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ')
}

export function securityHeaders(opts: { https: boolean; csp: string; cspMode: string }): Record<string, string> {
  const h: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Dictation needs the microphone and the clinic finder needs location, both only for ClinIQ itself.
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  }
  if (opts.https) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  if (opts.cspMode === 'enforce') h['Content-Security-Policy'] = opts.csp
  else if (opts.cspMode !== 'off') h['Content-Security-Policy-Report-Only'] = opts.csp
  return h
}
