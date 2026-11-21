import { AlertTriangle, CheckCircle2, Info, Loader2, OctagonAlert, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const control = 'w-full rounded-control border border-control bg-panel px-3 text-sm text-ink placeholder:text-muted'

export function TextArea({ label, id, hint, error, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; id: string; hint?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>}
      {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      <textarea
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        className={cn(control, 'min-h-28 py-2.5 leading-relaxed', error && 'border-urgent', className)}
        {...props}
      />
      {error && <p className="text-sm text-urgent">{error}</p>}
    </div>
  )
}

export function SelectField({ label, id, options, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <select id={id} className={cn(control, 'h-10', className)} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/** Free-text chips. Enter or comma adds, backspace on empty input removes the last one. */
export function TagInput({ label, id, value, onChange, placeholder, hint }: {
  label: string; id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string
}) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const t = draft.trim().replace(/,$/, '')
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t.slice(0, 120)])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={cn(control, 'flex min-h-10 flex-wrap items-center gap-1.5 py-1.5')}>
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-0.5 pl-2.5 pr-1 text-sm text-teal-900">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}
              className="grid size-5 place-items-center rounded-full hover:bg-teal-100"><X className="size-3.5" aria-hidden /></button>
          </span>
        ))}
        <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={commit}
          placeholder={value.length ? '' : placeholder} className="min-w-32 flex-1 bg-transparent py-1 outline-none" />
      </div>
    </div>
  )
}

const TONES = {
  info: { box: 'border-teal-100 bg-teal-50 text-teal-900', Icon: Info },
  warn: { box: 'border-[#e8c98a] bg-soon-bg text-soon', Icon: AlertTriangle },
  danger: { box: 'border-[#f0b8b0] bg-urgent-bg text-urgent', Icon: OctagonAlert },
  success: { box: 'border-[#b5dcc6] bg-routine-bg text-routine', Icon: CheckCircle2 },
} as const

export function Callout({ tone = 'info', title, children, className }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode; className?: string }) {
  const { box, Icon } = TONES[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-surface border px-4 py-3 text-sm', box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">{title && <p className="font-semibold">{title}</p>}{children && <div className="leading-relaxed">{children}</div>}</div>
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden />{label}</span>
}

export function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-surface border border-line bg-panel p-5', className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}
