import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertOctagon } from 'lucide-react'
import { Wordmark } from '@/components/wordmark'
import { SiteFooter } from '@/components/site-footer'
import { buttonStyles } from '@/components/ui/button'
import { TriageBadge } from '@/components/ui/badges'
import { pageHead } from '@/lib/site'

export const Route = createFileRoute('/')({
  head: () => pageHead({ path: '/' }), component: Landing })

function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <Link to="/login" search={{ redirect: undefined }} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>Sign in</Link>
      </header>

      <section className="grid items-center gap-12 py-16 lg:grid-cols-[1fr_27rem] lg:py-24">
        <div>
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-teal-900 sm:text-5xl">
            Tell your clinic what is wrong before you walk in.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Speak or type your symptoms once. ClinIQ organises them into a clear summary you check and confirm, then sends it to the clinic you choose.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" search={{ redirect: undefined }} className={buttonStyles({ size: 'lg' })}>Start an intake</Link>
            <Link to="/login" search={{ redirect: undefined }} className={buttonStyles({ variant: 'secondary', size: 'lg' })}>Clinic sign in</Link>
            <Link to="/register-clinic" className={buttonStyles({ variant: 'ghost', size: 'lg' })}>Register your clinic</Link>
          </div>
          <p className="mt-6 max-w-lg text-sm text-muted">
            ClinIQ does not diagnose or recommend treatment. If you think you are having an emergency, call your local emergency number now.
          </p>
        </div>

        {/* A sample of the document the clinic receives */}
        <figure aria-label="Sample intake summary" className="rounded-surface border border-line bg-panel shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="text-sm font-semibold">Intake summary</span>
            <span className="text-xs text-muted">Sample</span>
          </div>
          <div className="space-y-4 px-5 py-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted">Chief complaint</p>
                <p className="font-semibold">Cough and fever for 4 days</p>
              </div>
              <TriageBadge level="soon" />
            </div>
            <div>
              <p className="text-muted">History of present illness</p>
              <p className="leading-relaxed">Dry cough began 4 days ago and is worse at night. Fever peaked at 38.9 °C on day 2. Mild wheeze since yesterday.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted">Reported</p>
                <ul className="mt-1 list-disc pl-4"><li>Night cough</li><li>Fever</li><li>Wheeze</li></ul>
              </div>
              <div>
                <p className="text-muted">Denies</p>
                <ul className="mt-1 list-disc pl-4"><li>Chest pain</li><li>Blood in sputum</li></ul>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-line bg-canvas px-5 py-3 text-xs text-muted">
            <AlertOctagon className="size-4 text-urgent" aria-hidden />
            Red-flag phrases such as chest pressure stop the intake and show emergency guidance.
          </div>
        </figure>
      </section>
      <SiteFooter />
    </div>
  )
}
