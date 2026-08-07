import { ChevronsUpDown } from 'lucide-react'

type WordmarkProps = {
  /** Renders the campsite switcher affordance beneath the name. */
  subline?: string
  /** Shows the up/down chevron that hints at switching campsites. */
  switchable?: boolean
}

/**
 * The product mark. On the Quad, a Campsite is one club's hub — the subline
 * names which one you are looking at.
 */
export function Wordmark({ subline, switchable = false }: WordmarkProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-accent-600 text-xs font-bold text-white"
      >
        L2
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold text-navy-ink">
          L2 Campsite
        </span>
        {subline && (
          <span className="block truncate text-[11.5px] text-navy-ink-subtle">{subline}</span>
        )}
      </span>
      {switchable && (
        <ChevronsUpDown
          aria-hidden="true"
          className="ml-auto h-[15px] w-[15px] shrink-0 text-navy-ink-subtle"
        />
      )}
    </span>
  )
}
