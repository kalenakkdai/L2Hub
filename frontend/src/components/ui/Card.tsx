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
 * The one white surface in the system: 1px border plus a whisper of shadow.
 * That pair does all the separating work, which is why nothing here needs a
 * gradient or a heavy drop shadow.
 */
export function Card({ children, className, interactive = false, as = 'div' }: CardProps) {
  const Tag = as

  return (
    <Tag
      className={cn(
        'rounded-card border border-border-subtle bg-surface shadow-card',
        interactive &&
          'transition duration-150 ease-out-quick hover:border-border-strong hover:shadow-card-hover',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
