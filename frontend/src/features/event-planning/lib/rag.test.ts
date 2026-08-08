import { describe, expect, it } from 'vitest'
import {
  buildPlanningOutline,
  runPlanningRag,
  searchHistoricalEvents,
} from './rag'

describe('searchHistoricalEvents', () => {
  it('ranks Maze Day when the query mentions maze stations', () => {
    const hits = searchHistoricalEvents('maze stations setup volunteers')
    expect(hits[0]?.name).toBe('Maze Day')
    expect(hits[0]?.score).toBeGreaterThan(0)
  })

  it('returns nothing for an empty query', () => {
    expect(searchHistoricalEvents('')).toEqual([])
  })
})

describe('runPlanningRag', () => {
  it('builds an outline from the top historical hit', () => {
    const result = runPlanningRag('rally mic seating')
    expect(result.hits[0]?.name).toBe('Rally Night')
    expect(result.outline).not.toBeNull()
    expect(result.outline?.sections.some((s) => s.title === 'Timeline')).toBe(
      true,
    )
    expect(buildPlanningOutline('rally', result.hits)?.guideline).toMatch(
      /Rally Night/,
    )
  })

  it('surfaces Winter Ball when the query matches that formal', () => {
    const result = runPlanningRag('winter ball lanterns tickets publicity')
    expect(result.hits[0]?.name).toBe('Winter Ball')
    expect(result.outline?.guideline).toMatch(/Winter Ball/)
  })
})
