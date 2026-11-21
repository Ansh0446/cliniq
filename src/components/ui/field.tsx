import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Field({ label, id, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-10 w-full rounded-control border border-control bg-panel px-3 text-sm text-ink placeholder:text-muted',
          error && 'border-urgent',
          className,
        )}
        {...props}
      />
      {error && <p id={`${id}-error`} className="text-sm text-urgent">{error}</p>}
    </div>
  )
}
