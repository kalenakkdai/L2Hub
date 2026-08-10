import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD_VIEW, parseViewMode, summarizeColumn } from './boardView'
import type { BoardColumn, BoardTask, TaskStatus } from './api'

const TODAY = '2026-08-12'

function task(status: TaskStatus, dueOn: string | null = null): BoardTask {
  return {
    id: Math.random().toString(36),
    committeeId: 'c1',
    title: 'A task',
    details: '',
    status,
    assignee: null,
    dueOn,
    createdAt: '2026-08-01T00:00:00Z',
  }
}

function column(tasks: BoardTask[]): BoardColumn {
  return {
    id: 'c1',
    name: 'Fundraising',
    slug: 'fundraising',
    isMine: false,
    canAddTask: false,
    openRequestCount: 0,
    tasks,
  }
}

describe('parseViewMode', () => {
  it('falls back to the side-by-side board for anything unrecognised', () => {
    expect(parseViewMode(null)).toBe(DEFAULT_BOARD_VIEW)
    expect(parseViewMode('')).toBe(DEFAULT_BOARD_VIEW)
    expect(parseViewMode('nope')).toBe(DEFAULT_BOARD_VIEW)
    expect(parseViewMode('COMPACT')).toBe(DEFAULT_BOARD_VIEW)
  })

  it('accepts compact', () => {
    expect(parseViewMode('compact')).toBe('compact')
  })
})

describe('summarizeColumn', () => {
  it('counts what is done, in progress, and still to do', () => {
    const summary = summarizeColumn(
      column([task('todo'), task('todo'), task('doing'), task('done')]),
      TODAY,
    )

    expect(summary.total).toBe(4)
    expect(summary.todo).toBe(2)
    expect(summary.doing).toBe(1)
    expect(summary.done).toBe(1)
    expect(summary.text).toBe('4 tasks · 1 in progress · 1 done')
  })

  it('says a committee has nothing rather than counting to zero', () => {
    expect(summarizeColumn(column([]), TODAY).text).toBe('No tasks')
  })

  it('reads one task as singular', () => {
    expect(summarizeColumn(column([task('todo')]), TODAY).text).toBe('1 task')
  })

  it('leaves out the parts that are zero', () => {
    const summary = summarizeColumn(column([task('todo'), task('todo')]), TODAY)
    expect(summary.text).toBe('2 tasks')
  })

  it('counts what is late and what is nearly late', () => {
    const summary = summarizeColumn(
      column([
        task('todo', '2026-08-01'), // overdue
        task('todo', '2026-08-12'), // today
        task('doing', '2026-08-14'), // soon
        task('todo', '2026-12-01'), // later
      ]),
      TODAY,
    )

    expect(summary.overdue).toBe(1)
    expect(summary.dueSoon).toBe(2)
  })

  it('does not count a finished task as overdue', () => {
    const summary = summarizeColumn(column([task('done', '2026-01-01')]), TODAY)

    expect(summary.overdue).toBe(0)
    expect(summary.dueSoon).toBe(0)
  })
})
