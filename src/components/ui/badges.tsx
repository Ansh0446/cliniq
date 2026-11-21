import { AlertOctagon, CheckCircle2, Clock3, FileEdit, MessageCircleQuestion, Send, Stethoscope, type LucideIcon } from 'lucide-react'
import { STATUS_LABEL, TRIAGE_LABEL, type CaseStatus, type TriageLevel } from '@/lib/clinical/constants'
import { cn } from '@/lib/cn'

const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold'

const TRIAGE_STYLE: Record<TriageLevel, string> = {
  urgent: 'bg-urgent-bg text-urgent',
  soon: 'bg-soon-bg text-soon',
  routine: 'bg-routine-bg text-routine',
}
const TRIAGE_ICON: Record<TriageLevel, LucideIcon> = { urgent: AlertOctagon, soon: Clock3, routine: CheckCircle2 }

/** Icon plus text, so urgency never depends on color alone. */
export function TriageBadge({ level, className }: { level: TriageLevel; className?: string }) {
  const Icon = TRIAGE_ICON[level]
  return (
    <span className={cn(base, TRIAGE_STYLE[level], className)}>
      <Icon className="size-3.5" aria-hidden /> {TRIAGE_LABEL[level]}
    </span>
  )
}

const STATUS_STYLE: Record<CaseStatus, string> = {
  draft: 'bg-canvas text-muted ring-1 ring-line',
  confirmed: 'bg-teal-50 text-teal-700',
  sent: 'bg-teal-100 text-teal-900',
  under_review: 'bg-teal-600 text-white',
  info_requested: 'bg-soon-bg text-soon',
  consultation_ready: 'bg-routine-bg text-routine',
}
const STATUS_ICON: Record<CaseStatus, LucideIcon> = {
  draft: FileEdit, confirmed: CheckCircle2, sent: Send,
  under_review: Stethoscope, info_requested: MessageCircleQuestion, consultation_ready: CheckCircle2,
}

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={cn(base, STATUS_STYLE[status], className)}>
      <Icon className="size-3.5" aria-hidden /> {STATUS_LABEL[status]}
    </span>
  )
}
