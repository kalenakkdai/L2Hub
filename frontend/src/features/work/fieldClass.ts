/**
 * The form field styling shared by this feature's dialogs.
 *
 * Lifted out of NewTaskDialog so the assignee picker cannot drift from it.
 * Deliberately not unified with FIELD_CLASS in components/settings/primitives
 * yet — the two genuinely differ (h-10 and a focus ring there, padding here)
 * and `cn` joins rather than merges, so a caller cannot override one with the
 * other. That is a cleanup of its own.
 */
export const FIELD =
  'w-full rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-600 focus:outline-none'
