import type { ReactNode } from 'react'
import { Wordmark } from './wordmark'
import { SiteFooter } from './site-footer'
import { Callout } from './ui/form'
import { SITE, placeholder } from '@/lib/site'

export const operator = () => placeholder(SITE.operatorName, 'OPERATOR NAME')
export const contact = () => placeholder(SITE.contactEmail, 'CONTACT EMAIL')
export const grievance = () => placeholder(SITE.grievanceEmail, 'GRIEVANCE OFFICER EMAIL')

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-6"><Wordmark /></div>
      <main className="mx-auto max-w-3xl px-4 pb-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated: {updated}</p>
        {!SITE.legalReviewed && (
          <Callout tone="warn" title="Draft, not yet reviewed by a lawyer" className="mt-5">
            This text was written from how ClinIQ actually handles data, but it is not legal advice. Before launch, have it reviewed for your jurisdiction, fill in every [BRACKETED] detail, then set VITE_LEGAL_REVIEWED=true to remove this notice.
          </Callout>
        )}
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
