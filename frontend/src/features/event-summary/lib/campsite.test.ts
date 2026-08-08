import { describe, expect, it } from 'vitest'
import {
  FIRE_CLEARANCE,
  FIRE_X,
  GROUND_WIDTH,
  L2_COMMITTEES,
  TENT_WIDTH,
  campsiteTents,
  forestBand,
  mulberry32,
  shortCommitteeLabel,
  splitTentRows,
  tentColor,
  type Tent,
} from './campsite'

function halfWidth(tent: Tent): number {
  return (TENT_WIDTH * tent.scale) / 2
}

function rosterOf(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Committee ${i + 1}`)
}

describe('mulberry32', () => {
  it('replays the same sequence for a seed', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('stays inside the unit interval', () => {
    const random = mulberry32(99)
    for (let i = 0; i < 200; i += 1) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('forestBand', () => {
  const options = {
    seed: 4242,
    count: 20,
    baseY: 120,
    depth: 10,
    minHeight: 30,
    maxHeight: 70,
  }

  it('grows the requested number of trees', () => {
    expect(forestBand(options)).toHaveLength(20)
    expect(forestBand({ ...options, count: 0 })).toEqual([])
    expect(forestBand({ ...options, count: -3 })).toEqual([])
  })

  it('regrows identically for the same seed and differently for another', () => {
    expect(forestBand(options)).toEqual(forestBand(options))
    expect(forestBand({ ...options, seed: 4243 })).not.toEqual(
      forestBand(options),
    )
  })

  it('keeps every tree inside the band it was given', () => {
    for (const tree of forestBand({ ...options, from: 0, to: 400 })) {
      expect(tree.x).toBeGreaterThanOrEqual(0)
      expect(tree.x).toBeLessThanOrEqual(400)
      expect(tree.height).toBeGreaterThanOrEqual(options.minHeight)
      expect(tree.height).toBeLessThanOrEqual(options.maxHeight)
      expect(tree.baseY).toBeGreaterThanOrEqual(options.baseY)
      expect(tree.baseY).toBeLessThanOrEqual(options.baseY + options.depth)
      expect(tree.width).toBeGreaterThan(0)
    }
  })

  it('returns trees furthest back first so nearer pines paint over them', () => {
    const band = forestBand(options)
    for (let i = 1; i < band.length; i += 1) {
      expect(band[i].baseY).toBeGreaterThanOrEqual(band[i - 1].baseY)
    }
  })
})

describe('splitTentRows', () => {
  it('keeps the front row even so the fire is never blocked', () => {
    for (let count = 2; count <= 40; count += 1) {
      expect(splitTentRows(count).front % 2).toBe(0)
    }
  })

  it('pitches a lone tent behind the fire', () => {
    expect(splitTentRows(1)).toEqual({ front: 0, back: 1 })
  })

  it('accounts for every committee', () => {
    for (let count = 0; count <= 40; count += 1) {
      const { front, back } = splitTentRows(count)
      expect(front + back).toBe(count)
      expect(front).toBeGreaterThanOrEqual(0)
      expect(back).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('shortCommitteeLabel', () => {
  it('drops a redundant Committee suffix', () => {
    expect(shortCommitteeLabel('Community Committee')).toBe('Community')
    expect(shortCommitteeLabel('Spirit committee')).toBe('Spirit')
  })

  it('leaves short names untouched', () => {
    expect(shortCommitteeLabel('Publicity')).toBe('Publicity')
    expect(shortCommitteeLabel('  Tech  ')).toBe('Tech')
  })

  it('truncates names too long for a tent', () => {
    expect(shortCommitteeLabel('Fundraising and Finance')).toBe('Fundraising…')
    expect(shortCommitteeLabel('Fundraising and Finance').length).toBe(12)
  })
})

describe('tentColor', () => {
  it('cycles through the palette for any roster size', () => {
    expect(tentColor(0)).toBe(tentColor(11))
    expect(tentColor(0)).not.toBe(tentColor(1))
    expect(tentColor(-1)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('campsiteTents', () => {
  it('pitches one tent per committee, in roster order', () => {
    const tents = campsiteTents(L2_COMMITTEES)
    expect(tents).toHaveLength(L2_COMMITTEES.length)
    expect(tents.map((tent) => tent.name).sort()).toEqual(
      [...L2_COMMITTEES].sort(),
    )
  })

  it('ignores blank committee names', () => {
    expect(campsiteTents([])).toEqual([])
    expect(campsiteTents(['   ', ''])).toEqual([])
    expect(campsiteTents(['Spirit', ' '])).toHaveLength(1)
  })

  it('never overlaps two tents in the same row', () => {
    for (const count of [2, 3, 5, 8, 11, 16, 24]) {
      const tents = campsiteTents(rosterOf(count))
      for (const row of ['back', 'front'] as const) {
        const inRow = tents
          .filter((tent) => tent.row === row)
          .sort((a, b) => a.x - b.x)
        for (let i = 1; i < inRow.length; i += 1) {
          const gap =
            inRow[i].x - inRow[i - 1].x - halfWidth(inRow[i]) - halfWidth(inRow[i - 1])
          expect(gap).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('leaves the campfire clearing empty', () => {
    for (const count of [2, 6, 11, 20]) {
      for (const tent of campsiteTents(rosterOf(count))) {
        if (tent.row === 'back') continue
        expect(Math.abs(tent.x - FIRE_X) - halfWidth(tent)).toBeGreaterThanOrEqual(
          FIRE_CLEARANCE - 0.001,
        )
      }
    }
  })

  it('keeps every tent inside the clearing', () => {
    for (const count of [1, 4, 11, 30]) {
      for (const tent of campsiteTents(rosterOf(count))) {
        expect(tent.x - halfWidth(tent)).toBeGreaterThanOrEqual(0)
        expect(tent.x + halfWidth(tent)).toBeLessThanOrEqual(GROUND_WIDTH)
        expect(tent.scale).toBeGreaterThan(0)
      }
    }
  })

  it('pitches the back row higher and smaller than the front row', () => {
    const tents = campsiteTents(L2_COMMITTEES)
    const back = tents.filter((tent) => tent.row === 'back')
    const front = tents.filter((tent) => tent.row === 'front')

    expect(back.length).toBeGreaterThan(0)
    expect(front.length).toBeGreaterThan(0)
    expect(Math.max(...back.map((t) => t.y))).toBeLessThan(
      Math.min(...front.map((t) => t.y)),
    )
    expect(Math.max(...back.map((t) => t.scale))).toBeLessThan(
      Math.min(...front.map((t) => t.scale)),
    )
  })

  it('shrinks the tents as the roster grows', () => {
    const small = campsiteTents(rosterOf(4))
    const large = campsiteTents(rosterOf(28))
    expect(Math.max(...large.map((t) => t.scale))).toBeLessThan(
      Math.max(...small.map((t) => t.scale)),
    )
  })
})
