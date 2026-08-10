import { ArrowRight } from 'lucide-react'
import { StatusBadge, type BadgeTone } from '../../components/ui/StatusBadge'
import {
  REQUEST_STATUS_LABELS,
  type CommitteeRequest,
  type RequestStatus,
} from './api'
import { formatDueDate } from './dueDates'

/**
 * Open is the state that needs someone to act, so it carries the warning tone;
 * declined is not a failure, just an answer, so it stays neutral rather than
 * red.
 */
const STATUS_TONES: Record<RequestStatus, BadgeTone> = {
  open: 'warning',
  accepted: 'info',
  done: 'accent',
  declined: 'neutral',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <StatusBadge tone={STATUS_TONES[status]}>
      {REQUEST_STATUS_LABELS[status]}
    </StatusBadge>
  )
}

/** "Fundraising → Publicity", the shape of every row in the log. */
export function RequestRoute({ request }: { request: CommitteeRequest }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
      <span>{request.requestingCommittee.name}</span>
      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span>{request.targetCommittee.name}</span>
    </span>
  )
}

export function RequestMeta({ request }: { request: CommitteeRequest }) {
  const due = formatDueDate(request.dueOn)
  return (
    <p className="mt-1 text-[12.5px] text-ink-subtle">
      {request.createdBy?.name ?? 'Someone'} asked
      {due ? ` · due ${due}` : ''}
      {request.sourceTaskId ? ' · from a board task' : ''}
    </p>
  )
}
