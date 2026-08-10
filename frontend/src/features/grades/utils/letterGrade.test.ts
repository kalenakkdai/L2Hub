import { describe, expect, it } from 'vitest'
import { isAPlus, letterGrade } from './letterGrade'

describe('letterGrade', () => {
  it('maps the A+ band at 97%', () => {
    expect(letterGrade(97)).toBe('A+')
    expect(letterGrade(100)).toBe('A+')
    expect(letterGrade(96.9)).toBe('A')
    expect(isAPlus(97)).toBe(true)
    expect(isAPlus(96.9)).toBe(false)
  })
})
