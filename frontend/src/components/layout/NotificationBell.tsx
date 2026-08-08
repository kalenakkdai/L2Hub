import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../features/event-summary/api'

/**
 * Notifications panel for the app chrome.
 *
 * What arrives here is already filtered: the server refuses to write a
 * notification a camper has switched off, paused, or is inside quiet hours
 * for. Nothing is filtered again on this side.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void refresh(),
  })
  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void refresh(),
  })

  const notifications = query.data?.notifications ?? []
  const unread = query.data?.unread ?? 0

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-control text-navy-ink-muted transition hover:bg-navy-800 hover:text-navy-ink"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-400 px-1 font-mono text-[10px] font-medium text-navy-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2 w-72 overflow-hidden rounded-card border border-navy-700 bg-navy-900 shadow-overlay">
          <div className="flex items-center justify-between gap-2 border-b border-navy-700 px-3 py-2">
            <span className="text-xs font-semibold tracking-wide text-navy-ink-muted uppercase">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                disabled={readAll.isPending}
                onClick={() => readAll.mutate()}
                className="text-[11px] text-accent-400 transition hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-3 py-4 text-sm text-navy-ink-muted">No notifications yet.</li>
            ) : (
              notifications.slice(0, 8).map((note) => {
                const slug =
                  typeof note.payload?.eventSlug === 'string' ? note.payload.eventSlug : null
                const unreadNote = !note.readAt

                const inner = (
                  <>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-navy-ink">
                      {unreadNote && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"
                        />
                      )}
                      {note.title}
                    </p>
                    <p className="mt-0.5 text-xs text-navy-ink-muted">{note.body}</p>
                  </>
                )

                // Opening a notification is what marks it read; there is no
                // separate control, because reading it is the whole point.
                const onOpen = () => {
                  if (unreadNote) readOne.mutate(note.id)
                  setOpen(false)
                }

                return (
                  <li key={note.id} className="border-b border-navy-800 last:border-b-0">
                    {slug ? (
                      <Link
                        to={`/events/${slug}/summary`}
                        className="block px-3 py-2 hover:bg-navy-800"
                        onClick={onOpen}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpen}
                        className="block w-full px-3 py-2 text-left hover:bg-navy-800"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
