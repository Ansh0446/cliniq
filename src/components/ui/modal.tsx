import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/** Accessible dialog on the native <dialog> element: focus is trapped and Escape closes it. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby="modal-title" onCancel={(e) => { e.preventDefault(); onClose() }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-surface border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-black/40">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-control hover:bg-teal-50"><X className="size-5" aria-hidden /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
