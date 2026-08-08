import { useMemo } from 'react'

/**
 * Decorative campsite night sky: star field, two constellations, a layered
 * treeline, and a campfire glow. Purely presentational — it fills whatever
 * element it is dropped into and is hidden from assistive tech.
 *
 * The sky is drawn as three layers so it can cover any viewport shape without
 * cropping the parts that matter: a CSS gradient underneath, a stretched star
 * field (dots and lines survive distortion), and a bottom-anchored treeline
 * that keeps its aspect ratio so the pines never look squashed.
 */

const SKY_WIDTH = 960
const SKY_HEIGHT = 1080

const GROUND_WIDTH = 960
const GROUND_HEIGHT = 300
const HORIZON = 96

// A seeded generator keeps the sky identical between renders. Math.random would
// reshuffle every star on each React update.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Star = { x: number; y: number; r: number; opacity: number; delay: number }

function buildStars(seed: number, count: number): Star[] {
  const random = mulberry32(seed)
  return Array.from({ length: count }, () => {
    const y = random() * SKY_HEIGHT
    // Stars thin out toward the treeline, the way a real sky reads.
    const depth = 1 - y / SKY_HEIGHT
    return {
      x: random() * SKY_WIDTH,
      y,
      r: 0.7 + random() * (1.1 + depth),
      opacity: 0.3 + random() * 0.6,
      delay: random() * 6,
    }
  })
}

/** Peaks alternate with valleys so the silhouette reads as pines, not sawteeth. */
function treeline(seed: number, baseY: number, peaks: number): string {
  const random = mulberry32(seed)
  const step = GROUND_WIDTH / peaks
  let path = `M -30 ${GROUND_HEIGHT} L -30 ${baseY}`

  for (let i = 0; i <= peaks; i += 1) {
    const x = i * step
    const height = 30 + random() * 46
    path += ` L ${x - step / 2} ${baseY} L ${x} ${baseY - height} L ${x + step / 2} ${baseY}`
  }

  return `${path} L ${GROUND_WIDTH + 30} ${baseY} L ${GROUND_WIDTH + 30} ${GROUND_HEIGHT} Z`
}

// Fixed shapes, so the constellations stay recognisable rather than random.
// Each group is placed at a different depth of the sky.
const DIPPER: Array<[number, number]> = [
  [612, 92],
  [676, 118],
  [742, 108],
  [800, 134],
  [792, 186],
  [726, 204],
  [664, 174],
]

const TRIANGLE: Array<[number, number]> = [
  [120, 396],
  [196, 362],
  [212, 440],
]

const CROSS: Array<[number, number]> = [
  [700, 560],
  [724, 626],
  [744, 700],
  [668, 636],
  [790, 616],
]

function polyline(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

export function NightSky() {
  const stars = useMemo(() => buildStars(20260807, 150), [])

  return (
    <div aria-hidden="true" className="night-sky pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${SKY_WIDTH} ${SKY_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e6eaf2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e6eaf2" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={860} cy={110} r={120} fill="url(#moon-glow)" />
        <circle cx={860} cy={110} r={26} fill="#f4f7ff" opacity={0.9} />

        {stars.map((star, index) => (
          <circle
            key={`star-${index}`}
            className="night-star"
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#ffffff"
            opacity={star.opacity}
            style={{ animationDelay: `${star.delay}s` }}
          />
        ))}

        <g stroke="#d1fadf" strokeOpacity={0.3} strokeWidth={1} fill="none">
          <polyline points={polyline(DIPPER)} />
          <polyline points={polyline(TRIANGLE)} />
          <line
            x1={TRIANGLE[2][0]}
            y1={TRIANGLE[2][1]}
            x2={TRIANGLE[0][0]}
            y2={TRIANGLE[0][1]}
          />
          <polyline points={polyline(CROSS.slice(0, 3))} />
          <line x1={CROSS[3][0]} y1={CROSS[3][1]} x2={CROSS[4][0]} y2={CROSS[4][1]} />
        </g>
        <g fill="#ecfdf5">
          {[...DIPPER, ...TRIANGLE, ...CROSS].map(([x, y], index) => (
            <circle
              key={`constellation-${index}`}
              className="night-star"
              cx={x}
              cy={y}
              r={2.4}
              style={{ animationDelay: `${index * 0.4}s` }}
            />
          ))}
        </g>
      </svg>

      <svg
        className="absolute inset-x-0 bottom-0 h-[280px] w-full"
        viewBox={`0 0 ${GROUND_WIDTH} ${GROUND_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id="campfire-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#f97316" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx={196} cy={HORIZON + 96} rx={170} ry={72} fill="url(#campfire-glow)" />

        <path d={treeline(4242, HORIZON, 14)} fill="#0b1a12" opacity={0.85} />
        <path d={treeline(9137, HORIZON + 30, 11)} fill="#050f0a" />

        <g className="campfire">
          <path d="M186 262 L196 228 L206 262 Z" fill="#f97316" opacity={0.9} />
          <path d="M191 262 L196 242 L201 262 Z" fill="#fcd34d" />
        </g>
      </svg>

      <style>{`
        .night-sky {
          background: linear-gradient(
            to bottom,
            #05090f 0%,
            #0a1220 55%,
            #0b1f14 100%
          );
        }

        .night-star {
          animation: nightTwinkle 5.5s ease-in-out infinite;
        }

        .campfire {
          transform-origin: 196px 262px;
          animation: campfireFlicker 2.4s ease-in-out infinite;
        }

        @keyframes nightTwinkle {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }

        @keyframes campfireFlicker {
          0%, 100% { transform: scaleY(1); opacity: 0.95; }
          40% { transform: scaleY(1.18); opacity: 1; }
          70% { transform: scaleY(0.92); opacity: 0.85; }
        }

        /* The global reduced-motion rule freezes animations mid-keyframe, which
         * would leave stars stuck dim. Hold them fully lit instead. */
        @media (prefers-reduced-motion: reduce) {
          .night-star {
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  )
}
