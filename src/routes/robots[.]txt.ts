import { createFileRoute } from '@tanstack/react-router'
import { buildRobots, siteOrigin } from '@/lib/seo'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(buildRobots(siteOrigin(request, process.env.SITE_URL || process.env.VITE_SITE_URL)), {
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
        }),
    },
  },
})
