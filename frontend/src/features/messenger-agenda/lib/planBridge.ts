import type { PlanAgendaDocument } from '../../event-planning/types'
import type { AgendaBullet, MessengerAgendaSession } from '../types'

/** The plan document is plain text, so attribution rides along in the line. */
function attributed(bullet: AgendaBullet): string {
  return bullet.speaker ? `${bullet.text} — ${bullet.speaker}` : bullet.text
}

/** Map a finalized Messenger agenda onto the event-planning agenda document. */
export function agendaToPlanDocument(
  session: MessengerAgendaSession,
): PlanAgendaDocument {
  const agenda = session.agenda
  const now = new Date()
  const sections = (agenda.sections ?? []).map((section, index) => ({
    roman: roman(index + 1),
    title: section.title,
    items: section.bullets.map((bullet) => ({ text: attributed(bullet) })),
  }))

  return {
    schoolName: 'MISSION SAN JOSE HIGH SCHOOL',
    schoolYear: schoolYearFor(now),
    title: agenda.title || session.title,
    goals: agenda.goals?.length
      ? agenda.goals.map(attributed)
      : agenda.summary
        ? [agenda.summary]
        : ['Review Messenger capture decisions'],
    sections:
      sections.length > 0
        ? sections
        : [
            {
              roman: 'I',
              title: 'Agenda / Meeting Notes',
              items: [{ text: session.capturedText.slice(0, 200) || 'No notes' }],
            },
          ],
    generatedAt: now.toISOString(),
    templateSource: 'Messenger Agenda capture',
  }
}

function schoolYearFor(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = month >= 7 ? year : year - 1
  return `${start}-${start + 1}`
}

function roman(n: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let remaining = n
  let out = ''
  for (const [value, numeral] of map) {
    while (remaining >= value) {
      out += numeral
      remaining -= value
    }
  }
  return out || 'I'
}
