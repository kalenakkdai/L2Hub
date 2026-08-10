import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../features/event-summary/api'

function hrefFor(note: AppNotification): string | null {
  const payload = note.payload ?? {}
  if (typeof payload.href === 'string') {
    return payload.href
  }
  if (typeof payload.eventSlug === 'string') {
    return `/events/${payload.eventSlug}/summary`
  }
  if (typeof payload.slug === 'string') {
    return `/events/${payload.slug}/summary`
  }
  if (typeof payload.requestId === 'string') {
    return '/requests'
  }
  if (typeof payload.taskId === 'string') {
    return '/board'
  }
  if (note.type === 'grades.changed') {
    return '/grades'
  }
  if (note.type === 'owl.access_revoked') {
    return '/owl'
  }
  return null
}

/**
 * Tiny notifications tab in the app chrome.
 *
 * What arrives here is already filtered: the server refuses to write a
 * notification a camper has switched off, paused, or is inside quiet hours
 * for, and work events fan out by role (committee members + heads see their
 * committee; ASBO sees every committee).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
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

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const notifications = query.data?.notifications ?? []
  const unread = query.data?.unread ?? 0

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-control text-navy-ink-muted transition hover:bg-navy-800 hover:text-navy-ink"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
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
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-card border border-navy-700 bg-navy-900 shadow-overlay"
        >
          <div className="flex items-center justify-between gap-2 border-b border-navy-700 px-3 py-2">
            <span className="text-xs font-semibold tracking-wide text-navy-ink-muted uppercase">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                disabled={readAll.isPending}
                onClick={() => readAll.mutate()}
                className="text-[11px] font-semibold text-accent-400 transition hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {query.isPending ? (
              <li className="px-3 py-4 text-sm text-navy-ink-muted">Loading…</li>
            ) : notifications.length === 0 ? (
              <li className="px-3 py-4 text-sm text-navy-ink-muted">
                No activity yet. Requests, assignments, and committee updates
                show up here.
              </li>
            ) : (
              notifications.slice(0, 12).map((note) => {
                const href = hrefFor(note)
                const unreadNote = !note.readAt

                const inner = (
                  <>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-ink">
                      {unreadNote && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"
                        />
                      )}
                      {note.title}
                    </p>
                    {note.body ? (
                      <p className="mt-0.5 text-xs text-navy-ink-muted">{note.body}</p>
                    ) : null}
                  </>
                )

                const onOpen = () => {
                  if (unreadNote) readOne.mutate(note.id)
                  setOpen(false)
                }

                return (
                  <li key={note.id} className="border-b border-navy-800 last:border-b-0">
                    {href ? (
                      <Link
                        to={href}
                        className="block px-3 py-2.5 hover:bg-navy-800"
                        onClick={onOpen}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpen}
                        className="block w-full px-3 py-2.5 text-left hover:bg-navy-800"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })
            )}
          </ul>

          <div className="border-t border-navy-700 px-3 py-2">
            <Link
              to="/inbox"
              className="text-[11px] font-semibold text-accent-400 hover:underline"
              onClick={() => setOpen(false)}
            >
              Open full inbox
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
