#!/usr/bin/env node
// Pre-launch checks. Run after `npm run build`:  npm run launch-check
// Reads .env and the process environment. Exits 1 if any FAIL.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const env = { ...Object.fromEntries((existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })), ...process.env }

const rows = []
const add = (level, name, detail = '') => rows.push({ level, name, detail })
const ok = (n, d) => add('PASS', n, d), warn = (n, d) => add('WARN', n, d), fail = (n, d) => add('FAIL', n, d)

const jwtRole = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role } catch { return null } }

// ── Configuration
const url = env.VITE_SITE_URL
url && /^https:\/\/[^/\s]+$/.test(url) ? ok('Site URL is https', url) : fail('VITE_SITE_URL', 'set it to your public https address (no trailing slash); social previews and canonical links need it')
env.VITE_OPERATOR_NAME ? ok('Operator name set') : fail('VITE_OPERATOR_NAME', 'shown in the privacy policy and terms')
env.VITE_CONTACT_EMAIL && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.VITE_CONTACT_EMAIL) ? ok('Contact email set') : fail('VITE_CONTACT_EMAIL', 'needed for privacy requests')
env.VITE_LEGAL_REVIEWED === 'true' ? ok('Legal text marked as reviewed') : fail('VITE_LEGAL_REVIEWED', 'privacy policy and terms are drafts until a lawyer has reviewed them; then set it to true')
env.SUPABASE_URL?.startsWith('https://') ? ok('Supabase URL is https') : fail('SUPABASE_URL', 'missing or not https')
for (const k of ['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']) {
  const v = env[k]
  if (!v) fail(k, 'missing')
  else if (v.startsWith('sb_secret_') || jwtRole(v) === 'service_role') fail(k, 'this is a SERVICE/SECRET key. Use the publishable (anon) key here')
  else ok(`${k} is a public key`)
}
env.GEMINI_API_KEY ? ok('GEMINI_API_KEY set') : fail('GEMINI_API_KEY', 'AI summaries cannot work without it')
env.AI_SIGNING_SECRET && env.AI_SIGNING_SECRET.length >= 32 ? ok('AI_SIGNING_SECRET is 32+ characters') : warn('AI_SIGNING_SECRET', 'not set (or short); a key is derived from GEMINI_API_KEY. Set 32+ random characters')
if (env.GEMINI_MODEL) ok('GEMINI_MODEL', `${env.GEMINI_MODEL} (confirm this ID exists in Google AI Studio)`); else warn('GEMINI_MODEL', 'defaults to gemini-2.5-flash')
env.FORCE_HTTPS === 'false' ? fail('FORCE_HTTPS=false', 'HTTP-to-HTTPS redirect is off') : ok('HTTPS redirect active in production')
env.CSP_MODE === 'enforce' ? ok('CSP enforced') : warn('CSP_MODE', `"${env.CSP_MODE || 'report-only'}": browse the app with DevTools open, fix any CSP violations, then set CSP_MODE=enforce`)
env.VITE_TURNSTILE_SITE_KEY ? ok('Turnstile site key set', 'also enable CAPTCHA in Supabase Auth with the matching secret') : warn('VITE_TURNSTILE_SITE_KEY', 'no CAPTCHA; sign-up spam relies on Supabase rate limits, the honeypot and per-user limits')
if (env.VITE_ANALYTICS_SRC) env.VITE_ANALYTICS_DOMAIN ? ok('Analytics configured', 'opt-in only, public pages only') : fail('VITE_ANALYTICS_DOMAIN', 'needed with VITE_ANALYTICS_SRC')
else ok('Analytics not configured', 'nothing is tracked')

// ── Built output
const out = '.output/public'
if (!existsSync(out)) { fail('Build output', 'run `npm run build` first') } else {
  const files = []
  const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p) })
  walk(out)
  const text = files.filter((f) => /\.(js|css|html|json|webmanifest|svg|txt|xml|map)$/.test(f))
  const secrets = []
  const known = [env.GEMINI_API_KEY, env.AI_SIGNING_SECRET].filter((v) => v && v.length >= 12)
  for (const f of text) {
    const s = readFileSync(f, 'utf8')
    for (const v of known) if (s.includes(v)) secrets.push(`${f}: contains a server secret value`)
    if (/AIza[0-9A-Za-z_-]{35}/.test(s)) secrets.push(`${f}: looks like a Google API key`)
    if (/sk-[A-Za-z0-9]{20,}/.test(s)) secrets.push(`${f}: looks like a secret API key`)
    if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(s)) secrets.push(`${f}: contains a Supabase secret key`)
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) secrets.push(`${f}: contains a private key`)
    for (const m of s.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) if (jwtRole(m[0]) === 'service_role') secrets.push(`${f}: contains a service_role token`)
    if (/GEMINI_API_KEY|AI_SIGNING_SECRET/.test(s)) secrets.push(`${f}: mentions a server-only variable name`)
  }
  secrets.length ? secrets.forEach((x) => fail('Secret in browser bundle', x)) : ok('No secrets in the browser bundle', `${text.length} files scanned`)

  const jsAll = text.filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n')
  const left = [...new Set([...jsAll.matchAll(/\[(?:DATE|ADDRESS[^\]]*|OPERATOR[^\]]*|HOSTING[^\]]*|ANALYTICS[^\]]*|GRIEVANCE[^\]]*|NAME|JURISDICTION|REGION|CONTACT[^\]]*)\]/g)].map((m) => m[0]))]
  left.length ? fail('Legal placeholders remain', `${left.length} in the privacy policy / terms source: ${left.slice(0, 6).join(' ')}${left.length > 6 ? ' ...' : ''}`) : ok('No [BRACKETED] placeholders left in the legal text')

  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og.png', 'site.webmanifest']) existsSync(join(out, f)) ? ok(`Public file ${f}`) : fail(`Missing ${f}`)
  const og = existsSync(join(out, 'og.png')) ? statSync(join(out, 'og.png')).size : 0
  og && og < 300_000 ? ok('Social image size', `${(og / 1024).toFixed(0)} KB`) : warn('Social image', og ? `${(og / 1024).toFixed(0)} KB is large` : 'missing')

  const js = files.filter((f) => /\.js$/.test(f)).map((f) => ({ f, raw: statSync(f).size, gz: gzipSync(readFileSync(f)).length }))
  const biggest = [...js].sort((a, b) => b.raw - a.raw)[0]
  ok('Largest script', `${biggest.f.split('/').pop()} ${(biggest.raw / 1024).toFixed(0)} KB raw / ${(biggest.gz / 1024).toFixed(0)} KB gzip`)
  files.some((f) => f.endsWith('.br')) ? ok('Assets are pre-compressed (brotli + gzip)') : warn('Compression', 'no .br files; enable compressPublicAssets or compress at your proxy')
}

// ── Report
const icon = { PASS: '✔', WARN: '!', FAIL: '✘' }
for (const r of rows) console.log(`${icon[r.level]} ${r.level}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
const f = rows.filter((r) => r.level === 'FAIL').length, w = rows.filter((r) => r.level === 'WARN').length
console.log(`\n${rows.length - f - w} passed, ${w} warnings, ${f} failures`)
process.exit(f ? 1 : 0)
