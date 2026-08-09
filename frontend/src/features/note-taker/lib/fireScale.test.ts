import { describe, expect, it } from 'vitest'
import { fireIntensityForLogCount, flameScale } from './fireScale'

describe('fireIntensityForLogCount', () => {
  it('banks an empty pit', () => {
    expect(fireIntensityForLogCount(0)).toBe('banked')
    expect(fireIntensityForLogCount(-3)).toBe('banked')
  })

  it('grows through small, medium, and large', () => {
    expect(fireIntensityForLogCount(1)).toBe('small')
    expect(fireIntensityForLogCount(2)).toBe('small')
    expect(fireIntensityForLogCount(3)).toBe('medium')
    expect(fireIntensityForLogCount(5)).toBe('medium')
    expect(fireIntensityForLogCount(6)).toBe('large')
    expect(fireIntensityForLogCount(99)).toBe('large')
  })
})

describe('flameScale', () => {
  it('gives larger flames to hotter intensities', () => {
    expect(flameScale('large').outerH).toBeGreaterThan(flameScale('medium').outerH)
    expect(flameScale('medium').outerH).toBeGreaterThan(flameScale('small').outerH)
    expect(flameScale('small').outerH).toBeGreaterThan(flameScale('banked').outerH)
  })
})
