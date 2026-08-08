/**
 * Shapes the committees screens are built against.
 *
 * The backend has `/committees/{ref}/tasks` but no list endpoint yet, so both
 * screens read from a fixture for now. When the endpoints land, only
 * useCommittees.ts changes.
 */

export type CommitteeSummary = {
  id: string
  name: string
  /** Null when nobody leads it yet. */
  head: string | null
  email: string
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
