/**
 * Geometry for the campsite backdrop: the forest that frames the clearing and
 * the committee tents pitched around the L2 Hub campfire.
 *
 * Everything here is pure and deterministic, so the scene can be unit tested
 * and so a React re-render never reshuffles the forest or moves a tent.
 */

/** User-space box the ground layer is drawn in. */
export const GROUND_WIDTH = 960
export const GROUND_HEIGHT = 300

/** Where the treeline meets the floor of the clearing. */
export const HORIZON = 92

/** The campfire burns at the front of the clearing, nearest the viewer. */
export const FIRE_X = GROUND_WIDTH / 2
export const FIRE_Y = 256

/** Bare ground kept clear around the fire so no tent is pitched in the flames. */
export const FIRE_CLEARANCE = 46

export const TENT_WIDTH = 74
export const TENT_HEIGHT = 56
/** Breathing room kept between neighbouring tents. */
export const TENT_GAP = 10

/**
 * Leadership committees, mirroring the Leadership 2 roster. Callers pass
 * their own list once committees come from the API.
 */
export const L2_COMMITTEES = [
  'Activities',
  'Community',
  'Elections',
  'Fundraising',
  'GTAC',
  'HCMC',
  'Publicity',
  'Student Store',
  'STAR',
  'Sports',
  'Tech',
  'Videography/Photography',
]

const TENT_COLORS = [
  '#f97316',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
  '#4ade80',
  '#60a5fa',
  '#f472b6',
]

export function tentColor(index: number): string {
  const size = TENT_COLORS.length
  return TENT_COLORS[((Math.trunc(index) % size) + size) % size]
}

/**
 * A seeded generator, so the forest is identical between renders. Math.random
 * would regrow every tree on each React update.
 */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ForestTree = {
  x: number
  baseY: number
  height: number
  width: number
}

export type ForestBandOptions = {
  seed: number
  count: number
  /** Ground line the trunks stand on. */
  baseY: number
  /** Vertical scatter, so a band reads as depth rather than one straight row. */
  depth?: number
  from?: number
  to?: number
  minHeight: number
  maxHeight: number
}

/**
 * Grows one depth band of pines. Trees take evenly spaced slots with jitter so
 * they never clump into gaps, and come back sorted furthest-first for painting.
 */
export function forestBand(options: ForestBandOptions): ForestTree[] {
  const {
    seed,
    count,
    baseY,
    depth = 0,
    from = -40,
    to = GROUND_WIDTH + 40,
    minHeight,
    maxHeight,
  } = options
  if (count <= 0) return []

  const random = mulberry32(seed)
  const step = (to - from) / count

  return Array.from({ length: count }, (_, index) => {
    const height = minHeight + random() * (maxHeight - minHeight)
    return {
      x: from + step * (index + 0.5) + (random() - 0.5) * step * 0.8,
      baseY: baseY + random() * depth,
      height,
      width: height * (0.42 + random() * 0.16),
    }
  }).sort((a, b) => a.baseY - b.baseY)
}

export type TentRow = 'back' | 'front'

export type Tent = {
  name: string
  label: string
  color: string
  x: number
  y: number
  scale: number
  row: TentRow
}

type RowSpec = {
  y: number
  baseScale: number
  /** Furthest a tent in this row may be pitched from the fire. */
  halfSpan: number
  maxStep: number
  /** Only the back row may pitch a tent directly behind the fire. */
  allowCenter: boolean
}

const BACK_ROW: RowSpec = {
  y: 156,
  baseScale: 0.72,
  halfSpan: 268,
  maxStep: 132,
  allowCenter: true,
}

const FRONT_ROW: RowSpec = {
  y: 210,
  baseScale: 1,
  halfSpan: 330,
  maxStep: 150,
  allowCenter: false,
}

/**
 * Splits the roster between the two rows. The front row always holds an even
 * number of tents, which keeps the middle of the clearing open for the fire.
 */
export function splitTentRows(count: number): { front: number; back: number } {
  if (count <= 0) return { front: 0, back: 0 }
  if (count === 1) return { front: 0, back: 1 }

  let front = Math.ceil(count / 2)
  if (front % 2 === 1) front -= 1
  if (front < 2) front = 2
  return { front, back: count - front }
}

function rowStep(spec: RowSpec, count: number, innerOffset: number): number {
  if (count <= 1) return spec.maxStep
  const perSide = spec.allowCenter
    ? spec.halfSpan / ((count - 1) / 2)
    : (spec.halfSpan - innerOffset) / Math.max(count / 2 - 1, 1)
  return Math.min(spec.maxStep, Math.max(0, perSide))
}

function rowOffsets(
  spec: RowSpec,
  count: number,
  step: number,
  innerOffset: number,
): number[] {
  if (spec.allowCenter) {
    return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step)
  }

  const offsets: number[] = []
  for (let i = 0; i < count / 2; i += 1) {
    const offset = innerOffset + i * step
    offsets.push(-offset, offset)
  }
  return offsets.sort((a, b) => a - b)
}

function layoutRow(
  spec: RowSpec,
  names: string[],
  colorOffset: number,
  row: TentRow,
): Tent[] {
  if (names.length === 0) return []

  const count = names.length
  // Solve the spacing against a full-size tent first, then shrink the tents to
  // fit that spacing. Shrinking only ever pulls them further inside the span.
  const step = rowStep(
    spec,
    count,
    FIRE_CLEARANCE + (TENT_WIDTH * spec.baseScale) / 2,
  )
  const scale =
    count > 1
      ? Math.min(spec.baseScale, step / (TENT_WIDTH + TENT_GAP))
      : spec.baseScale
  const offsets = rowOffsets(
    spec,
    count,
    step,
    FIRE_CLEARANCE + (TENT_WIDTH * scale) / 2,
  )

  return names.map((name, index) => ({
    name,
    label: shortCommitteeLabel(name),
    color: tentColor(colorOffset + index),
    x: FIRE_X + offsets[index],
    y: spec.y,
    scale,
    row,
  }))
}

/** Drops the redundant "Committee" suffix and keeps labels tent-sized. */
export function shortCommitteeLabel(name: string, maxLength = 13): string {
  const trimmed = name.trim().replace(/\s+committee$/i, '')
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

/**
 * Pitches one tent per committee in two rows around the campfire. Back-row
 * tents come first so the nearer front row draws over them.
 */
export function campsiteTents(committees: string[]): Tent[] {
  const names = committees.map((name) => name.trim()).filter(Boolean)
  const { back } = splitTentRows(names.length)

  return [
    ...layoutRow(BACK_ROW, names.slice(0, back), 0, 'back'),
    ...layoutRow(FRONT_ROW, names.slice(back), back, 'front'),
  ]
}
