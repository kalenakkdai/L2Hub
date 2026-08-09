import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import {
  createRequest,
  fetchBoardCommittees,
  fetchMyRequests,
  respondToRequest,
  type CommitteeRequest,
} from './api'
import { RequestMeta, RequestRoute, RequestStatusBadge } from './RequestBits'

const FIELD =
  'w-full rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-subtle focus:border-accent-600 focus:outline-none'

function useRefreshRequests() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['requests'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['board'] })
  }
}

function InboundRow({ request }: { request: CommitteeRequest }) {
  const refresh = useRefreshRequests()
  const respond = useMutation({
    mutationFn: (status: 'accepted' | 'done' | 'declined') =>
      respondToRequest(request.id, status),
    onSuccess: refresh,
  })

  return (
    <li className="border-b border-border-divider py-2.5 last:border-b-0">
      <p className="text-[13.5px] text-ink">{request.title}</p>
      <RequestMeta request={request} />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <RequestStatusBadge status={request.status} />
        {request.status === 'open' && (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={respond.isPending}
              onClick={() => respond.mutate('accepted')}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={respond.isPending}
              onClick={() => respond.mutate('declined')}
            >
              Decline
            </Button>
          </>
        )}
        {request.status === 'accepted' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={respond.isPending}
            onClick={() => respond.mutate('done')}
          >
            Mark done
          </Button>
        )}
      </div>
    </li>
  )
}

function NewRequestForm({
  myCommittees,
  onDone,
}: {
  myCommittees: { id: string; name: string }[]
  onDone: () => void
}) {
  const refresh = useRefreshRequests()
  const [from, setFrom] = useState(myCommittees[0]?.id ?? '')
  const [to, setTo] = useState('')
  const [title, setTitle] = useState('')

  const committees = useQuery({
    queryKey: ['board', 'committees'],
    queryFn: fetchBoardCommittees,
    staleTime: 300_000,
  })

  const file = useMutation({
    mutationFn: () =>
      createRequest({
        requestingCommitteeId: from,
        targetCommitteeId: to,
        title,
      }),
    onSuccess: () => {
      refresh()
      onDone()
    },
  })

  const targets = (committees.data?.committees ?? []).filter((c) => c.id !== from)

  return (
    <form
      className="mt-2.5 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (from && to && title.trim()) file.mutate()
      }}
    >
      {myCommittees.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] text-ink-muted">From</span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={FIELD}
          >
            {myCommittees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[12.5px] text-ink-muted">Ask</span>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={FIELD}
          required
        >
          <option value="">Choose a committee…</option>
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12.5px] text-ink-muted">For</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A post for the winter fundraiser"
          className={FIELD}
          required
        />
      </label>

      {file.isError && (
        <p role="alert" className="text-[12.5px] text-status-danger">
          {file.error instanceof Error ? file.error.message : 'Could not send it.'}
        </p>
      )}

      <div className="flex justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={file.isPending || !to || !title.trim()}>
          {file.isPending ? 'Sending…' : 'Send request'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Requests, scoped to the caller's own committee.
 *
 * The cross-org /requests page is leadership-only, so this is where everyone
 * else lives: what has been asked of us, what we have asked for, and the form
 * to ask for something new.
 */
export function RequestsWidget() {
  const [filing, setFiling] = useState(false)
  const mine = useQuery({ queryKey: ['requests', 'mine'], queryFn: fetchMyRequests })

  const committees = mine.data?.committees ?? []

  // A camper in no committee has no request traffic; the section would be an
  // empty box explaining nothing. This also covers the pending and failed
  // states — the rail is a glance, not a place to report a fetch error.
  if (committees.length === 0) return null

  const isOutstanding = (r: CommitteeRequest) =>
    r.status !== 'done' && r.status !== 'declined'
  const openInbound = (mine.data?.inbound ?? []).filter(isOutstanding)
  const openOutbound = (mine.data?.outbound ?? []).filter(isOutstanding)

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">Requests</h2>
        {!filing && (
          <button
            type="button"
            onClick={() => setFiling(true)}
            className="ml-auto flex items-center gap-1 text-[12.5px] text-accent-600 underline-offset-2 hover:underline"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Ask a committee
          </button>
        )}
      </div>

      {filing && (
        <NewRequestForm myCommittees={committees} onDone={() => setFiling(false)} />
      )}

      {!filing && openInbound.length === 0 && openOutbound.length === 0 && (
        <p className="text-[13px] text-ink-subtle">
          Nothing outstanding. Ask another committee when you need something
          from them.
        </p>
      )}

      {openInbound.length > 0 && (
        <>
          <p className="mt-3 mb-1 text-[12.5px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
            Asked of you
          </p>
          <ul>
            {openInbound.map((request) => (
              <InboundRow key={request.id} request={request} />
            ))}
          </ul>
        </>
      )}

      {openOutbound.length > 0 && (
        <>
          <p className="mt-3 mb-1 text-[12.5px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
            You asked for
          </p>
          <ul>
            {openOutbound.map((request) => (
              <li key={request.id} className="border-b border-border-divider py-2.5 last:border-b-0">
                <p className="text-[13.5px] text-ink">{request.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <RequestStatusBadge status={request.status} />
                  <RequestRoute request={request} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
