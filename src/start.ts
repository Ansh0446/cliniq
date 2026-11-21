import { createMiddleware, createStart } from '@tanstack/react-start'
import { buildCsp, httpsRedirect, securityHeaders } from '@/server/security'

/**
 * Runs on every request in production: sends visitors from http to https, and adds
 * security headers. Behind a proxy or load balancer, make sure it sets X-Forwarded-Proto.
 * CSP_MODE: "report-only" (default, only logs violations in the browser console),
 * "enforce", or "off". Set FORCE_HTTPS=false to turn the redirect off.
 */
const security = createMiddleware().server(async ({ next, request }) => {
  if (process.env.NODE_ENV !== 'production') return next()
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || url.host

  const target = httpsRedirect({ proto, host, pathAndQuery: `${url.pathname}${url.search}`, production: true, disabled: process.env.FORCE_HTTPS === 'false' })
  if (target) return new Response(null, { status: 308, headers: { location: target } }) as never

  const { setResponseHeader } = await import('@tanstack/react-start/server')
  const headers = securityHeaders({ https: proto === 'https', csp: buildCsp(process.env), cspMode: process.env.CSP_MODE || 'report-only' })
  for (const [k, v] of Object.entries(headers)) setResponseHeader(k, v)
  return next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [security] }))
