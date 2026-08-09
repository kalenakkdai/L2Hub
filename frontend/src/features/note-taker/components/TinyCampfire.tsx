/**
 * A pocket-sized version of the Events campsite fire.
 *
 * Flame size follows how many meeting logs sit under the pit. Banked (0 logs)
 * keeps soft embers; more logs push the fire through small → medium → large.
 */

import { fireIntensityForLogCount, flameScale } from '../lib/fireScale'

const SPARKS = [
  { dx: -5, delay: 0, duration: 2.6, r: 0.9 },
  { dx: 4, delay: 0.7, duration: 3, r: 0.7 },
  { dx: -1, delay: 1.4, duration: 2.3, r: 0.8 },
]

const FIRE_X = 32
const FIRE_Y = 40

function flamePath(height: number, spread: number): string {
  const round = (value: number) => Math.round(value * 100) / 100
  return [
    `M${FIRE_X} ${FIRE_Y}`,
    `C${round(FIRE_X - spread)} ${round(FIRE_Y - height * 0.28)}, ${round(FIRE_X - spread * 0.8)} ${round(FIRE_Y - height * 0.72)}, ${FIRE_X} ${round(FIRE_Y - height)}`,
    `C${round(FIRE_X + spread * 0.8)} ${round(FIRE_Y - height * 0.72)}, ${round(FIRE_X + spread)} ${round(FIRE_Y - height * 0.28)}, ${FIRE_X} ${FIRE_Y}`,
    'Z',
  ].join(' ')
}

type TinyCampfireProps = {
  /** Rendered pixel width; the box keeps its 64:56 ratio. */
  size?: number
  /** Staggers the flame so a row of fires does not dance in lockstep. */
  seed?: number
  /** Meeting logs under this fire — drives flame intensity. */
  logCount?: number
  /**
   * Quieter baseline for past / upcoming events when there are no logs yet.
   * Ignored once logCount > 0 (the logs light the fire).
   */
  banked?: boolean
  label?: string
  className?: string
}

export function TinyCampfire({
  size = 56,
  seed = 0,
  logCount = 0,
  banked = false,
  label,
  className,
}: TinyCampfireProps) {
  const delay = `-${(seed % 5) * 0.37}s`
  const intensity =
    logCount > 0
      ? fireIntensityForLogCount(logCount)
      : banked
        ? 'banked'
        : 'small'
  const scale = flameScale(intensity)
  const renderedSize = size * scale.sizeBoost

  return (
    <svg
      viewBox="0 0 64 56"
      width={renderedSize}
      height={(renderedSize * 56) / 64}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={['shrink-0 overflow-visible', className].filter(Boolean).join(' ')}
    >
      <defs>
        <radialGradient id={`tinyfire-glow-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={scale.glowOpacity} />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
        </radialGradient>
      </defs>

      <ellipse
        cx={FIRE_X}
        cy={FIRE_Y - 4}
        rx={28 + logCount * 0.8}
        ry={14 + Math.min(logCount, 8) * 0.4}
        fill={`url(#tinyfire-glow-${seed})`}
      />

      <g fill="#1d2b23">
        {[-11, -5, 1, 7, 12].map((offset, index) => (
          <ellipse
            key={offset}
            cx={FIRE_X + offset}
            cy={FIRE_Y + 4 - Math.abs(offset) * 0.08}
            rx={index % 2 === 0 ? 3.4 : 2.8}
            ry={2}
          />
        ))}
      </g>

      <g stroke="#4a3222" strokeWidth={3.4} strokeLinecap="round">
        <line x1={FIRE_X - 9} y1={FIRE_Y + 2} x2={FIRE_X + 9} y2={FIRE_Y - 2} />
        <line x1={FIRE_X - 8} y1={FIRE_Y - 3} x2={FIRE_X + 10} y2={FIRE_Y + 2} />
      </g>

      <g
        className="tinyfire-flames"
        style={{
          animationDelay: delay,
          opacity: intensity === 'banked' ? 0.72 : 1,
        }}
      >
        <path
          d={flamePath(scale.outerH, scale.outerSpread)}
          fill="#ea580c"
          opacity={0.85}
        />
        <path d={flamePath(scale.midH, scale.midSpread)} fill="#fb923c" />
        <path d={flamePath(scale.coreH, scale.coreSpread)} fill="#fef3c7" />
      </g>

      {intensity === 'banked' ? (
        <g className="tinyfire-ember">
          <circle cx={FIRE_X - 3} cy={FIRE_Y - 1} r={1.4} fill="#f97316" />
          <circle cx={FIRE_X + 3} cy={FIRE_Y - 2} r={1.1} fill="#fb923c" />
        </g>
      ) : null}

      {SPARKS.map((spark, index) => (
        <circle
          key={index}
          className="tinyfire-spark"
          cx={FIRE_X}
          cy={FIRE_Y - (intensity === 'banked' ? 14 : 22)}
          r={intensity === 'banked' ? spark.r * 0.75 : spark.r}
          fill="#fcd34d"
          style={{
            animationDelay: `${spark.delay}s`,
            animationDuration: `${spark.duration}s`,
            ['--tinyfire-drift' as string]: `${spark.dx}px`,
          }}
        />
      ))}

      <style>{`
        .tinyfire-flames {
          animation: tinyfireDance 1.9s ease-in-out infinite;
          transform-origin: ${FIRE_X}px ${FIRE_Y}px;
        }

        .tinyfire-spark {
          animation: tinyfireSpark 2.6s ease-out infinite;
          opacity: 0;
        }

        .tinyfire-ember {
          animation: tinyfireEmber 3.2s ease-in-out infinite;
        }

        @keyframes tinyfireDance {
          0%, 100% { transform: scale(1, 1) rotate(0deg); }
          25% { transform: scale(0.92, 1.11) rotate(-3deg); }
          50% { transform: scale(1.08, 0.92) rotate(2.5deg); }
          75% { transform: scale(0.96, 1.06) rotate(-1.5deg); }
        }

        @keyframes tinyfireSpark {
          0% { transform: translate(0, 0) scale(1); opacity: 0; }
          20% { opacity: 0.9; }
          100% {
            transform: translate(var(--tinyfire-drift, 0px), -22px) scale(0.3);
            opacity: 0;
          }
        }

        @keyframes tinyfireEmber {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tinyfire-flames,
          .tinyfire-spark,
          .tinyfire-ember {
            animation: none;
          }
          .tinyfire-spark { opacity: 0.5; }
        }
      `}</style>
    </svg>
  )
}
