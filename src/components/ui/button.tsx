import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-control text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-teal-600 text-white hover:bg-teal-700',
        secondary: 'border border-line bg-panel text-ink hover:bg-teal-50',
        ghost: 'text-muted hover:bg-teal-50 hover:text-ink',
        danger: 'bg-urgent text-white hover:bg-[#8a190b]',
      },
      size: { md: 'h-10 px-4', sm: 'h-8 px-3', lg: 'h-12 px-6 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(button({ variant, size }), className)} {...props} />
}
export { button as buttonStyles }
