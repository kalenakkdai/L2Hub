import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'light' | 'ghost' | 'icon'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700',
  secondary:
    'border border-border-subtle bg-surface text-accent-600 hover:border-accent-600 hover:bg-accent-50',
  /** For use on the near-black chrome, where an accent fill disappears. */
  light: 'bg-white text-accent-600 hover:bg-accent-50',
  ghost: 'text-ink-subtle hover:bg-surface-muted hover:text-ink',
  icon: 'border border-border-subtle bg-surface text-ink-muted hover:border-accent-600 hover:text-accent-600',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-label',
  md: 'h-9 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2.5 px-5 text-[15px]',
}

const BASE =
  'inline-flex items-center justify-center rounded-control font-medium transition duration-[420ms] ease-out-quick hover:duration-[260ms] disabled:pointer-events-none disabled:opacity-60'

/** Buttons lift very slightly and nudge their trailing arrow. That is all. */
const MOTION =
  'hover:scale-[1.015] hover:shadow-card-hover [&_svg]:transition-transform [&_svg]:duration-[260ms] hover:[&_svg:last-child]:translate-x-[3px]'

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
    <button
      className={cn(BASE, variant !== 'icon' && MOTION, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Same treatment for navigation, so links and buttons never drift apart. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link
      to={to}
      className={cn(BASE, MOTION, VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </Link>
  )
}
