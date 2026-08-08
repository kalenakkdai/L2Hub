import type { PlanAgendaDocument, PlanAgendaSection } from '../types'
import { runPlanningRag } from './rag'

/**
 * Builds the meeting agenda that every new plan starts with.
 *
 * Shape mirrors the Mission San Jose Winter Ball planning agendas
 * (Nov 11.12.2025 / Dec 12.05.2025): school header, school year, titled
 * agenda date, Goals, then Roman-numeral sections for Attendees,
 * To-do before meeting, and Agenda / Meeting Notes.
 */

const SCHOOL_NAME = 'MISSION SAN JOSE HIGH SCHOOL'
const TEMPLATE_SOURCE = 'Winter Ball planning agenda'

/** MSJ school years run Aug 1 → Jul 31. */
export function schoolYearFor(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() // 0-indexed
  const start = month >= 7 ? year : year - 1
  return `${start}-${start + 1}`
}

/** Formats as M.D.YYYY the way the Winter Ball agendas do (e.g. 11.12.2025). */
export function formatAgendaDate(date: Date): string {
  return `${date.getMonth() + 1}.${date.getDate()}.${date.getFullYear()}`
}

function parseEventDate(eventDate: string | null | undefined, fallback: Date): Date {
  if (!eventDate) return fallback
  // Date-only inputs are UTC midnight; build a local calendar date instead.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const parsed = new Date(eventDate)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function lessonBeats(title: string, summary: string): string[] {
  const rag = runPlanningRag(`${title} ${summary}`)
  const top = rag.hits[0]
  if (!top) {
    return [
      'Confirm budget and materials owners',
      'Lock volunteer roster one week out',
      'Walk the venue the day before',
      'Publish publicity cadence with reel and flyer dates',
      'Name a lead and backup for each major zone',
    ]
  }
  // Prefer the historical agenda beats from the closest past event.
  const outline = rag.outline
  const carried = outline?.sections.find((s) => s.title === 'Lessons carried forward')
  return carried?.bullets?.length
    ? carried.bullets
    : [
        `Carry forward what worked from ${top.name} (${top.year})`,
        'Confirm owners aloud before adjourning',
        'Capture decisions in a shared note',
      ]
}

export type BuildPlanAgendaInput = {
  title: string
  summary: string
  eventDate?: string | null
  /** Injected for tests so the generated date stays stable. */
  now?: Date
}

/**
 * Auto-generates a Winter Ball–style meeting agenda document for a new plan.
 * Always returns a document — create plan must never leave the agenda blank.
 */
export function buildPlanAgendaDocument(input: BuildPlanAgendaInput): PlanAgendaDocument {
  const now = input.now ?? new Date()
  const eventDate = parseEventDate(input.eventDate, now)
  const title = input.title.trim() || 'Leadership Event'
  const summary = input.summary.trim()
  const beats = lessonBeats(title, summary)
  const ragHit = runPlanningRag(`${title} ${summary}`).hits[0]

  const goals = [
    summary || `Plan and staff ${title}`,
    'Finalize owners, budget, and publicity timeline',
    'Confirm materials and venue needs before the next meeting',
    ...(ragHit
      ? [`Carry forward lessons from ${ragHit.name} (${ragHit.year})`]
      : []),
  ]

  const sections: PlanAgendaSection[] = [
    {
      roman: 'I',
      title: 'Attendees',
      items: [
        {
          letter: 'a',
          text: 'All ASBOs, relevant class officers, assigned committees, Mr. Jan',
        },
        {
          letter: 'b',
          text: 'Meeting called to order at:',
        },
      ],
    },
    {
      roman: 'II',
      title: 'To-do before meeting',
      items: [
        {
          letter: 'a',
          text: 'ASBOs: confirm admin needs (ticketing, guests, venue)',
        },
        {
          letter: 'b',
          text: 'Committee leads: bring top options and open questions',
          subItems: beats.slice(0, 3),
        },
        {
          letter: 'c',
          text: 'Publicity: deco / promo ideas pulled from prior event sheets',
        },
      ],
    },
    {
      roman: 'III',
      title: 'Agenda / Meeting Notes',
      items: [
        {
          letter: 'a',
          text: 'Recap from last meeting',
          subItems: summary
            ? [`Brief: ${summary}`]
            : ['Review prior decisions and open items'],
        },
        {
          letter: 'b',
          text: `Finalize ${title} plan details`,
          subItems: [
            `Event date: ${input.eventDate ? formatAgendaDate(eventDate) : 'TBD'}`,
            'Theme / concept',
            'Budget and revenue target',
          ],
        },
        {
          letter: 'c',
          text: 'Materials, decorations, and vendors',
        },
        {
          letter: 'd',
          text: 'Publicity deadlines (reels, posts, flyers, announcements)',
        },
        {
          letter: 'e',
          text: 'Ticketing schedule and system',
        },
        {
          letter: 'f',
          text: 'Lessons carried forward',
          subItems: beats,
        },
        {
          letter: 'g',
          text: 'To do list before next meeting',
          subItems: [
            'ASBOs: confirm anything needed with admin',
            'Committee leads: owners named for each open item',
            'Publicity: measurements, materials list, rough sketch',
          ],
        },
        {
          letter: 'h',
          text: 'Next meeting: TBD',
        },
      ],
    },
  ]

  return {
    schoolName: SCHOOL_NAME,
    schoolYear: schoolYearFor(eventDate),
    title: `${title} Meeting Agenda for ${formatAgendaDate(now)}`,
    goals,
    sections,
    generatedAt: now.toISOString(),
    templateSource: TEMPLATE_SOURCE,
  }
}
