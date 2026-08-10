import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchCurrentUser } from '../../api/auth'
import { Button } from '../../components/ui/Button'
import {
  createShadowRequest,
  fetchShadowRequests,
  respondToShadowRequest,
  type ShadowRequest,
} from './api'

const FIELD =
  'w-full rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-[13px] text-ink focus:border-accent-600 focus:outline-none'

const DURATIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
]

function useRefreshShadow() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['shadow'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }
}

function HeadInbound({ request }: { request: ShadowRequest }) {
  const refresh = useRefreshShadow()
  const respond = useMutation({
    mutationFn: (decision: 'approved' | 'denied') =>
      respondToShadowRequest(request.id, decision),
    onSuccess: refresh,
  })

  if (request.status !== 'pending') return null

  return (
    <li className="border-b border-border-divider py-2.5 last:border-b-0">
      <p className="text-[13.5px] text-ink">
        {request.requester_name ?? 'A baby camper'} wants to shadow{' '}
        {request.committee_name ?? 'your committee'} for {request.duration_minutes}{' '}
        min
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={respond.isPending}
          onClick={() => respond.mutate('approved')}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={respond.isPending}
          onClick={() => respond.mutate('denied')}
        >
          Deny
        </Button>
      </div>
    </li>
  )
}

export function ShadowWidget() {
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(60)
  const [message, setMessage] = useState('')
  const refresh = useRefreshShadow()

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
  })

  const babyCommittees =
    me.data?.committees?.filter((c) => c.membership_type === 'baby') ?? []
  const headedCommittees =
    me.data?.committees?.filter((c) => c.is_head) ?? []
  const activeShadows = me.data?.active_shadows ?? []

  const list = useQuery({
    queryKey: ['shadow'],
    queryFn: fetchShadowRequests,
    enabled: Boolean(me.data && (babyCommittees.length > 0 || headedCommittees.length > 0)),
  })

  const request = useMutation({
    mutationFn: () =>
      createShadowRequest({
        committeeId: babyCommittees[0]!.id,
        durationMinutes: duration,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      setOpen(false)
      setMessage('')
      refresh()
    },
  })

  if (!me.data) return null
  if (babyCommittees.length === 0 && headedCommittees.length === 0) return null

  const inbound =
    list.data?.requests.filter(
      (row) =>
        row.status === 'pending' &&
        headedCommittees.some((c) => c.id === row.committee_id),
    ) ?? []

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">Shadow</h2>
      </div>

      {activeShadows.length > 0 ? (
        <p className="mb-2 text-[13px] text-ink-muted">
          Active until{' '}
          {new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date(activeShadows[0]!.ends_at))}
          {activeShadows[0]?.committee_name
            ? ` · ${activeShadows[0].committee_name}`
            : ''}
        </p>
      ) : null}

      {babyCommittees.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            Shadow
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            Request duration
          </Button>
        </div>
      ) : null}

      {open && babyCommittees[0] ? (
        <div className="mb-3 space-y-2 rounded-control border border-border-subtle bg-surface-sunken p-3">
          <p className="text-[13px] text-ink-muted">
            Ask {babyCommittees[0].name} heads to let you see everything for a
            limited time.
          </p>
          <label className="block text-[12px] font-medium text-ink-subtle">
            Duration
            <select
              className={`${FIELD} mt-1`}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            >
              {DURATIONS.map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-ink-subtle">
            Note (optional)
            <input
              className={`${FIELD} mt-1`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Why you need access"
            />
          </label>
          {request.isError ? (
            <p className="text-[12.5px] text-status-danger">
              Could not send the request. Try again.
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              disabled={request.isPending}
              onClick={() => request.mutate()}
            >
              {request.isPending ? 'Sending…' : 'Send to head'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {inbound.length > 0 ? (
        <ul>
          {inbound.map((row) => (
            <HeadInbound key={row.id} request={row} />
          ))}
        </ul>
      ) : headedCommittees.length > 0 && list.isSuccess ? (
        <p className="text-[13px] text-ink-subtle">No pending shadow requests.</p>
      ) : null}
    </section>
  )
}
