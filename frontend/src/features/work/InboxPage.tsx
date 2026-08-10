import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox as InboxIcon, Loader } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../event-summary/api'

/** What each notification type is called on the page. */
const KIND_LABELS: Record<string, string> = {
  'task.assigned': 'Task',
  'task.due_soon': 'Deadline',
  'task.overdue': 'Overdue',
  'request.received': 'Request',
  'request.accepted': 'Request',
  'request.declined': 'Request',
  'request.completed': 'Request',
  'wrapped.request': 'Wrapped',
  'wrapped.generated': 'Wrapped',
  'wrapped.published': 'Wrapped',
  'owl.access_revoked': 'Owl',
  'grades.changed': 'Grades',
}

function when(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function NotificationRow({ note }: { note: AppNotification }) {
  const queryClient = useQueryClient()
  const read = useMutation({
    mutationFn: () => markNotificationRead(note.id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = !note.readAt

  return (
    <li className="flex items-start gap-3 border-b border-border-divider px-5 py-3.5 last:border-b-0">
      <span
        aria-hidden="true"
        className={
          unread
            ? 'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600'
            : 'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-transparent'
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{note.title}</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">{note.body}</p>
        <p className="mt-1 font-mono text-[11.5px] text-ink-subtle">
          {KIND_LABELS[note.type] ?? 'Update'} · {when(note.createdAt)}
        </p>
      </div>
      {unread && (
        <button
          type="button"
          onClick={() => read.mutate()}
          disabled={read.isPending}
          className="shrink-0 text-[12.5px] text-accent-600 underline-offset-2 hover:underline disabled:opacity-60"
        >
          Mark read
        </button>
      )}
    </li>
  )
}

/**
 * The full notification list.
 *
 * The bell in the chrome shows the most recent eight; this is the same data
 * without the cap, for when someone needs to find what they missed. Both read
 * the same query, so marking something read in one updates the other.
 */
export function InboxPage() {
  const me = useCurrentUser()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications })

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const notifications = query.data?.notifications ?? []
  const unread = query.data?.unread ?? 0

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <div>
        <p className="mb-1.5 text-[13px] text-ink-subtle">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </p>
        <h1 className="text-display font-bold text-ink">Inbox</h1>
      </div>
      {unread > 0 && (
        <Button
          variant="secondary"
          className="ml-auto"
          disabled={readAll.isPending}
          onClick={() => readAll.mutate()}
        >
          Mark all read
        </Button>
      )}
    </header>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
      header={header}
    >
      {query.isPending && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Checking your inbox…
        </p>
      )}

      {query.isError && (
        <ErrorState
          title="Could not load your inbox"
          description="The notifications did not come back. Try again in a moment."
          onRetry={() => void query.refetch()}
        />
      )}

      {query.isSuccess &&
        (notifications.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="Nothing here yet"
            description="New tasks assigned to you, and requests to and from your committee, arrive here."
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
            <ul>
              {notifications.map((note) => (
                <NotificationRow key={note.id} note={note} />
              ))}
            </ul>
          </div>
        ))}
    </AppShell>
  )
}
