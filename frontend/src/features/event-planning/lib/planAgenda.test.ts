import { describe, expect, it } from 'vitest'
import {
  buildPlanAgendaDocument,
  formatAgendaDate,
  schoolYearFor,
} from './planAgenda'

const NOW = new Date(2026, 7, 7) // Aug 7, 2026 local

describe('schoolYearFor', () => {
  it('starts the school year in August', () => {
    expect(schoolYearFor(new Date(2026, 7, 1))).toBe('2026-2027')
    expect(schoolYearFor(new Date(2026, 6, 31))).toBe('2025-2026')
  })

  it('puts a February Winter Ball in the prior-started school year', () => {
    expect(schoolYearFor(new Date(2026, 1, 20))).toBe('2025-2026')
  })
})

describe('formatAgendaDate', () => {
  it('matches the Winter Ball M.D.YYYY style', () => {
    expect(formatAgendaDate(new Date(2025, 10, 12))).toBe('11.12.2025')
    expect(formatAgendaDate(new Date(2025, 11, 5))).toBe('12.5.2025')
  })
})

describe('buildPlanAgendaDocument', () => {
  it('always returns a Winter Ball–shaped agenda', () => {
    const agenda = buildPlanAgendaDocument({
      title: 'Club Fair',
      summary: 'Tables in the quad',
      eventDate: '2026-10-18',
      now: NOW,
    })

    expect(agenda.schoolName).toBe('MISSION SAN JOSE HIGH SCHOOL')
    expect(agenda.schoolYear).toBe('2026-2027')
    expect(agenda.title).toBe('Club Fair Meeting Agenda for 8.7.2026')
    expect(agenda.templateSource).toBe('Winter Ball planning agenda')
    expect(agenda.goals.length).toBeGreaterThan(0)
    expect(agenda.sections.map((s) => `${s.roman}. ${s.title}`)).toEqual([
      'I. Attendees',
      'II. To-do before meeting',
      'III. Agenda / Meeting Notes',
    ])
  })

  it('keeps the Roman-numeral meeting flow from the Winter Ball docs', () => {
    const agenda = buildPlanAgendaDocument({
      title: 'Winter Ball',
      summary: 'Enchanted Forest formal',
      eventDate: '2026-02-20',
      now: NOW,
    })

    const notes = agenda.sections.find((s) => s.roman === 'III')
    expect(notes?.items.map((item) => item.letter)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
    ])
    expect(notes?.items.at(-1)?.text).toMatch(/Next meeting/)
    expect(notes?.items.find((item) => item.letter === 'g')?.subItems).toEqual(
      expect.arrayContaining([expect.stringMatching(/ASBOs/)]),
    )
  })

  it('grounds Winter Ball plans in the Winter Ball historical beats', () => {
    const agenda = buildPlanAgendaDocument({
      title: 'Winter Ball 2027',
      summary: 'Ticketed formal with lanterns and progressive ticket prices',
      eventDate: '2027-02-19',
      now: NOW,
    })

    expect(agenda.goals.some((g) => /Winter Ball/.test(g))).toBe(true)
    const lessons = agenda.sections
      .flatMap((s) => s.items)
      .find((item) => item.text === 'Lessons carried forward')
    expect(lessons?.subItems?.some((b) => /ticket|décor|admin|publicity/i.test(b))).toBe(
      true,
    )
  })

  it('still produces a full agenda when there is no event date', () => {
    const agenda = buildPlanAgendaDocument({
      title: 'Spirit lunch',
      summary: '',
      now: NOW,
    })

    expect(agenda.sections).toHaveLength(3)
    expect(agenda.title).toContain('Spirit lunch Meeting Agenda')
    const finalize = agenda.sections[2].items.find((item) => item.letter === 'b')
    expect(finalize?.subItems?.some((line) => /Event date: TBD/.test(line))).toBe(
      true,
    )
  })
})
