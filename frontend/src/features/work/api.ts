import { apiFetch } from '../../api/client'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type RequestStatus = 'open' | 'accepted' | 'done' | 'declined'

export type Person = { id: string; name: string }

export type CommitteeRef = { id: string; name: string }

export type BoardTaskEvent = {
  id: string
  name: string
  slug: string
  year: number
}

export type BoardTask = {
  id: string
  committeeId: string
  title: string
  details: string
  status: TaskStatus
  assignee: Person | null
  dueOn: string | null
  createdAt: string
  event: BoardTaskEvent | null
  /** Present when this row was mirrored from another committee's task. */
  originTaskId: string | null
  fromCommittee: CommitteeRef | null
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

/** One person on a committee's roster, for the assignee picker. */
export type BoardCommitteeMember = {
  id: string
  name: string
  position: string | null
  isHead: boolean
  avatarUrl: string | null
}

/**
 * Who is in a committee.
 *
 * Authorized for people who can put work on that committee's board, plus its
 * own members. Anyone else gets a 403, which the picker renders the same way
 * as a missing endpoint — see AssigneePicker.
 */
export function fetchCommitteeMembers(committeeId: string) {
  return apiFetch<{
    committeeId: string
    committeeSlug: string
    committeeName: string
    members: BoardCommitteeMember[]
  }>(`/committees/${committeeId}/members`)
}

export type NewTaskInput = {
  committeeId: string
  title: string
  details?: string
  assigneeUserId?: string | null
  dueOn?: string | null
  eventId?: string | null
  /** Committees whose help this task needs; each gets a request and a board row. */
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

export type TaskProgress = {
  total: number
  done: number
  percentComplete: number
}

export type CampfireAssigneeProgress = {
  id: string | null
  name: string
  isMe: boolean
  total: number
  done: number
  percentComplete: number
}

export type CampfireEvent = {
  id: string
  name: string
  slug: string
  year: number
  status: string
  startsAt: string | null
  endsAt: string | null
}

export type MyTasksCampfire = {
  event: CampfireEvent
  tone: 'now' | 'next' | 'recent'
  progress: TaskProgress
  myTasks: BoardTask[]
  assignees: CampfireAssigneeProgress[]
}

export type MyTasksPayload = {
  openTaskCount: number
  campfires: MyTasksCampfire[]
  unlinkedTasks: BoardTask[]
}

export function fetchMyTasks() {
  return apiFetch<MyTasksPayload>('/tasks/mine')
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
