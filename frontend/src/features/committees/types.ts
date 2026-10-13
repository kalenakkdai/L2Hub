/**
 * Shapes returned by `GET /committees` and `GET /committees/{ref}`.
 *
 * `id` is the committee slug, so links stay `/committees/activities`.
 */

export type CommitteeDirectory = {
  camperTotal: number
  committees: CommitteeSummary[]
}

export type CommitteeSummary = {
  id: string
  name: string
  /** Null when nobody leads it yet. Several heads are joined with a comma. */
  head: string | null
  /** Null for a committee that has no published contact address. */
  email: string | null
  camperCount: number
  /** Whether the signed-in camper belongs to this committee. */
  isMine: boolean
}

export type CommitteeMember = {
  id: string
  name: string
  /** Elected position, when they hold one. */
  position: string | null
  isHead: boolean
}

export type CommitteeTask = {
  id: string
  title: string
  meta: string
  status: string
}

export type CommitteeEvent = {
  id: string
  /** ISO 8601. */
  startsAt: string
  title: string
  detail: string
}

export type CommitteeDetail = CommitteeSummary & {
  members: CommitteeMember[]
  /** Campers beyond the ones listed. */
  remainingCount: number
  tasks: CommitteeTask[]
  events: CommitteeEvent[]
}
