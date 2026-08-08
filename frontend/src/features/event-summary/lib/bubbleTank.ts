import type { LiveParticipant } from '../api'

/**
 * Geometry for the floating side of the live debrief screen.
 *
 * The roster list is the readable record; the tank is the ambient one. Bubbles
 * are scattered across it rather than laid out in a grid, but the scatter is
 * derived from the participant id so a refetch every four seconds does not
 * teleport anyone to a new spot.
 */

export type BubblePlacement = {
  /** Percentage offsets inside the tank. */
  leftPercent: number
  topPercent: number
  size: number
  /** Farther bubbles are smaller, dimmer, and slower. */
  depth: number
  driftX: number
  driftY: number
  floatDuration: number
  floatDelay: number
  wobbleDuration: number
  rimStart: number
  rimDuration: number
  rimReverse: boolean
}

export type StatusCounts = {
  submitted: number
  writing: number
  not_started: number
  absent: number
}

/** Stable hash so each participant keeps their own path across refetches. */
export function seedFrom(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000
  }
  return hash
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Jittered grid: cells keep bubbles from piling up, the per-id jitter keeps it
 * from reading as a grid. Positions stay inside the padded band so nothing is
 * clipped by the tank edge.
 */
export function placeBubble(
  id: string,
  index: number,
  total: number,
): BubblePlacement {
  const seed = seedFrom(id)
  const count = Math.max(1, total)
  // Never more columns than bubbles, or a small roster hugs one edge.
  const columns = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 1.35))))
  const rows = Math.max(1, Math.ceil(count / columns))
  const column = index % columns
  const row = Math.floor(index / columns)

  const cellWidth = 100 / columns
  const cellHeight = 100 / rows
  // -0.28..0.28 of a cell, so neighbours rarely collide.
  const jitterX = ((seed % 57) / 57 - 0.5) * 0.56
  const jitterY = (((seed >> 4) % 41) / 41 - 0.5) * 0.56

  const depth = ((seed >> 7) % 100) / 100

  return {
    leftPercent: clamp(cellWidth * (column + 0.5) + jitterX * cellWidth, 9, 91),
    topPercent: clamp(cellHeight * (row + 0.5) + jitterY * cellHeight, 10, 90),
    size: 66 + Math.round(depth * 38),
    depth,
    driftX: 8 + (seed % 16),
    driftY: 10 + ((seed >> 3) % 18),
    floatDuration: 11 + (seed % 9) + depth * 4,
    floatDelay: -(seed % 11),
    wobbleDuration: 8 + ((seed >> 2) % 7),
    rimStart: seed % 360,
    rimDuration: 15 + (seed % 12),
    rimReverse: seed % 3 === 0,
  }
}

export function statusCounts(participants: LiveParticipant[]): StatusCounts {
  const counts: StatusCounts = {
    submitted: 0,
    writing: 0,
    not_started: 0,
    absent: 0,
  }
  for (const participant of participants) {
    if (participant.status === 'submitted') counts.submitted += 1
    else if (participant.status === 'writing') counts.writing += 1
    else if (participant.status === 'absent') counts.absent += 1
    else counts.not_started += 1
  }
  return counts
}

/** Whole-number percent of the roster that has submitted. */
export function submittedPercent(participants: LiveParticipant[]): number {
  if (participants.length === 0) return 0
  const { submitted } = statusCounts(participants)
  return Math.round((submitted / participants.length) * 100)
}
