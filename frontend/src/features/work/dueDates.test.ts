import { describe, expect, it } from 'vitest'
import { dueLabel, dueState, formatDueDate, taskDueState, todayStamp } from './dueDates'
import type { BoardTask } from './api'

const TODAY = '2026-08-12'

function task(overrides: Partial<BoardTask> = {}): BoardTask {
  return {
    id: 't1',
    committeeId: 'c1',
    title: 'Book the venue',
    details: '',
    status: 'todo',
    assignee: null,
    dueOn: null,
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('formatDueDate', () => {
  it('reads a plain date in the local zone rather than shifting it a day', () => {
    // Parsed as UTC this renders as Aug 11 anywhere west of Greenwich.
    expect(formatDueDate('2026-08-12')).toBe('Aug 12')
  })

  it('has nothing to say about a task with no due date', () => {
    expect(formatDueDate(null)).toBeNull()
    expect(formatDueDate('not-a-date')).toBeNull()
  })
})

describe('todayStamp', () => {
  it('formats as the same YYYY-MM-DD shape the API sends', () => {
    expect(todayStamp(new Date(2026, 7, 3))).toBe('2026-08-03')
  })
})

describe('dueState', () => {
  it('calls yesterday overdue and today due today', () => {
    expect(dueState('2026-08-11', TODAY)).toBe('overdue')
    expect(dueState(TODAY, TODAY)).toBe('today')
  })

  it('treats anything within three days as soon and the fourth as later', () => {
    expect(dueState('2026-08-13', TODAY)).toBe('soon')
    expect(dueState('2026-08-15', TODAY)).toBe('soon')
    expect(dueState('2026-08-16', TODAY)).toBe('later')
  })

  it('says nothing about a task with no deadline', () => {
    expect(dueState(null, TODAY)).toBe('none')
  })

  it('crosses a month boundary without arithmetic surprises', () => {
    expect(dueState('2026-09-01', '2026-08-31')).toBe('soon')
    expect(dueState('2026-08-31', '2026-09-01')).toBe('overdue')
  })
})

describe('taskDueState', () => {
  it('never marks a finished task late', () => {
    const finished = task({ dueOn: '2026-01-01', status: 'done' })
    expect(taskDueState(finished, TODAY)).toBe('none')
  })

  it('still marks unfinished work late', () => {
    expect(taskDueState(task({ dueOn: '2026-01-01' }), TODAY)).toBe('overdue')
  })
})

describe('dueLabel', () => {
  it('names the state in words, not only in colour', () => {
    expect(dueLabel(task({ dueOn: '2026-08-11' }), TODAY)?.text).toBe('Overdue · Aug 11')
    expect(dueLabel(task({ dueOn: TODAY }), TODAY)?.text).toBe('Due today')
    expect(dueLabel(task({ dueOn: '2026-08-13' }), TODAY)?.text).toBe(
      'Due tomorrow · Aug 13',
    )
    expect(dueLabel(task({ dueOn: '2026-08-14' }), TODAY)?.text).toBe(
      'Due in 2 days · Aug 14',
    )
  })

  it('leaves a distant deadline as a plain date', () => {
    const label = dueLabel(task({ dueOn: '2026-11-12' }), TODAY)
    expect(label).toEqual({ text: 'due Nov 12', tone: 'neutral' })
  })

  it('has nothing to show for a task with no deadline', () => {
    expect(dueLabel(task(), TODAY)).toBeNull()
  })
})
