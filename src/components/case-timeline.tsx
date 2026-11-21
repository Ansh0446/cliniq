import { Check, MessageCircleQuestion } from 'lucide-react'
import type { CaseStatus } from '@/lib/clinical/constants'
import { STATUS_LABEL } from '@/lib/clinical/constants'
import { formatWhen } from '@/lib/clinical/display'
import type { AuditRow } from '@/lib/data'
import { cn } from '@/lib/cn'

const MAIN: CaseStatus[] = ['draft', 'confirmed', 'sent', 'under_review', 'consultation_ready']

/** When each status was first reached, from the audit trail. */
function reachedAt(activity: AuditRow[], created: string): Partial<Record<CaseStatus, string>> {
  const at: Partial<Record<CaseStatus, string>> = { draft: created }
  for (const a of activity) {
    if (a.action === 'status_change' && a.to_value && !(a.to_value in at)) at[a.to_value as CaseStatus] = a.created_at
  }
  return at
}

export function CaseTimeline({ status, createdAt, activity, clinicName }: {
  status: CaseStatus; createdAt: string; activity: AuditRow[]; clinicName?: string | null
}) {
  const at = reachedAt(activity, createdAt)
  const awaiting = status === 'info_requested'
  // A case waiting on the patient sits between "sent" and "under review".
  const currentIndex = awaiting ? MAIN.indexOf('sent') : MAIN.indexOf(status)

  return (
    <ol aria-label="Case progress" className="space-y-0">
      {MAIN.map((s, i) => {
        const current = i === currentIndex
        const done = i < currentIndex || (current && !awaiting && status === 'consultation_ready')
        const last = i === MAIN.length - 1
        return (
          <li key={s} className="relative flex gap-3 pb-6 last:pb-0" aria-current={current && !awaiting ? 'step' : undefined}>
            {!last && <span aria-hidden className={cn('absolute left-[0.8125rem] top-7 h-[calc(100%-1.5rem)] w-0.5', i < currentIndex ? 'bg-teal-500' : 'bg-line')} />}
            <span className={cn('z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold',
              done ? 'border-teal-600 bg-teal-600 text-white' : current ? 'border-teal-600 bg-panel text-teal-700' : 'border-line bg-panel text-muted')}>
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm font-semibold', !done && !current && 'text-muted')}>
                {STATUS_LABEL[s]}{s === 'sent' && clinicName ? ` to ${clinicName}` : ''}
              </p>
              {at[s] && <p className="text-xs text-muted">{formatWhen(at[s])}</p>}
              {current && awaiting && (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-soon-bg px-2.5 py-0.5 text-xs font-semibold text-soon">
                  <MessageCircleQuestion className="size-3.5" aria-hidden /> Waiting for your reply
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
