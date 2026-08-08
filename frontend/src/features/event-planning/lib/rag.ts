import type {
  HistoricalEventHit,
  PlanningOutline,
  PlanningRagResult,
} from '../types'

/**
 * Local historical agenda/knowledge corpus for Event Planning RAG assist.
 * No paid API — deterministic search over past Leadership events.
 */

type HistoricalRecord = {
  id: string
  name: string
  year: number
  summary: string
  themes: string[]
  agendaBeats: string[]
}

const CORPUS: HistoricalRecord[] = [
  {
    id: 'hist-maze-2025',
    name: 'Maze Day',
    year: 2025,
    summary:
      'Campus maze with timed stations. Strengths: clear volunteer roles and fast check-in. Improvements: earlier setup and more extension cords.',
    themes: ['stations', 'volunteers', 'check-in', 'setup', 'signage'],
    agendaBeats: [
      'Confirm station captains and radio channels',
      'Walk the maze path the night before',
      'Stage extension cords and power strips',
      'Print parent/student entry signs',
      'Schedule 30-minute early setup block',
    ],
  },
  {
    id: 'hist-rally-2025',
    name: 'Rally Night',
    year: 2025,
    summary:
      'Gym rally with spirit sections. Strengths: energy and seating plan. Improvements: clearer mic handoff and water stations.',
    themes: ['rally', 'spirit', 'mic', 'seating', 'water'],
    agendaBeats: [
      'Assign section captains by grade',
      'Rehearse mic handoff with ASB speakers',
      'Confirm AV checklist with tech crew',
      'Place water stations at gym doors',
      'Run a 10-minute seating drill',
    ],
  },
  {
    id: 'hist-spring-2024',
    name: 'Spring Formal',
    year: 2024,
    summary:
      'Ticketed dance with photo backdrop. Strengths: décor timeline. Improvements: coat check staffing and vendor arrival buffer.',
    themes: ['formal', 'tickets', 'decor', 'vendor', 'coat check'],
    agendaBeats: [
      'Finalize vendor load-in window',
      'Staff coat check in pairs',
      'Walk emergency exits with security',
      'Confirm ticket scanners and cash box',
      'Build décor install order by zone',
    ],
  },
  {
    id: 'hist-spirit-2024',
    name: 'Spirit Week',
    year: 2024,
    summary:
      'Theme days and lunchtime games. Strengths: publicity cadence. Improvements: spare props and weather backup.',
    themes: ['spirit', 'themes', 'publicity', 'games', 'weather'],
    agendaBeats: [
      'Publish theme calendar two weeks out',
      'Stock spare props per lunch game',
      'Assign rain backup locations',
      'Coordinate with Publicity for daily posts',
      'Brief lunch volunteers the day before',
    ],
  },
  {
    id: 'hist-cabinet-2025',
    name: 'Cabinet Planning Retreat',
    year: 2025,
    summary:
      'Officer retreat to lock semester calendar. Strengths: decision log. Improvements: clearer task owners after each vote.',
    themes: ['cabinet', 'calendar', 'owners', 'retreat'],
    agendaBeats: [
      'Open with semester goals',
      'Vote calendar holds with owners named aloud',
      'Capture decisions in a shared note',
      'Assign follow-ups before break',
      'Confirm next check-in date',
    ],
  },
]

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
}

/** Rank historical records by simple token overlap — good enough for local RAG. */
export function searchHistoricalEvents(query: string): HistoricalEventHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  return CORPUS.map((record) => {
    const haystack = tokenize(
      [record.name, record.summary, ...record.themes, ...record.agendaBeats].join(
        ' ',
      ),
    )
    const score = tokens.reduce(
      (sum, token) => sum + (haystack.includes(token) ? 1 : 0),
      0,
    )
    return {
      id: record.id,
      name: record.name,
      year: record.year,
      summary: record.summary,
      themes: record.themes,
      score,
    }
  })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.year - a.year)
}

export function buildPlanningOutline(
  query: string,
  hits: HistoricalEventHit[],
): PlanningOutline | null {
  if (hits.length === 0) return null
  const top = CORPUS.find((record) => record.id === hits[0].id)
  if (!top) return null

  const titleGuess =
    query.trim().length > 0
      ? query.trim().replace(/\s+/g, ' ')
      : `${top.name} planning`

  return {
    eventName: titleGuess,
    year: new Date().getFullYear(),
    guideline: `Draft outline grounded in ${top.name} (${top.year}) and related Leadership agendas. Adjust owners after Mr. Jan enables the plan.`,
    sections: [
      {
        title: 'Goals',
        bullets: [
          `Primary outcome inspired by ${top.name}`,
          'Success metrics the room can check at wrap',
        ],
      },
      {
        title: 'Roles & owners',
        bullets: [
          'Name a lead and backup for each major zone',
          'Assign by committee first, then fill gaps with individuals',
        ],
      },
      {
        title: 'Timeline',
        bullets: [
          'T−14: confirm budget and materials',
          'T−7: volunteer roster locked',
          'T−1: walkthrough and contingencies',
          'Event day: run-of-show with radio checks',
        ],
      },
      {
        title: 'Lessons carried forward',
        bullets: top.agendaBeats,
      },
      {
        title: 'Risks',
        bullets: [
          'Weather / venue conflict backup',
          'Staffing shortfalls and late arrivals',
        ],
      },
    ],
  }
}

export function runPlanningRag(query: string): PlanningRagResult {
  const hits = searchHistoricalEvents(query)
  return {
    query,
    hits,
    outline: buildPlanningOutline(query, hits),
  }
}

export function reportCategoryLabel(
  category: import('../types').PlanningReportCategory,
): string {
  switch (category) {
    case 'inefficiency':
      return 'Inefficiency'
    case 'disruptive':
      return 'Being disruptive'
    case 'not_completing_on_time':
      return 'Not completing things on time'
    case 'not_doing_work':
      return 'Not doing their work'
    case 'other':
      return 'Other'
  }
}
