/**
 * How big a campfire burns given how many meeting logs sit under it.
 *
 * 0 stays banked/embers; more logs push through small → medium → large, then
 * cap so a packed pit still fits in the row.
 */

export type FireIntensity = 'banked' | 'small' | 'medium' | 'large'

export function fireIntensityForLogCount(logCount: number): FireIntensity {
  const count = Math.max(0, Math.floor(logCount))
  if (count <= 0) return 'banked'
  if (count <= 2) return 'small'
  if (count <= 5) return 'medium'
  return 'large'
}

/** Flame path scale factors keyed by intensity. */
export function flameScale(intensity: FireIntensity): {
  outerH: number
  midH: number
  coreH: number
  outerSpread: number
  midSpread: number
  coreSpread: number
  glowOpacity: number
  sizeBoost: number
} {
  switch (intensity) {
    case 'banked':
      return {
        outerH: 14,
        midH: 10,
        coreH: 5,
        outerSpread: 5,
        midSpread: 3.5,
        coreSpread: 1.8,
        glowOpacity: 0.32,
        sizeBoost: 1,
      }
    case 'small':
      return {
        outerH: 20,
        midH: 14,
        coreH: 8,
        outerSpread: 7,
        midSpread: 5,
        coreSpread: 2.6,
        glowOpacity: 0.48,
        sizeBoost: 1.05,
      }
    case 'medium':
      return {
        outerH: 26,
        midH: 19,
        coreH: 11,
        outerSpread: 9,
        midSpread: 6.4,
        coreSpread: 3.2,
        glowOpacity: 0.58,
        sizeBoost: 1.15,
      }
    case 'large':
      return {
        outerH: 34,
        midH: 25,
        coreH: 14,
        outerSpread: 11,
        midSpread: 8,
        coreSpread: 4,
        glowOpacity: 0.7,
        sizeBoost: 1.28,
      }
  }
}
