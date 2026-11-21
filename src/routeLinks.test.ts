import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Every internal link written in the source must point at a real route or a real file in /public. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) && !/\.(test|gen)\./.test(f) ? [p] : []
  })
}

const tree = readFileSync('src/routeTree.gen.ts', 'utf8')
const fullPaths = [...tree.matchAll(/interface FileRoutesByFullPath \{([\s\S]*?)\n\}/g)][0]?.[1] ?? ''
const patterns = [...fullPaths.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]!)
const toRegex = (p: string) => new RegExp(`^${p.replace(/\$[A-Za-z]+/g, '[^/]+').replace(/\/$/, '')}/?$`)
const routeRegexes = patterns.map(toRegex)

const STATIC = /\.(png|svg|ico|webmanifest|xml|txt|json|css|js|map|jpe?g|webp)$/i
const IGNORE = [/^\/\//, /^\/_/, /^\/auth\/v1/, /^\/rest\//, /^\/v1\//]

test('route tree was read', () => assert.ok(patterns.length > 15, `found ${patterns.length} routes`))

test('every internal link in the source resolves to a route or a public file', () => {
  const found: { file: string; link: string }[] = []
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf8')
    // Quoted or template strings that look like an in-app path: '/app/...', `/app/cases/${id}/review`
    for (const m of src.matchAll(/(['"`])(\/[A-Za-z][A-Za-z0-9_\-./${}]*)\1/g)) {
      const raw = m[2]!.replace(/\$\{[^}]*\}/g, '$id').split(/[?#]/)[0]!
      if (IGNORE.some((r) => r.test(raw))) continue
      // Skip import specifiers and non-link strings (they have no leading route segment we serve)
      if (!/^\/(app|doctor|clinic|operator|login|join|privacy|terms|register-clinic|robots\.txt|sitemap\.xml|favicon|apple-touch|icon-|og\.png|site\.webmanifest)/.test(raw) && raw !== '/') continue
      found.push({ file, link: raw })
    }
  }
  assert.ok(found.length > 40, `expected many links, found ${found.length}`)
  const isRoute = (link: string) => routeRegexes.some((r) => r.test(link)) || routeRegexes.some((r) => r.test(link.replace(/\$id/g, 'abc')))
  const isFile = (link: string) => STATIC.test(link) && existsSync(join('public', link))
  const broken = found.filter(({ link }) => !isRoute(link) && !isFile(link))
  assert.deepEqual(broken, [], `broken links: ${JSON.stringify(broken, null, 1)}`)
})

test('public files referenced by the page head exist', () => {
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.png', 'site.webmanifest']) assert.ok(existsSync(join('public', f)), f)
})
