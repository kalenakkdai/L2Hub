import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchNotifications } from '../../features/event-summary/api'

/** Compact notifications panel for AppShell chrome. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
  })

  const unread = (query.data?.notifications ?? []).filter((n) => !n.readAt).length

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-control text-navy-ink-muted transition hover:bg-navy-800 hover:text-navy-ink"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-400" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 bottom-full z-50 mb-2 w-72 overflow-hidden rounded-card border border-navy-700 bg-navy-900 shadow-lg">
          <div className="border-b border-navy-700 px-3 py-2 text-xs font-semibold tracking-wide text-navy-ink-muted uppercase">
            Notifications
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {(query.data?.notifications ?? []).length === 0 ? (
              <li className="px-3 py-4 text-sm text-navy-ink-muted">No notifications yet.</li>
            ) : (
              (query.data?.notifications ?? []).slice(0, 8).map((note) => {
                const slug =
                  typeof note.payload?.eventSlug === 'string'
                    ? note.payload.eventSlug
                    : null
                return (
                  <li key={note.id} className="border-b border-navy-800 last:border-b-0">
                    {slug ? (
                      <Link
                        to={`/events/${slug}/summary`}
                        className="block px-3 py-2 hover:bg-navy-800"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-sm font-medium text-navy-ink">{note.title}</p>
                        <p className="mt-0.5 text-xs text-navy-ink-muted">{note.body}</p>
                      </Link>
                    ) : (
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-navy-ink">{note.title}</p>
                        <p className="mt-0.5 text-xs text-navy-ink-muted">{note.body}</p>
                      </div>
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
