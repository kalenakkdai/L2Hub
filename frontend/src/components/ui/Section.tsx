import type { ReactNode } from 'react'
import { useReveal } from './useReveal'
import { cn } from './cn'

type SectionProps = {
  title: string
  /** Right-aligned note or link beside the heading. */
  aside?: ReactNode
  children: ReactNode
  /** Staggers the reveal when several sections come into view together. */
  revealIndex?: number
  className?: string
}

/**
 * A titled band of content: heading, the dotted trail beneath it, then the
 * content. The trail is the one decorative motif in the system, and it earns
 * its place by appearing everywhere a section begins.
 */
export function Section({
  title,
  aside,
  children,
  revealIndex = 0,
  className,
}: SectionProps) {
  const ref = useReveal<HTMLElement>(revealIndex)
  const headingId = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section ref={ref} data-reveal aria-labelledby={headingId} className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-title font-semibold text-ink">
          {title}
        </h2>
        {aside}
      </div>
      <div aria-hidden="true" className="dotted-trail mb-4 h-px" />
      {children}
    </section>
  )
}

/** The dotted trail on its own, for dividers inside a section. */
export function DottedTrail({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-px', dark ? 'dotted-trail-dark' : 'dotted-trail', className)}
    />
  )
}
