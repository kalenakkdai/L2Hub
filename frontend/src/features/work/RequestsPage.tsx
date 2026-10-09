import { useQuery } from '@tanstack/react-query'
import { Loader, Plus, Send } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import {
  fetchAllRequests,
  fetchMyRequests,
  REQUEST_STATUS_LABELS,
  type CommitteeRequest,
  type RequestStatus,
} from './api'
import { RequestMeta, RequestRoute, RequestStatusBadge } from './RequestBits'
import { NewRequestForm, RequestActions } from './RequestsWidget'

type Filter = 'all' | 'mine' | RequestStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'My committees' },
  { key: 'open', label: REQUEST_STATUS_LABELS.open },
  { key: 'accepted', label: REQUEST_STATUS_LABELS.accepted },
  { key: 'done', label: REQUEST_STATUS_LABELS.done },
  { key: 'declined', label: REQUEST_STATUS_LABELS.declined },
]

function RequestRow({
  request,
  canAnswer,
}: {
  request: CommitteeRequest
  /** Sent to one of the caller's committees, so theirs to answer. */
  canAnswer: boolean
}) {
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
          {canAnswer && (
            <div className="mt-1 flex flex-wrap justify-end gap-1.5">
              <RequestActions request={request} />
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * The cross-org request log.
 *
 * The paper trail — who asked whom, for what, and whether it happened — and
 * the place to act on it: a committee answers what was sent to it right on
 * its row, and anyone in a committee can ask another for help.
 */
export function RequestsPage() {
  const me = useCurrentUser()
  const [filter, setFilter] = useState<Filter>('all')
  const [filing, setFiling] = useState(false)
  const requests = useQuery({ queryKey: ['requests'], queryFn: fetchAllRequests })
  const mine = useQuery({ queryKey: ['requests', 'mine'], queryFn: fetchMyRequests })

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const myCommittees = mine.data?.committees ?? []
  const myCommitteeIds = new Set(myCommittees.map((c) => c.id))
  const isMine = (r: CommitteeRequest) =>
    myCommitteeIds.has(r.targetCommittee.id) || myCommitteeIds.has(r.requestingCommittee.id)

  const all = requests.data?.requests ?? []
  const shown =
    filter === 'all'
      ? all
      : filter === 'mine'
        ? all.filter(isMine)
        : all.filter((r) => r.status === filter)
  const openCount = all.filter((r) => r.status === 'open').length
  const awaitingUs = all.filter(
    (r) => r.status === 'open' && myCommitteeIds.has(r.targetCommittee.id),
  ).length

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <p className="mb-1.5 text-[13px] text-ink-subtle">
        {awaitingUs > 0
          ? `${awaitingUs} waiting on your committee`
          : openCount > 0
            ? `${openCount} open`
            : 'Between committees'}
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[70ch] text-sm text-ink-subtle">
          Every ask between committees, and what came of it. Requests sent to
          your committee can be answered right here.
        </p>
        {myCommittees.length > 0 && !filing && (
          <button
            type="button"
            onClick={() => setFiling(true)}
            className="flex items-center gap-1 rounded-control border border-border-subtle px-2.5 py-1 text-[12.5px] text-ink-muted transition hover:border-accent-600 hover:text-accent-ink"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Ask a committee
          </button>
        )}
      </div>

      {filing && (
        <div className="mb-5 max-w-md rounded-card border border-border-subtle bg-surface px-4 pt-1 pb-3">
          <NewRequestForm myCommittees={myCommittees} onDone={() => setFiling(false)} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.filter(({ key }) => key !== 'mine' || myCommittees.length > 0).map(({ key, label }) => (
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
                : 'Try a different filter.'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
            <ul>
              {shown.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  canAnswer={myCommitteeIds.has(request.targetCommittee.id)}
                />
              ))}
            </ul>
          </div>
        ))}
    </AppShell>
  )
}
