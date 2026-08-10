/* ===========================================================================
 * SAMPLE DATA — committee roster for the L2 Campsite UI
 * ===========================================================================
 *
 * Sourced from `src/data/l2Roster.ts` (class spreadsheet). Replace with
 * `GET /committees` and `GET /committees/{ref}` once those endpoints exist.
 * ======================================================================== */

import {
  L2_ROSTER_COMMITTEES,
  primaryHead,
  type RosterCommittee,
} from '../../../data/l2Roster'
import type { CommitteeDetail, CommitteeMember, CommitteeSummary } from '../types'

function daysFromNow(days: number, hour: number): string {
  const date = new Date(Date.now() + days * 86_400_000)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

/** At most five campers are listed per camp; the rest roll into a count. */
const MAX_SHOWN = 5

export const SAMPLE_COMMITTEES: CommitteeSummary[] = L2_ROSTER_COMMITTEES.map(
  (committee) => ({
    id: committee.id,
    name: committee.name,
    head: primaryHead(committee),
    email: committee.email,
    camperCount: committee.members.length,
    isMine: committee.isMine ?? false,
  }),
)

export const SAMPLE_COMMITTEE_CAMPER_TOTAL = SAMPLE_COMMITTEES.reduce(
  (sum, committee) => sum + committee.camperCount,
  0,
)

const TASKS: Record<string, CommitteeDetail['tasks']> = {
  activities: [
    {
      id: 't1',
      title: 'Confirm booth layout with facilities',
      meta: 'Due Aug 8 · assigned to Hanna Rahmanian',
      status: 'In progress',
    },
    {
      id: 't2',
      title: 'Collect Maze Day supply receipts',
      meta: 'Due Aug 10 · assigned to Kaiwei Parks',
      status: 'Not started',
    },
    {
      id: 't3',
      title: 'Draft fall rally run-of-show',
      meta: 'Due Aug 15 · assigned to Aarit Patnaik',
      status: 'In progress',
    },
  ],
  tech: [
    {
      id: 't4',
      title: 'Sound check for the gym PA',
      meta: 'Due Aug 7 · assigned to Samay Jain',
      status: 'In progress',
    },
  ],
  publicity: [
    {
      id: 't5',
      title: 'Post Maze Day recap reel',
      meta: 'Due Aug 9 · assigned to Devon Mandal',
      status: 'Not started',
    },
  ],
}

const EVENTS: Record<string, CommitteeDetail['events']> = {
  activities: [
    { id: 'e1', startsAt: daysFromNow(1, 8), title: 'Maze Day 2026', detail: 'Main Quad' },
    {
      id: 'e2',
      startsAt: daysFromNow(5, 15),
      title: 'Activities committee sync',
      detail: 'Room 402',
    },
  ],
  tech: [
    {
      id: 'e3',
      startsAt: daysFromNow(1, 7),
      title: 'Maze Day 2026 — AV setup',
      detail: 'Gym',
    },
  ],
  publicity: [
    {
      id: 'e4',
      startsAt: daysFromNow(1, 8),
      title: 'Maze Day 2026 — photo shifts',
      detail: 'Main Quad',
    },
  ],
}

function membersFor(seed: RosterCommittee): CommitteeMember[] {
  const headSet = new Set(seed.headNames)
  return seed.members.slice(0, MAX_SHOWN).map((name) => ({
    id: `${seed.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    position: null,
    isHead: headSet.has(name),
  }))
}

export function sampleCommitteeDetail(id: string): CommitteeDetail | null {
  const seed = L2_ROSTER_COMMITTEES.find((committee) => committee.id === id)
  if (!seed) return null

  const summary = SAMPLE_COMMITTEES.find((committee) => committee.id === id)!
  const members = membersFor(seed)

  return {
    ...summary,
    members,
    remainingCount: Math.max(0, seed.members.length - members.length),
    tasks: TASKS[seed.id] ?? [],
    events: EVENTS[seed.id] ?? [],
  }
}
