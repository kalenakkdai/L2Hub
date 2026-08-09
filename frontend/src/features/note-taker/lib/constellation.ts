/**
 * Layout for the meeting-doc constellation: a timeline that reads like a star
 * chart instead of a list.
 *
 * Kept free of React so the geometry can be asserted directly — a doc must
 * always land left of the one recorded after it, and no star may drift outside
 * the drawing box.
 */

export type ConstellationInput = {
  id: string
  /** Bigger stars for finished docs, fainter ones for meetings still cooking. */
  weight?: number
}

export type ConstellationStar = {
  id: string
  /** 0-based position in chronological order (oldest first). */
  index: number
  x: number
  y: number
  radius: number
}

export type ConstellationLink = {
  fromId: string
  toId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type ConstellationLayout = {
  width: number
  height: number
  stars: ConstellationStar[]
  /** Consecutive stars only — the line the eye follows through the timeline. */
  links: ConstellationLink[]
}

export const HEIGHT = 132
const PADDING_X = 34
const STEP_X = 96
const AMPLITUDE = 30
const MAX_RADIUS = 7

/**
 * A fixed wander, so the chart is stable across renders and between users.
 * Two irrational-ish frequencies keep it from looking like a plain sine wave.
 */
function offsetFor(index: number): number {
  return (
    Math.sin(index * 1.27 + 0.6) * AMPLITUDE * 0.7 +
    Math.sin(index * 0.53) * AMPLITUDE * 0.3
  )
}

function radiusFor(weight: number): number {
  const safe = Number.isFinite(weight) ? weight : 0
  return Math.max(3.2, Math.min(MAX_RADIUS, 3.2 + safe * 3.8))
}

export function layoutConstellation(
  docs: ConstellationInput[],
): ConstellationLayout {
  const width = PADDING_X * 2 + Math.max(1, docs.length - 1) * STEP_X
  const midY = HEIGHT / 2
  const limit = midY - MAX_RADIUS - 8

  const stars: ConstellationStar[] = docs.map((doc, index) => {
    const drift = offsetFor(index)
    return {
      id: doc.id,
      index,
      x: PADDING_X + index * STEP_X,
      y: midY + Math.max(-limit, Math.min(limit, drift)),
      radius: radiusFor(doc.weight ?? 0.5),
    }
  })

  const links: ConstellationLink[] = []
  for (let i = 1; i < stars.length; i += 1) {
    const from = stars[i - 1]
    const to = stars[i]
    links.push({
      fromId: from.id,
      toId: to.id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    })
  }

  return { width, height: HEIGHT, stars, links }
}

/** Star size for a meeting doc: finished docs shine, failed ones barely do. */
export function weightForStatus(status: string): number {
  if (status === 'ready') return 1
  if (status === 'processing' || status === 'uploading') return 0.55
  if (status === 'failed') return 0.2
  return 0.35
}
