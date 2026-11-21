import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const ASSISTANT_OPEN_EVENT = 'cliniq:assistant-open'

/** Opens the assistant (and optionally sends a first message) from anywhere in the patient area. */
export function openAssistant(prompt?: string): void {
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT, { detail: { prompt } }))
}

export function AskAssistantButton({ prompt, children, className }: { prompt?: string; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => openAssistant(prompt)} className={cn('text-sm font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-900', className)}>
      {children}
    </button>
  )
}
