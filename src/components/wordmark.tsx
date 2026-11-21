import { Link } from '@tanstack/react-router'
import { HeartPulse } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2 font-bold text-teal-700', className)}>
      <HeartPulse className="size-5" aria-hidden /> ClinIQ
    </Link>
  )
}
