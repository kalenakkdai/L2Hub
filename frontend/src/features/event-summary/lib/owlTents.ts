/**
 * Geometry for the owl-over-tent flourish: when the gliding owl passes over a
 * committee tent, that tent throws its doors open and they flap in its wake.
 *
 * The owl lives in a viewport-positioned overlay and the tents live inside a
 * scaled SVG, so the two never share a coordinate space at rest. At runtime we
 * read each one's on-screen box with getBoundingClientRect and compare them
 * here, in plain viewport pixels. Keeping the comparison pure lets it be unit
 * tested without a browser layout.
 */

export type Rect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type PerchPoint = {
  x: number
  y: number
}

export type OwlPerchTarget = PerchPoint & {
  id: string
}

/** True when two boxes share any area. Edges that merely touch do not count. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  )
}

/**
 * Whether the owl is passing over a tent. The tent's trigger zone is its own
 * box grown upward by `overhang`, so the owl skimming just above the canvas
 * still trips the doors as it crosses — it never has to land on the tent.
 */
export function owlOverTent(
  owl: Rect,
  tent: Rect,
  { overhang = 28 }: { overhang?: number } = {},
): boolean {
  if (tent.right <= tent.left || tent.bottom <= tent.top) return false
  const zone: Rect = { ...tent, top: tent.top - Math.max(0, overhang) }
  return rectsOverlap(owl, zone)
}

/**
 * Viewport point for the owl's centre when its feet rest on a tent peak.
 *
 * The feet sit near 86% of the owl SVG's height, so moving its centre upward
 * by 36% of the rendered height places the talons on the measured perch.
 */
export function tentPerchPoint(
  perch: Rect,
  owlHeight: number,
): PerchPoint | null {
  if (perch.right <= perch.left || perch.bottom <= perch.top) return null
  return {
    x: (perch.left + perch.right) / 2,
    y: (perch.top + perch.bottom) / 2 - owlHeight * 0.36,
  }
}
