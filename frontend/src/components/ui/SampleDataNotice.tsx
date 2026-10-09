import { FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Marks a page, or part of one, that still runs on fixture data.
 *
 * Without it, made-up numbers sit beside real ones and a camper cannot tell
 * which to trust. Remove it from a page in the same change that connects the
 * page to the API.
 */
export function SampleDataNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mb-5 flex items-start gap-2 rounded-card border border-status-warning-border bg-status-warning-bg px-3.5 py-2.5 text-[13px] text-status-warning"
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <span className="font-semibold">Sample data.</span> {children}
      </span>
    </p>
  )
}
