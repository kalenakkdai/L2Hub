/* ===========================================================================
 * SAMPLE DATA — FOR VISUAL DEVELOPMENT ONLY
 * ===========================================================================
 *
 * The twelve committees that run the L2 Campsite. Names and counts are
 * invented; the people are fictional. Replace with `GET /committees` and
 * `GET /committees/{ref}` once those exist — the backend currently exposes
 * only `/committees/{ref}/tasks`.
 *
 * Membership is many-to-many: a camper can sit on several committees and hold
 * an elected position at the same time. That is modelled here so the UI is
 * built against the real relationship rather than a simplified one.
 * ======================================================================== */

import type { CommitteeDetail, CommitteeMember, CommitteeSummary } from '../types'

function daysFromNow(days: number, hour: number): string {
  const date = new Date(Date.now() + days * 86_400_000)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export const SAMPLE_COMMITTEES: CommitteeSummary[] = [
  { id: 'activities', name: 'Activities', lead: 'Kalena Dai', email: 'activities@msjhs.org', camperCount: 14, isMine: true },
  { id: 'community', name: 'Community', lead: 'Daniel Okafor', email: 'community@msjhs.org', camperCount: 11, isMine: false },
  { id: 'elections', name: 'Elections', lead: null, email: 'elections@msjhs.org', camperCount: 7, isMine: false },
  { id: 'fundraising', name: 'Fundraising', lead: 'Ethan Brooks', email: 'fundraising@msjhs.org', camperCount: 12, isMine: false },
  { id: 'gtac', name: 'GTAC', lead: 'Naomi Chen', email: 'gtac@msjhs.org', camperCount: 9, isMine: false },
  { id: 'hcmc', name: 'HCMC', lead: 'Jordan Reyes', email: 'hcmc@msjhs.org', camperCount: 10, isMine: false },
  { id: 'publicity', name: 'Publicity', lead: 'Ava Lindqvist', email: 'publicity@msjhs.org', camperCount: 13, isMine: false },
  { id: 'store', name: 'Student Store', lead: 'Marcus Bell', email: 'store@msjhs.org', camperCount: 8, isMine: false },
  { id: 'star', name: 'STAR', lead: 'Sofia Duarte', email: 'star@msjhs.org', camperCount: 9, isMine: false },
  { id: 'sports', name: 'Sports', lead: 'Tyler Nakamura', email: 'sports@msjhs.org', camperCount: 11, isMine: false },
  { id: 'tech', name: 'Tech', lead: 'Kalena Dai', email: 'tech@msjhs.org', camperCount: 6, isMine: true },
  { id: 'media', name: 'Videography/Photography', lead: 'Ruby Alvarez', email: 'media@msjhs.org', camperCount: 10, isMine: false },
]

const ROSTER: { name: string; position: string | null }[] = [
  { name: 'Kalena Dai', position: 'Activities Coordinator' },
  { name: 'Priya Raman', position: 'Senior Class Officer' },
  { name: 'Daniel Okafor', position: null },
  { name: 'Mia Sandoval', position: 'Secretary' },
  { name: 'Ethan Brooks', position: null },
  { name: 'Naomi Chen', position: 'Junior Class Officer' },
  { name: 'Jordan Reyes', position: null },
  { name: 'Ava Lindqvist', position: null },
  { name: 'Marcus Bell', position: 'Treasurer' },
  { name: 'Sofia Duarte', position: null },
  { name: 'Tyler Nakamura', position: null },
  { name: 'Ruby Alvarez', position: null },
  { name: 'Leo Fontaine', position: 'President' },
  { name: 'Hana Kimura', position: 'Vice President' },
  { name: 'Owen Castillo', position: null },
  { name: 'Zara Haddad', position: null },
]

/** Derives a stable roster for a committee, lead first. */
function rosterFor(committee: CommitteeSummary, index: number, limit: number): CommitteeMember[] {
  const lead = committee.lead
    ? (ROSTER.find((person) => person.name === committee.lead) ?? null)
    : null
  const rest = ROSTER.filter((person) => person.name !== lead?.name)

  const picked: typeof ROSTER = []
  for (let i = 0; picked.length < limit - (lead ? 1 : 0) && i < rest.length; i++) {
    const candidate = rest[(index * 5 + i * 3) % rest.length]
    if (!picked.includes(candidate)) picked.push(candidate)
  }

  const all = lead ? [lead, ...picked] : picked

  return all.slice(0, limit).map((person) => ({
    id: `${committee.id}-${person.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: person.name,
    position: person.position,
    isLead: person.name === lead?.name,
  }))
}

const TASKS: Record<string, CommitteeDetail['tasks']> = {
  activities: [
    { id: 't1', title: 'Confirm booth layout with facilities', meta: 'Due Aug 8 · assigned to Priya Raman', status: 'In progress' },
    { id: 't2', title: 'Collect Maze Day supply receipts', meta: 'Due Aug 10 · assigned to Ethan Brooks', status: 'Not started' },
    { id: 't3', title: 'Draft fall rally run-of-show', meta: 'Due Aug 15 · assigned to Kalena Dai', status: 'In progress' },
  ],
  tech: [
    { id: 't4', title: 'Sound check for the gym PA', meta: 'Due Aug 7 · assigned to Kalena Dai', status: 'In progress' },
  ],
  publicity: [
    { id: 't5', title: 'Post Maze Day recap reel', meta: 'Due Aug 9 · assigned to Ava Lindqvist', status: 'Not started' },
  ],
}

const EVENTS: Record<string, CommitteeDetail['events']> = {
  activities: [
    { id: 'e1', startsAt: daysFromNow(1, 8), title: 'Maze Day 2026', detail: 'Main Quad' },
    { id: 'e2', startsAt: daysFromNow(5, 15), title: 'Activities committee sync', detail: 'Room 402' },
  ],
  tech: [{ id: 'e3', startsAt: daysFromNow(1, 7), title: 'Maze Day 2026 — AV setup', detail: 'Gym' }],
  publicity: [
    { id: 'e4', startsAt: daysFromNow(1, 8), title: 'Maze Day 2026 — photo shifts', detail: 'Main Quad' },
  ],
}

const MAX_SHOWN = 6

export function sampleCommitteeDetail(id: string): CommitteeDetail | null {
  const index = SAMPLE_COMMITTEES.findIndex((committee) => committee.id === id)
  if (index === -1) return null

  const committee = SAMPLE_COMMITTEES[index]
  const shown = Math.min(committee.camperCount, MAX_SHOWN)

  return {
    ...committee,
    members: rosterFor(committee, index, shown),
    remainingCount: Math.max(0, committee.camperCount - shown),
    tasks: TASKS[committee.id] ?? [],
    events: EVENTS[committee.id] ?? [],
  }
}
