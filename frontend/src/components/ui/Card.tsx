import type { ReactNode } from 'react'
import { cn } from './cn'

type CardProps = {
  children: ReactNode
  className?: string
  /** Adds hover feedback. Only for cards that are themselves a link or button. */
  interactive?: boolean
  as?: 'div' | 'article' | 'section' | 'li'
}

/**
 * The one surface in the system: white, hairline border, barely-there shadow.
 * Separation comes from the border, which is why nothing here needs a
 * gradient or a heavy drop shadow.
 */
export function Card({ children, className, interactive = false, as = 'div' }: CardProps) {
  const Tag = as

  return (
    <Tag
      className={cn(
        'rounded-card border border-border-subtle bg-surface shadow-card',
        interactive &&
          'transition duration-[420ms] ease-out-quick hover:-translate-y-[3px] hover:border-accent-200 hover:shadow-card-hover hover:duration-[260ms]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
