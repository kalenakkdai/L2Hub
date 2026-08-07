/** The product mark used in both the sidebar and the mobile bar. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white"
      >
        L2
      </span>
      <span className="text-base font-semibold tracking-tight text-navy-ink">L2 Hub</span>
    </span>
  )
}
