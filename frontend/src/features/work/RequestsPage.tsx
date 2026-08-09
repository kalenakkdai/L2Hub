import { useQuery } from '@tanstack/react-query'
import { Loader, Send } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import {
  fetchAllRequests,
  REQUEST_STATUS_LABELS,
  type CommitteeRequest,
  type RequestStatus,
} from './api'
import { RequestMeta, RequestRoute, RequestStatusBadge } from './RequestBits'

type Filter = 'all' | RequestStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: REQUEST_STATUS_LABELS.open },
  { key: 'accepted', label: REQUEST_STATUS_LABELS.accepted },
  { key: 'done', label: REQUEST_STATUS_LABELS.done },
  { key: 'declined', label: REQUEST_STATUS_LABELS.declined },
]

function RequestRow({ request }: { request: CommitteeRequest }) {
  return (
    <li className="border-b border-border-divider px-5 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{request.title}</p>
          <RequestMeta request={request} />
          {request.details && (
            <p className="mt-1.5 max-w-[70ch] text-[13px] text-ink-muted">
              {request.details}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RequestStatusBadge status={request.status} />
          <RequestRoute request={request} />
        </div>
      </div>
    </li>
  )
}

/**
 * The cross-org request log.
 *
 * Read-only on purpose: answering a request belongs to the committee it was
 * sent to, which they do from their dashboard. This page is the paper trail —
 * who asked whom, for what, and whether it happened.
 */
export function RequestsPage() {
  const me = useCurrentUser()
  const [filter, setFilter] = useState<Filter>('all')
  const requests = useQuery({ queryKey: ['requests'], queryFn: fetchAllRequests })

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const all = requests.data?.requests ?? []
  const shown = filter === 'all' ? all : all.filter((r) => r.status === filter)
  const openCount = all.filter((r) => r.status === 'open').length

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <p className="mb-1.5 text-[13px] text-ink-subtle">
        Leadership{openCount > 0 ? ` · ${openCount} open` : ''}
      </p>
      <h1 className="text-display font-bold text-ink">Requests</h1>
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
      <p className="mb-5 max-w-[70ch] text-sm text-ink-subtle">
        Every ask between committees, and what came of it. Committees answer
        the requests sent to them from their own dashboard.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? 'rounded-control border border-accent-600 bg-accent-50 px-2.5 py-1 text-[12.5px] font-medium text-accent-ink'
                : 'rounded-control border border-border-subtle px-2.5 py-1 text-[12.5px] text-ink-muted hover:border-accent-600 hover:text-accent-ink'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {requests.isPending && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Gathering the requests…
        </p>
      )}

      {requests.isError && (
        <ErrorState
          title="Could not load requests"
          description="The log did not come back. Try again in a moment."
          onRetry={() => void requests.refetch()}
        />
      )}

      {requests.isSuccess &&
        (shown.length === 0 ? (
          <EmptyState
            icon={Send}
            title={all.length === 0 ? 'No requests yet' : 'Nothing matches that filter'}
            description={
              all.length === 0
                ? 'When one committee asks another for something, it shows up here.'
                : 'Try a different status.'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
            <ul>
              {shown.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </ul>
          </div>
        ))}
    </AppShell>
  )
}
