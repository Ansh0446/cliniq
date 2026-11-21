import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCsp, httpsRedirect, isLocalHost, securityHeaders } from './security'
import { buildRobots, buildSitemap, siteOrigin } from '../lib/seo'

test('plain http on a real host in production redirects to https, keeping path and query', () => {
  assert.equal(httpsRedirect({ proto: 'http', host: 'clin.example.com', pathAndQuery: '/login?redirect=%2Fapp', production: true }), 'https://clin.example.com/login?redirect=%2Fapp')
})

test('no redirect for https, localhost, development, or when switched off', () => {
  const base = { host: 'clin.example.com', pathAndQuery: '/', production: true }
  assert.equal(httpsRedirect({ ...base, proto: 'https' }), null)
  assert.equal(httpsRedirect({ ...base, proto: 'http', host: 'localhost:3000' }), null)
  assert.equal(httpsRedirect({ ...base, proto: 'http', host: '127.0.0.1:3000' }), null)
  assert.equal(httpsRedirect({ ...base, proto: 'http', production: false }), null)
  assert.equal(httpsRedirect({ ...base, proto: 'http', disabled: true }), null)
  assert.ok(isLocalHost('app.localhost:3000') && !isLocalhostLike('localhost.evil.com'))
})
const isLocalhostLike = (h: string) => isLocalHost(h)

test('headers: HSTS only over https; CSP mode is respected', () => {
  const csp = buildCsp({ SUPABASE_URL: 'https://abc.supabase.co' })
  const https = securityHeaders({ https: true, csp, cspMode: 'report-only' })
  assert.match(https['Strict-Transport-Security'] ?? '', /max-age=31536000/)
  assert.ok(https['Content-Security-Policy-Report-Only'] && !https['Content-Security-Policy'])
  assert.equal(https['X-Frame-Options'], 'DENY')
  assert.match(https['Permissions-Policy'] ?? '', /microphone=\(self\)/)
  assert.match(https['Permissions-Policy'] ?? '', /geolocation=\(self\)/)
  assert.equal(securityHeaders({ https: false, csp, cspMode: 'enforce' })['Strict-Transport-Security'], undefined)
  assert.ok(securityHeaders({ https: true, csp, cspMode: 'enforce' })['Content-Security-Policy'])
  const off = securityHeaders({ https: true, csp, cspMode: 'off' })
  assert.ok(!off['Content-Security-Policy'] && !off['Content-Security-Policy-Report-Only'])
})

test('CSP allows exactly the services the app uses, and nothing else', () => {
  const csp = buildCsp({ SUPABASE_URL: 'https://abc.supabase.co' })
  assert.match(csp, /connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /frame-src 'none'/)
  assert.ok(!/challenges\.cloudflare|plausible/.test(csp))
  const full = buildCsp({ SUPABASE_URL: 'https://abc.supabase.co', VITE_ANALYTICS_SRC: 'https://plausible.io/js/script.js', VITE_TURNSTILE_SITE_KEY: 'k' })
  assert.match(full, /script-src[^;]*https:\/\/plausible\.io[^;]*https:\/\/challenges\.cloudflare\.com/)
  assert.match(full, /frame-src https:\/\/challenges\.cloudflare\.com/)
})

test('sitemap and robots list public pages and hide private areas', () => {
  const xml = buildSitemap('https://clin.example.com')
  for (const p of ['https://clin.example.com/', 'https://clin.example.com/login', 'https://clin.example.com/privacy', 'https://clin.example.com/terms']) assert.ok(xml.includes(`<loc>${p}</loc>`), p)
  assert.ok(!xml.includes('/app') && !xml.includes('/doctor'))
  const robots = buildRobots('https://clin.example.com')
  for (const p of ['/app', '/doctor', '/clinic', '/operator']) assert.ok(robots.includes(`Disallow: ${p}`), p)
  assert.ok(robots.includes('Sitemap: https://clin.example.com/sitemap.xml'))
})

test('site origin prefers configuration, then proxy headers, then the request', () => {
  const req = (h: Record<string, string>) => new Request('http://internal:3000/x', { headers: h })
  assert.equal(siteOrigin(req({}), 'https://configured.example/'), 'https://configured.example')
  assert.equal(siteOrigin(req({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'clin.example.com' })), 'https://clin.example.com')
  assert.equal(siteOrigin(req({ host: 'internal:3000' })), 'http://internal:3000')
})
