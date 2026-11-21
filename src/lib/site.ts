const clean = (v: string | undefined) => v?.trim() || ''

export const SITE = {
  name: 'ClinIQ',
  url: clean(import.meta.env.VITE_SITE_URL).replace(/\/$/, ''),
  operatorName: clean(import.meta.env.VITE_OPERATOR_NAME),
  contactEmail: clean(import.meta.env.VITE_CONTACT_EMAIL),
  grievanceEmail: clean(import.meta.env.VITE_GRIEVANCE_EMAIL) || clean(import.meta.env.VITE_CONTACT_EMAIL),
  legalReviewed: clean(import.meta.env.VITE_LEGAL_REVIEWED) === 'true',
  tagline: 'Tell your clinic what is wrong before you walk in.',
  description:
    'Describe your symptoms once by voice or text, check the summary, and send it to your clinic before your visit. ClinIQ does not diagnose or recommend treatment.',
} as const

/** Shown in the policies until the operator fills in their details. */
export const placeholder = (value: string, label: string) => value || `[${label}]`

export const PUBLIC_PATHS = ['/', '/login', '/privacy', '/terms'] as const

const abs = (path: string) => (SITE.url ? `${SITE.url}${path}` : path)

/** Head tags for a page that search engines may index. */
export function pageHead(opts: { title?: string; description?: string; path: string }) {
  const title = opts.title ? `${opts.title} · ${SITE.name}` : `${SITE.name}: pre-visit intake for your clinic`
  const description = opts.description ?? SITE.description
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: abs(opts.path) },
    ],
    links: SITE.url ? [{ rel: 'canonical', href: abs(opts.path) }] : [],
  }
}

/** Head tags for signed-in areas: a title, and a request not to be indexed. */
export function privateHead(title: string) {
  return { meta: [{ title: `${title} · ${SITE.name}` }, { name: 'robots', content: 'noindex, nofollow' }] }
}

export const socialImage = abs('/og.png')
