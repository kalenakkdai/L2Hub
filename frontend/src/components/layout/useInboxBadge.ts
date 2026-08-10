import { useQuery } from '@tanstack/react-query'
import { fetchNotifications } from '../../features/event-summary/api'
import type { NavBadge } from './navigation'

/**
 * The live unread count for the Inbox row.
 *
 * Shares the ['notifications'] query with the bell and the Inbox page, so all
 * three show the same number and marking something read updates every one of
 * them. Returns undefined when there is nothing to show, which leaves the
 * row's own badge — none, for Inbox — in place.
 */
export function useInboxBadge(enabled: boolean): NavBadge | undefined {
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
    enabled,
  })

  const unread = query.data?.unread ?? 0
  if (unread <= 0) return undefined
  return { kind: 'count', value: unread, tone: 'accent' }
}
