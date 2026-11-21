export const SITEMAP_PATHS = ['/', '/login', '/privacy', '/terms'] as const
export const PRIVATE_PREFIXES = ['/app', '/doctor', '/clinic', '/operator', '/join', '/register-clinic'] as const

/** Public origin: configured address first, otherwise what the request says (honouring a proxy's forwarded headers). */
export function siteOrigin(request: Request, configured?: string): string {
  const fixed = configured?.trim().replace(/\/$/, '')
  if (fixed) return fixed
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || url.host
  return `${proto}://${host}`
}

export function buildSitemap(origin: string): string {
  const urls = SITEMAP_PATHS.map((p) => `  <url><loc>${origin}${p === '/' ? '' : p}${p === '/' ? '/' : ''}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function buildRobots(origin: string): string {
  return ['User-agent: *', 'Allow: /', ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`), '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n')
}
