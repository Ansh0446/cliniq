import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { EmptyState } from '@/components/app-shell'
import { StatusBadge, TriageBadge } from '@/components/ui/badges'
import { buttonStyles } from '@/components/ui/button'
import { Callout, Spinner } from '@/components/ui/form'
import { formatWhen } from '@/lib/clinical/display'
import { getProfile, listCases, subscribeToCases, type CaseListItem } from '@/lib/data'
import { casePath, resumeStep } from '@/lib/intake'
import { useAsync } from '@/lib/hooks/use-async'
import { privateHead } from '@/lib/site'
import { AskAssistantButton } from '@/components/assistant/ask-button'

export const Route = createFileRoute('/app/')({
  head: () => privateHead('My cases'), component: Dashboard })

function Dashboard() {
  const cases = useAsync(listCases, [])
  const profile = useAsync(getProfile, [])
  useEffect(() => subscribeToCases(cases.reload), [cases.reload])

  const profileIncomplete = profile.data !== null && (!profile.data.dob || !profile.data.sex)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My cases</h1>
        <Link to="/app/intake/$caseId" params={{ caseId: 'new' }} className={buttonStyles({ size: 'lg' })}>
          <Plus className="size-5" aria-hidden /> Start a new intake
        </Link>
      </div>
      <p className="-mt-3 text-sm text-muted">
        Not sure where to start?{' '}
        <AskAssistantButton prompt="Help me describe my symptoms">Let the assistant ask you a few questions</AskAssistantButton>
      </p>

      {profileIncomplete && (
        <Callout tone="info" title="Complete your health profile">
          Your date of birth, allergies and medicines fill in automatically every time you start an intake.{' '}
          <Link to="/app/profile" className="font-semibold underline">Set it up</Link>
        </Callout>
      )}

      {cases.loading && !cases.data && <Spinner label="Loading your cases" />}
      {cases.error && <Callout tone="danger" title="Could not load your cases">{cases.error}</Callout>}

      {cases.data && cases.data.length === 0 && (
        <EmptyState title="No cases yet">
          Start an intake to describe your symptoms. You review and confirm everything before any clinic sees it.
        </EmptyState>
      )}

      <ul className="space-y-3">{cases.data?.map((c) => <CaseCard key={c.id} c={c} />)}</ul>
    </div>
  )
}

function CaseCard({ c }: { c: CaseListItem }) {
  const step = resumeStep(c)
  const action = c.status === 'draft' ? 'Resume' : c.status === 'confirmed' ? 'Choose a clinic' : c.status === 'info_requested' ? 'Reply to clinic' : 'View'
  return (
    <li>
      <Link to={casePath(c.id, step)} className="flex items-center gap-4 rounded-surface border border-line bg-panel p-4 transition-colors hover:border-teal-500">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate font-semibold">{c.chief_complaint || 'Intake not described yet'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            {c.triage_level && <TriageBadge level={c.triage_level} />}
            <span className="text-xs text-muted">Updated {formatWhen(c.updated_at)}</span>
          </div>
        </div>
        <span className="hidden items-center gap-1 text-sm font-semibold text-teal-700 sm:inline-flex">{action}<ChevronRight className="size-4" aria-hidden /></span>
        <ChevronRight className="size-5 text-muted sm:hidden" aria-hidden />
      </Link>
    </li>
  )
}
