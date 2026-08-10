import { describe, expect, it } from 'vitest'
import {
  owlOverTent,
  rectsOverlap,
  tentPerchPoint,
  type Rect,
} from './owlTents'

const box = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

describe('rectsOverlap', () => {
  it('detects overlapping boxes', () => {
    expect(rectsOverlap(box(0, 0, 10, 10), box(5, 5, 10, 10))).toBe(true)
  })

  it('rejects disjoint boxes', () => {
    expect(rectsOverlap(box(0, 0, 10, 10), box(20, 0, 10, 10))).toBe(false)
    expect(rectsOverlap(box(0, 0, 10, 10), box(0, 40, 10, 10))).toBe(false)
  })

  it('treats a shared edge as no overlap', () => {
    // Boxes flush against each other should not read as a collision.
    expect(rectsOverlap(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(false)
  })
})

describe('owlOverTent', () => {
  const tent = box(100, 200, 60, 40)

  it('opens the doors when the owl sits on top of the tent', () => {
    expect(owlOverTent(box(110, 210, 30, 20), tent)).toBe(true)
  })

  it('opens the doors when the owl skims just above the peak', () => {
    // 10px above the tent, within the default overhang.
    expect(owlOverTent(box(110, 180, 30, 15), tent, { overhang: 28 })).toBe(true)
  })

  it('stays shut when the owl is well above the tent', () => {
    expect(owlOverTent(box(110, 120, 30, 20), tent, { overhang: 28 })).toBe(false)
  })

  it('stays shut when the owl passes to the side', () => {
    expect(owlOverTent(box(200, 205, 30, 20), tent)).toBe(false)
  })

  it('respects a custom overhang', () => {
    const owl = box(110, 170, 30, 15) // bottom at 185, 15px above the tent top
    expect(owlOverTent(owl, tent, { overhang: 5 })).toBe(false)
    expect(owlOverTent(owl, tent, { overhang: 40 })).toBe(true)
  })

  it('never triggers against an unmeasured (zero-size) tent', () => {
    // jsdom / pre-layout nodes report empty rects; those must not fire.
    expect(owlOverTent(box(0, 0, 50, 50), box(0, 0, 0, 0))).toBe(false)
  })
})

describe('tentPerchPoint', () => {
  it('centres the owl over the roof and rests its feet on the marker', () => {
    expect(tentPerchPoint(box(118, 190, 4, 4), 100)).toEqual({
      x: 120,
      y: 156,
    })
  })

  it('ignores an unmeasured perch marker', () => {
    expect(tentPerchPoint(box(0, 0, 0, 0), 116)).toBeNull()
  })
})
