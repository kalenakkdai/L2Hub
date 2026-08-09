/* ===========================================================================
 * SAMPLE DATA — committee roster for the L2 Campsite UI
 * ===========================================================================
 *
 * Names, emails, and membership match the Leadership 2 committee list.
 * The first listed camper is treated as the committee head until the backend
 * exposes elected-head assignments. Replace with `GET /committees` and
 * `GET /committees/{ref}` once those endpoints exist — the backend currently
 * exposes only `/committees/{ref}/tasks`.
 * ======================================================================== */

import type { CommitteeDetail, CommitteeMember, CommitteeSummary } from '../types'

function daysFromNow(days: number, hour: number): string {
  const date = new Date(Date.now() + days * 86_400_000)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

type CommitteeSeed = {
  id: string
  name: string
  email: string
  members: string[]
  /** Signed-in demo camper belongs to these committees. */
  isMine?: boolean
}

const COMMITTEE_SEEDS: CommitteeSeed[] = [
  {
    id: 'activities',
    name: 'Activities',
    email: 'msjateam@gmail.com',
    members: [
      'Jennifer Li',
      'Prahlad Vangeepuram Canchi',
      'Kaiwei Parks',
      'Hanna Rahmanian',
    ],
  },
  {
    id: 'community',
    name: 'Community',
    email: 'msjcommunity21.22@gmail.com',
    members: ['Helen Hu', 'Artur Kydyrmaev', 'Ariel Duong', 'Ruirui Liu'],
  },
  {
    id: 'elections',
    name: 'Elections',
    email: 'msjelections@gmail.com',
    members: ['Maya Dao', 'Nolan Lee', 'Andrew Yu', 'Megan Chu'],
  },
  {
    id: 'fundraising',
    name: 'Fundraising',
    email: 'msjfund@gmail.com',
    members: ['Tessa Tran', 'Aaqib Zishan', 'Nishka Iyer', 'Sahil Jain'],
  },
  {
    id: 'gtac',
    name: 'GTAC',
    email: 'msjgreenteam@gmail.com',
    members: [
      'Connie Li',
      'Prajna Srikanth',
      'Daojing Lin',
      'Anirudh Chakraborty',
      'Ashish Swaminathan',
    ],
  },
  {
    id: 'hcmc',
    name: 'HCMC',
    email: 'msjhs.hcmc@gmail.com',
    members: [
      'Bhavika Mehndiratta',
      'Sakshi Dixit',
      'Avina Wong',
      'Abirami Palaniaippan',
    ],
  },
  {
    id: 'publicity',
    name: 'Publicity',
    email: 'msjpublicity@gmail.com',
    members: ['Stephanie Leung', 'Aryaa Madhavani', 'Devon Mandal', 'Iris Hsuing'],
  },
  {
    id: 'student_store',
    name: 'Student Store',
    email: 'msjstudentstore@gmail.com',
    members: [
      'Justin Wu',
      'Vishal Lakshmanan',
      'Aashrith Morumganti',
      'Melody Gao',
    ],
  },
  {
    id: 'star',
    name: 'STAR',
    email: 'msjhs.star@gmail.com',
    members: [
      'Owen Yu',
      'Naren Thirumuruhan',
      'Kathlynd Huynh',
      'Nakshatra Rajeshkana',
      'Vardaan Iyer',
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    email: 'l2sportscommittee@gmail.com',
    members: ['Stephanie Yu', 'Joseph Stanfield', 'Landen Chu', 'Ethan Chen'],
  },
  {
    id: 'tech',
    name: 'Tech',
    email: 'msjhtechteam@gmail.com',
    members: ['Luis He', 'Nathan Huffman', 'Anna Guo', 'Samay Jain'],
    isMine: true,
  },
  {
    id: 'videography_photography',
    name: 'Videography/Photography',
    email: 'msjvideography@gmail.com',
    members: [
      'Sriya Vintha',
      'Elias Rashid',
      'Riley Ta',
      'Jadon Li',
      'Danny Lou',
    ],
  },
]

/** At most five campers are listed per camp; the rest roll into a count. */
const MAX_SHOWN = 5

export const SAMPLE_COMMITTEES: CommitteeSummary[] = COMMITTEE_SEEDS.map(
  (committee) => ({
    id: committee.id,
    name: committee.name,
    head: committee.members[0] ?? null,
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
      meta: 'Due Aug 8 · assigned to Jennifer Li',
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
      meta: 'Due Aug 15 · assigned to Hanna Rahmanian',
      status: 'In progress',
    },
  ],
  tech: [
    {
      id: 't4',
      title: 'Sound check for the gym PA',
      meta: 'Due Aug 7 · assigned to Luis He',
      status: 'In progress',
    },
  ],
  publicity: [
    {
      id: 't5',
      title: 'Post Maze Day recap reel',
      meta: 'Due Aug 9 · assigned to Stephanie Leung',
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

function membersFor(seed: CommitteeSeed): CommitteeMember[] {
  const headName = seed.members[0] ?? null
  return seed.members.slice(0, MAX_SHOWN).map((name, index) => ({
    id: `${seed.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    position: null,
    isHead: Boolean(headName) && name === headName && index === 0,
  }))
}

export function sampleCommitteeDetail(id: string): CommitteeDetail | null {
  const seed = COMMITTEE_SEEDS.find((committee) => committee.id === id)
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
