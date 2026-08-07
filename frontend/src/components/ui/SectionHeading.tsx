import type { ReactNode } from 'react'

type SectionHeadingProps = {
  children: ReactNode
  /** Optional trailing element, e.g. a count or a "view all" link. */
  action?: ReactNode
  id?: string
}

/** Small, tracked, muted — a label for a band of content, not a headline. */
export function SectionHeading({ children, action, id }: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2
        id={id}
        className="text-label font-semibold tracking-wider text-ink-subtle uppercase"
      >
        {children}
      </h2>
      {action}
    </div>
  )
}
