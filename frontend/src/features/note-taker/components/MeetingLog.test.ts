import { describe, expect, it } from 'vitest'
import { truncateLogName } from '../components/MeetingLog'

describe('truncateLogName', () => {
  it('keeps short titles intact', () => {
    expect(truncateLogName('Shopping list')).toBe('Shopping list')
  })

  it('ellipsizes long titles', () => {
    expect(truncateLogName('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghi…')
  })
})
