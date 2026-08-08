import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'light' | 'navy' | 'ghost' | 'icon'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700',
  secondary:
    'border border-border-subtle bg-surface text-accent-ink hover:border-accent-600 hover:bg-accent-50',
  /** For use on the near-black chrome, where an accent fill disappears. */
  light: 'bg-white text-accent-ink hover:bg-accent-50',
  /** Quieter counterpart to `light`, for secondary actions on dark surfaces. */
  navy: 'bg-white/10 text-navy-ink hover:bg-white/15',
  ghost: 'text-ink-subtle hover:bg-surface-muted hover:text-ink',
  icon: 'border border-border-subtle bg-surface text-ink-muted hover:border-accent-600 hover:text-accent-ink',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-label',
  md: 'h-9 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2.5 px-5 text-[15px]',
}

const BASE =
  'inline-flex items-center justify-center rounded-control font-medium transition duration-[420ms] ease-out-quick hover:duration-[260ms] disabled:pointer-events-none disabled:opacity-60'

/**
 * Buttons lift very slightly, nudge their trailing arrow, and give under the
 * press. That is all.
 *
 * The lift and the press live in `.motion-lift` in index.css rather than as
 * `hover:scale-*` utilities. Tailwind compiles those to the separate `scale`
 * property while the reduce-motion rules say `transform: none`, which does
 * not override it — so a camper who switched motion off still got a moving
 * button. Keeping the motion and its suppression in one place keeps both on
 * the same property.
 */
const MOTION =
  'motion-lift [&_svg]:transition-transform [&_svg]:duration-[260ms] hover:[&_svg:last-child]:translate-x-[3px]'

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
  // React 19 passes ref as an ordinary prop to function components; declaring
  // it here lets callers focus a Button without a forwardRef wrapper.
  ref,
  ...rest
}: CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
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
