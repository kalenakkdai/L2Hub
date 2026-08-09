import { apiFetch } from '../../api/client'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type RequestStatus = 'open' | 'accepted' | 'done' | 'declined'

export type Person = { id: string; name: string }

export type BoardTask = {
  id: string
  committeeId: string
  title: string
  details: string
  status: TaskStatus
  assignee: Person | null
  dueOn: string | null
  createdAt: string
}

export type BoardColumn = {
  id: string
  name: string
  slug: string
  isMine: boolean
  /** Whether this caller may add work to this committee. */
  canAddTask: boolean
  openRequestCount: number
  tasks: BoardTask[]
}

export type CommitteeRef = { id: string; name: string }

export type CommitteeRequest = {
  id: string
  requestingCommittee: CommitteeRef
  targetCommittee: CommitteeRef
  title: string
  details: string
  status: RequestStatus
  dueOn: string | null
  /** Set when the request was fanned out from a board task. */
  sourceTaskId: string | null
  createdBy: Person | null
  respondedBy: Person | null
  respondedAt: string | null
  createdAt: string
}

export type PickerCommittee = {
  id: string
  name: string
  slug: string
  canRequestFor: boolean
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  done: 'Done',
  declined: 'Declined',
}

export function fetchBoard() {
  return apiFetch<{ committees: BoardColumn[] }>('/board')
}

export function fetchBoardCommittees() {
  return apiFetch<{ committees: PickerCommittee[] }>('/board/committees')
}

export type NewTaskInput = {
  committeeId: string
  title: string
  details?: string
  assigneeUserId?: string | null
  dueOn?: string | null
  /** Committees whose help this task needs; each becomes an open request. */
  collaboratorCommitteeIds?: string[]
}

export function createTask(input: NewTaskInput) {
  return apiFetch<{ task: BoardTask; requests: CommitteeRequest[] }>('/board/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTask(
  taskId: string,
  patch: { status?: TaskStatus; assigneeUserId?: string; clearAssignee?: boolean },
) {
  return apiFetch<{ task: BoardTask }>(`/board/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function fetchAllRequests() {
  return apiFetch<{ requests: CommitteeRequest[] }>('/requests')
}

export type MyRequests = {
  inbound: CommitteeRequest[]
  outbound: CommitteeRequest[]
  committees: CommitteeRef[]
}

export function fetchMyRequests() {
  return apiFetch<MyRequests>('/requests/mine')
}

export type NewRequestInput = {
  requestingCommitteeId: string
  targetCommitteeId: string
  title: string
  details?: string
  dueOn?: string | null
}

export function createRequest(input: NewRequestInput) {
  return apiFetch<{ request: CommitteeRequest }>('/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function respondToRequest(requestId: string, status: RequestStatus) {
  return apiFetch<{ request: CommitteeRequest }>(`/requests/${requestId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}
