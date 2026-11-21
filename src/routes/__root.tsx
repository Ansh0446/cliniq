import type { ReactNode } from 'react'
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { AnalyticsLoader } from '@/components/analytics'
import { Wordmark } from '@/components/wordmark'
import { ConsentBanner } from '@/components/consent'
import { SiteFooter } from '@/components/site-footer'
import { buttonStyles } from '@/components/ui/button'
import { SITE, socialImage } from '@/lib/site'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#0d6866' },
      { title: `${SITE.name}: pre-visit intake for your clinic` },
      { name: 'description', content: SITE.description },
      { property: 'og:site_name', content: SITE.name },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: socialImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'ClinIQ: tell your clinic what is wrong before you walk in.' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: socialImage },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  component: () => (
    <RootDocument>
      <Outlet />
    </RootDocument>
  ),
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-6"><Wordmark /></div>
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm font-semibold text-teal-700">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">We could not find that page</h1>
        <p className="mt-3 text-muted">The address may be mistyped, or the page may have moved. If you followed a link inside ClinIQ, it may have expired.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className={buttonStyles({ size: 'lg' })}>Go to the home page</Link>
          <Link to="/login" search={{ redirect: undefined }} className={buttonStyles({ variant: 'secondary', size: 'lg' })}>Sign in</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <ConsentBanner />
        <AnalyticsLoader />
        <Scripts />
      </body>
    </html>
  )
}
