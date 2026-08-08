import { useMemo } from 'react'
import { mulberry32 } from '../lib/campsite'
import { Moon } from './Moon'

/**
 * Decorative campsite night sky: a gradient backdrop, a star field, three
 * constellations, and the moon. Purely presentational — it fills whatever
 * element it is dropped into and is hidden from assistive tech.
 *
 * The star field is stretched to cover any viewport shape, which dots and
 * lines survive. The moon does not, so `Moon` draws itself in its own
 * aspect-preserving SVG. Everything below the horizon belongs to `Campsite`,
 * which keeps its aspect ratio so the pines never look squashed.
 */

const SKY_WIDTH = 960
const SKY_HEIGHT = 1080

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

      <Moon />

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

        @keyframes nightTwinkle {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
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
