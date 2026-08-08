import { describe, expect, it } from 'vitest'
import {
  countEntriesByTab,
  filterEntriesByTab,
  gradebookTabFor,
  parseGradebookTab,
} from './tabs'
import type { GradebookEntry } from '../types'

function entry(
  partial: Pick<GradebookEntry, 'id' | 'status'> &
    Partial<GradebookEntry>,
): GradebookEntry {
  return {
    assignmentId: partial.id,
    assignmentTitle: partial.assignmentTitle ?? partial.id,
    assignmentType: 'task',
    score: null,
    pointsPossible: 10,
    ...partial,
  }
}

describe('parseGradebookTab', () => {
  it('defaults unknown values to upcoming', () => {
    expect(parseGradebookTab(null)).toBe('upcoming')
    expect(parseGradebookTab('nope')).toBe('upcoming')
  })

  it('accepts the three grades tabs', () => {
    expect(parseGradebookTab('missing')).toBe('missing')
    expect(parseGradebookTab('completed')).toBe('completed')
    expect(parseGradebookTab('upcoming')).toBe('upcoming')
  })
})

describe('gradebookTabFor', () => {
  it('puts overdue unsubmitted work in missing', () => {
    expect(gradebookTabFor(entry({ id: '1', status: 'missing' }))).toBe(
      'missing',
    )
  })

  it('puts finished work in completed', () => {
    expect(gradebookTabFor(entry({ id: '1', status: 'graded' }))).toBe(
      'completed',
    )
    expect(gradebookTabFor(entry({ id: '2', status: 'submitted' }))).toBe(
      'completed',
    )
    expect(gradebookTabFor(entry({ id: '3', status: 'late' }))).toBe(
      'completed',
    )
    expect(gradebookTabFor(entry({ id: '4', status: 'excused' }))).toBe(
      'completed',
    )
  })

  it('puts open work in upcoming', () => {
    expect(gradebookTabFor(entry({ id: '1', status: 'not_started' }))).toBe(
      'upcoming',
    )
    expect(gradebookTabFor(entry({ id: '2', status: 'draft' }))).toBe(
      'upcoming',
    )
  })
})

describe('filterEntriesByTab', () => {
  const entries = [
    entry({ id: 'm', status: 'missing' }),
    entry({ id: 'c', status: 'graded' }),
    entry({ id: 'u', status: 'draft' }),
  ]

  it('filters to one tab at a time', () => {
    expect(filterEntriesByTab(entries, 'missing').map((e) => e.id)).toEqual([
      'm',
    ])
    expect(filterEntriesByTab(entries, 'completed').map((e) => e.id)).toEqual([
      'c',
    ])
    expect(filterEntriesByTab(entries, 'upcoming').map((e) => e.id)).toEqual([
      'u',
    ])
  })

  it('counts every entry exactly once', () => {
    const counts = countEntriesByTab(entries)
    expect(counts.missing + counts.completed + counts.upcoming).toBe(
      entries.length,
    )
  })
})
