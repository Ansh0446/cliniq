import { Phone, ShieldAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CRISIS_LINES, EMERGENCY_NUMBERS } from '@/lib/clinical/constants'
import { Button } from './ui/button'

/** Full-screen warning shown before the patient can continue. It cannot be dismissed without choosing. */
export function EmergencyModal({ open, flags, selfHarm, onAcknowledge, onClose }: {
  open: boolean
  flags: string[]
  selfHarm: boolean
  onAcknowledge: () => void
  /** Used only for "go back and edit". */
  onClose?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="emergency-title"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-surface border-2 border-urgent bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 size-7 shrink-0 text-urgent" aria-hidden />
          <div>
            <h2 id="emergency-title" className="text-xl font-bold text-urgent">This may be an emergency</h2>
            <p className="mt-1 text-sm leading-relaxed">
              What you described can be a sign of a serious problem. Do not wait for an online review.
              Call your local emergency number now, or ask someone nearby to take you to the nearest emergency department.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {EMERGENCY_NUMBERS.map((n) => (
            <a key={n} href={`tel:${n}`} className="inline-flex h-12 items-center gap-2 rounded-control bg-urgent px-5 text-lg font-bold text-white hover:bg-[#8a190b]">
              <Phone className="size-5" aria-hidden /> Call {n}
            </a>
          ))}
        </div>
        <p className="text-xs text-muted">112 is the emergency number in India and the EU. 911 is used in the US and Canada.</p>

        {selfHarm && (
          <div className="rounded-control bg-urgent-bg p-3 text-sm">
            <p className="font-semibold">If you are thinking about harming yourself</p>
            <p className="mt-1">You do not have to handle this alone. Contact emergency services, or a crisis line:</p>
            <ul className="mt-1 space-y-0.5">
              {CRISIS_LINES.map((l) => <li key={l.number}>{l.name}: <a className="font-semibold underline" href={`tel:${l.number}`}>{l.number}</a></li>)}
            </ul>
          </div>
        )}

        {flags.length > 0 && (
          <div className="text-sm">
            <p className="font-semibold">Why you are seeing this</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{flags.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          {onClose && <Button variant="secondary" onClick={onClose}>Go back and edit</Button>}
          <Button variant="secondary" onClick={onAcknowledge}>I understand, continue with the intake</Button>
        </div>
      </div>
    </dialog>
  )
}

/** Stays on screen after the modal is acknowledged. */
export function EmergencyBanner({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null
  return (
    <div role="alert" className="flex items-start gap-3 rounded-surface border border-urgent bg-urgent-bg px-4 py-3 text-sm text-urgent">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Possible emergency flagged: {flags.join(', ')}</p>
        <p>If you feel unwell right now, call {EMERGENCY_NUMBERS.join(' or ')} instead of waiting for this intake.</p>
      </div>
    </div>
  )
}
