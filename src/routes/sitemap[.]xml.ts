import { createFileRoute } from '@tanstack/react-router'
import { buildSitemap, siteOrigin } from '@/lib/seo'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(buildSitemap(siteOrigin(request, process.env.SITE_URL || process.env.VITE_SITE_URL)), {
          headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
        }),
    },
  },
})
