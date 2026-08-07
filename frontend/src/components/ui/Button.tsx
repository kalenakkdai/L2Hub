import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'navy'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700',
  secondary:
    'border border-border-strong bg-surface text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-status-neutral-bg hover:text-ink',
  // For use on dark chrome, where the accent fill would be too heavy.
  navy: 'bg-white/10 text-navy-ink hover:bg-white/15',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-label',
  md: 'h-10 gap-2 px-4 text-sm',
}

const BASE =
  'inline-flex items-center justify-center rounded-control font-medium transition duration-150 ease-out-quick disabled:pointer-events-none disabled:opacity-60'

type CommonProps = {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  )
}

/** Same visual treatment for navigation, so links and buttons never diverge. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={cn(BASE, VARIANTS[variant], SIZES[size], className)}>
      {children}
    </Link>
  )
}
