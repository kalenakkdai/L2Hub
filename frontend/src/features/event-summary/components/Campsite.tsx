import { useMemo } from 'react'
import {
  FIRE_X,
  FIRE_Y,
  GROUND_HEIGHT,
  GROUND_WIDTH,
  HORIZON,
  L2_COMMITTEES,
  TENT_HEIGHT,
  TENT_WIDTH,
  campsiteTents,
  forestBand,
  type ForestTree,
  type Tent,
} from '../lib/campsite'

/**
 * The forest floor of the campsite scene: a pine forest in four depth bands, a
 * tent for every committee pitched around the clearing, and the L2 Hub
 * campfire burning at the front.
 *
 * The layer keeps the ground's aspect ratio and hangs off the bottom of its
 * container, so the composition is never cropped and never leaves a bald gap
 * at the sides, whatever the viewport shape. Purely decorative.
 */

/** Rounds coordinates so the generated path data stays small. */
function r(value: number): number {
  return Math.round(value * 10) / 10
}

/** A layered conifer: three skirts of branches tapering to a point. */
function pinePath(tree: ForestTree, trunkHeight = 0): string {
  const { x, width, height } = tree
  const base = tree.baseY - trunkHeight
  const half = width / 2
  const lower = base - height * 0.32
  const upper = base - height * 0.64

  return [
    `M${r(x)} ${r(base - height)}`,
    `L${r(x + half * 0.4)} ${r(upper)}`,
    `L${r(x + half * 0.24)} ${r(upper)}`,
    `L${r(x + half * 0.72)} ${r(lower)}`,
    `L${r(x + half * 0.48)} ${r(lower)}`,
    `L${r(x + half)} ${r(base)}`,
    `L${r(x - half)} ${r(base)}`,
    `L${r(x - half * 0.48)} ${r(lower)}`,
    `L${r(x - half * 0.72)} ${r(lower)}`,
    `L${r(x - half * 0.24)} ${r(upper)}`,
    `L${r(x - half * 0.4)} ${r(upper)}`,
    'Z',
  ].join(' ')
}

function ForestBand({
  trees,
  fill,
  trunk,
}: {
  trees: ForestTree[]
  fill: string
  trunk?: string
}) {
  const trunkHeight = trunk ? 10 : 0
  return (
    <g fill={fill}>
      {trees.map((tree, index) => (
        <g key={index}>
          {trunk ? (
            <rect
              x={r(tree.x - tree.width * 0.035)}
              y={r(tree.baseY - trunkHeight - 2)}
              width={r(tree.width * 0.07)}
              height={trunkHeight + 2}
              fill={trunk}
            />
          ) : null}
          <path d={pinePath(tree, trunkHeight)} />
        </g>
      ))}
    </g>
  )
}

/** One committee's tent: a lit A-frame with a pennant and a name board. */
function CommitteeTent({ tent, open = false }: { tent: Tent; open?: boolean }) {
  const width = TENT_WIDTH * tent.scale
  const height = TENT_HEIGHT * tent.scale
  const half = width / 2
  const { x, y } = tent
  const peak = y - height
  const flag = peak - 11 * tent.scale

  const body = [
    `M${r(x - half)} ${r(y)}`,
    `C${r(x - half * 0.56)} ${r(y - height * 0.66)}, ${r(x - half * 0.16)} ${r(peak)}, ${r(x)} ${r(peak)}`,
    `C${r(x + half * 0.16)} ${r(peak)}, ${r(x + half * 0.56)} ${r(y - height * 0.66)}, ${r(x + half)} ${r(y)}`,
    'Z',
  ].join(' ')

  const shade = [
    `M${r(x)} ${r(peak)}`,
    `C${r(x + half * 0.16)} ${r(peak)}, ${r(x + half * 0.56)} ${r(y - height * 0.66)}, ${r(x + half)} ${r(y)}`,
    `L${r(x)} ${r(y)}`,
    'Z',
  ].join(' ')

  // The doorway arch, lit from inside. The two canvas flaps below cover it
  // when shut and peel back toward the poles when the owl passes over.
  const doorTop = y - height * 0.68
  const leftOuter = x - half * 0.3
  const rightOuter = x + half * 0.3

  const door = [
    `M${r(leftOuter)} ${r(y)}`,
    `C${r(x - half * 0.26)} ${r(y - height * 0.48)}, ${r(x - half * 0.1)} ${r(doorTop)}, ${r(x)} ${r(doorTop)}`,
    `C${r(x + half * 0.1)} ${r(doorTop)}, ${r(x + half * 0.26)} ${r(y - height * 0.48)}, ${r(rightOuter)} ${r(y)}`,
    'Z',
  ].join(' ')

  const leftFlap = [
    `M${r(leftOuter)} ${r(y)}`,
    `C${r(x - half * 0.26)} ${r(y - height * 0.48)}, ${r(x - half * 0.1)} ${r(doorTop)}, ${r(x)} ${r(doorTop)}`,
    `L${r(x)} ${r(y)}`,
    'Z',
  ].join(' ')

  const rightFlap = [
    `M${r(x)} ${r(doorTop)}`,
    `C${r(x + half * 0.1)} ${r(doorTop)}, ${r(x + half * 0.26)} ${r(y - height * 0.48)}, ${r(rightOuter)} ${r(y)}`,
    `L${r(x)} ${r(y)}`,
    'Z',
  ].join(' ')

  return (
    <g data-tent={tent.name} className={open ? 'tent tent-open' : 'tent'}>
      {/* Measured by CampsiteScene so the owl can put its feet on the roof.
       * A small transparent circle has a real client rect, unlike a zero-width
       * SVG line, and remains completely decorative. */}
      <circle
        data-tent-perch
        cx={r(x)}
        cy={r(peak)}
        r={2.5}
        fill="transparent"
      />
      <ellipse
        cx={r(x)}
        cy={r(y)}
        rx={r(half * 1.15)}
        ry={r(5 * tent.scale)}
        fill="#020704"
        opacity={0.45}
      />

      <g stroke="#9fb6a6" strokeOpacity={0.22} strokeWidth={0.8}>
        <line x1={r(x - half)} y1={r(y)} x2={r(x - half * 1.5)} y2={r(y + 3)} />
        <line x1={r(x + half)} y1={r(y)} x2={r(x + half * 1.5)} y2={r(y + 3)} />
      </g>

      <path d={body} fill={tent.color} opacity={0.88} />
      <path d={shade} fill="#020806" opacity={0.28} />

      <path className="tent-door-glow" d={door} fill="url(#campsite-lantern)" />
      <path
        className="tent-flap tent-flap-left"
        d={leftFlap}
        fill={tent.color}
        stroke="#020806"
        strokeOpacity={0.28}
        strokeWidth={0.6}
        style={{ transformOrigin: `${r(leftOuter)}px ${r(y)}px` }}
      />
      <path
        className="tent-flap tent-flap-right"
        d={rightFlap}
        fill={tent.color}
        stroke="#020806"
        strokeOpacity={0.28}
        strokeWidth={0.6}
        style={{ transformOrigin: `${r(rightOuter)}px ${r(y)}px` }}
      />

      <line
        x1={r(x)}
        y1={r(peak)}
        x2={r(x)}
        y2={r(flag)}
        stroke="#cbd5e1"
        strokeOpacity={0.5}
        strokeWidth={0.9}
      />
      <path
        className="campsite-pennant"
        d={`M${r(x)} ${r(flag)} L${r(x + 9 * tent.scale)} ${r(flag + 3.5 * tent.scale)} L${r(x)} ${r(flag + 7 * tent.scale)} Z`}
        fill={tent.color}
        style={{ transformOrigin: `${r(x)}px ${r(flag)}px` }}
      />

      <text
        x={r(x)}
        y={r(y + 13)}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#d7ead9"
        opacity={0.82}
      >
        {tent.label}
      </text>
    </g>
  )
}

const SPARKS = [
  { dx: -13, delay: 0, duration: 3.1, r: 1.4 },
  { dx: 9, delay: 0.7, duration: 2.6, r: 1.1 },
  { dx: -5, delay: 1.3, duration: 3.4, r: 1.6 },
  { dx: 15, delay: 1.9, duration: 2.9, r: 1.2 },
  { dx: 2, delay: 2.4, duration: 3.2, r: 1 },
]

/** The campfire the whole hub gathers around, flames and all. */
function Campfire() {
  const flame = (height: number, spread: number) =>
    [
      `M${FIRE_X} ${FIRE_Y}`,
      `C${r(FIRE_X - spread)} ${r(FIRE_Y - height * 0.28)}, ${r(FIRE_X - spread * 0.8)} ${r(FIRE_Y - height * 0.72)}, ${FIRE_X} ${r(FIRE_Y - height)}`,
      `C${r(FIRE_X + spread * 0.8)} ${r(FIRE_Y - height * 0.72)}, ${r(FIRE_X + spread)} ${r(FIRE_Y - height * 0.28)}, ${FIRE_X} ${FIRE_Y}`,
      'Z',
    ].join(' ')

  return (
    <g>
      <ellipse
        className="campsite-glow"
        cx={FIRE_X}
        cy={FIRE_Y - 6}
        rx={250}
        ry={104}
        fill="url(#campsite-firelight)"
      />

      {/* Fire ring */}
      <g fill="#1d2b23">
        {[-34, -18, 0, 18, 34].map((offset, index) => (
          <ellipse
            key={offset}
            cx={FIRE_X + offset}
            cy={FIRE_Y + 6 - Math.abs(offset) * 0.06}
            rx={index % 2 === 0 ? 9 : 7.5}
            ry={5}
          />
        ))}
      </g>

      {/* Logs */}
      <g stroke="#4a3222" strokeWidth={9} strokeLinecap="round">
        <line x1={FIRE_X - 26} y1={FIRE_Y + 3} x2={FIRE_X + 24} y2={FIRE_Y - 5} />
        <line x1={FIRE_X - 23} y1={FIRE_Y - 6} x2={FIRE_X + 27} y2={FIRE_Y + 3} />
      </g>
      <g stroke="#6b4a30" strokeWidth={3} strokeLinecap="round" opacity={0.8}>
        <line x1={FIRE_X - 23} y1={FIRE_Y + 2} x2={FIRE_X + 21} y2={FIRE_Y - 5} />
      </g>

      <g style={{ transformOrigin: `${FIRE_X}px ${FIRE_Y}px` }}>
        <path className="campsite-flame campsite-flame-outer" d={flame(72, 26)} fill="#ea580c" opacity={0.85} />
        <path className="campsite-flame campsite-flame-mid" d={flame(52, 18)} fill="#fb923c" />
        <path className="campsite-flame campsite-flame-core" d={flame(30, 9)} fill="#fef3c7" />
      </g>

      {SPARKS.map((spark, index) => (
        <circle
          key={index}
          className="campsite-spark"
          cx={FIRE_X}
          cy={FIRE_Y - 62}
          r={spark.r}
          fill="#fcd34d"
          style={{
            animationDelay: `${spark.delay}s`,
            animationDuration: `${spark.duration}s`,
            ['--spark-drift' as string]: `${spark.dx}px`,
          }}
        />
      ))}

      <text
        className="campsite-label"
        x={FIRE_X}
        y={FIRE_Y + 32}
        textAnchor="middle"
        fontSize={23}
        fontWeight={700}
        letterSpacing={2.5}
        fill="#fde68a"
      >
        L2 Hub
      </text>
    </g>
  )
}

export function Campsite({
  committees = L2_COMMITTEES,
  openTents,
}: {
  committees?: string[]
  /** Names of tents whose doors are currently thrown open by the passing owl. */
  openTents?: ReadonlySet<string>
}) {
  const tents = useMemo(() => campsiteTents(committees), [committees])

  const forest = useMemo(
    () => ({
      far: forestBand({
        seed: 11071,
        count: 56,
        baseY: HORIZON + 12,
        depth: 10,
        minHeight: 32,
        maxHeight: 64,
      }),
      mid: forestBand({
        seed: 20482,
        count: 32,
        baseY: HORIZON + 38,
        depth: 14,
        minHeight: 54,
        maxHeight: 96,
      }),
      nearLeft: forestBand({
        seed: 30913,
        count: 7,
        baseY: GROUND_HEIGHT - 4,
        depth: 16,
        from: -60,
        to: 96,
        minHeight: 140,
        maxHeight: 220,
      }),
      nearRight: forestBand({
        seed: 41556,
        count: 7,
        baseY: GROUND_HEIGHT - 4,
        depth: 16,
        from: 866,
        to: 1022,
        minHeight: 140,
        maxHeight: 220,
      }),
    }),
    [],
  )

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
    >
      <svg
        className="block w-full"
        viewBox={`0 0 ${GROUND_WIDTH} ${GROUND_HEIGHT}`}
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <radialGradient id="campsite-firelight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="campsite-lantern" cx="50%" cy="70%" r="70%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.25" />
          </radialGradient>
          <linearGradient id="campsite-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1c12" />
            <stop offset="100%" stopColor="#040d08" />
          </linearGradient>
        </defs>

        <rect
          x={0}
          y={HORIZON}
          width={GROUND_WIDTH}
          height={GROUND_HEIGHT - HORIZON}
          fill="url(#campsite-floor)"
        />

        <ForestBand trees={forest.far} fill="#10251a" />
        <ForestBand trees={forest.mid} fill="#0a180f" />

        {/* Trodden clearing the camp is pitched on */}
        <ellipse cx={FIRE_X} cy={236} rx={392} ry={72} fill="#0d2015" opacity={0.75} />

        {tents.map((tent) => (
          <CommitteeTent
            key={tent.name}
            tent={tent}
            open={openTents?.has(tent.name) ?? false}
          />
        ))}

        <Campfire />

        <ForestBand trees={forest.nearLeft} fill="#030a06" trunk="#050f09" />
        <ForestBand trees={forest.nearRight} fill="#030a06" trunk="#050f09" />
      </svg>

      <style>{`
        .campsite-flame {
          animation: campsiteFlameDance 1.9s ease-in-out infinite;
          transform-origin: ${FIRE_X}px ${FIRE_Y}px;
        }

        .campsite-flame-mid {
          animation-duration: 1.35s;
        }

        .campsite-flame-core {
          animation-duration: 0.85s;
        }

        .campsite-glow {
          animation: campsiteEmber 2.8s ease-in-out infinite;
        }

        .campsite-label {
          animation: campsiteEmber 2.8s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgb(249 115 22 / 0.6));
        }

        .campsite-spark {
          animation-name: campsiteSpark;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
          opacity: 0;
        }

        .campsite-pennant {
          animation: campsitePennant 3.2s ease-in-out infinite;
        }

        /* Doors shut by default. Each flap hinges on its outer pole (its inline
         * transform-origin) and peels toward the side when the tent opens. */
        .tent-flap {
          transform-box: view-box;
          transform: scaleX(1) rotate(0deg);
          transition: transform 260ms ease;
        }

        .tent-door-glow {
          opacity: 0.85;
          transition: opacity 260ms ease;
        }

        .tent-open .tent-door-glow {
          opacity: 1;
        }

        .tent-open .tent-flap-left {
          animation: tentFlapLeft 640ms ease-in-out infinite;
        }

        .tent-open .tent-flap-right {
          animation: tentFlapRight 640ms ease-in-out infinite;
        }

        @keyframes tentFlapLeft {
          0% { transform: scaleX(1) rotate(0deg); }
          30% { transform: scaleX(0.18) rotate(-7deg); }
          55% { transform: scaleX(0.28) rotate(-2deg); }
          78% { transform: scaleX(0.2) rotate(-8deg); }
          100% { transform: scaleX(0.25) rotate(-4deg); }
        }

        @keyframes tentFlapRight {
          0% { transform: scaleX(1) rotate(0deg); }
          30% { transform: scaleX(0.18) rotate(7deg); }
          55% { transform: scaleX(0.28) rotate(2deg); }
          78% { transform: scaleX(0.2) rotate(8deg); }
          100% { transform: scaleX(0.25) rotate(4deg); }
        }

        @keyframes campsiteFlameDance {
          0%, 100% { transform: scale(1, 1) rotate(0deg); }
          25% { transform: scale(0.93, 1.1) rotate(-3deg); }
          50% { transform: scale(1.07, 0.93) rotate(2.5deg); }
          75% { transform: scale(0.96, 1.06) rotate(-1.5deg); }
        }

        @keyframes campsiteEmber {
          0%, 100% { opacity: 0.72; }
          50% { opacity: 1; }
        }

        @keyframes campsiteSpark {
          0% { transform: translate(0, 0) scale(1); opacity: 0; }
          18% { opacity: 0.9; }
          100% {
            transform: translate(var(--spark-drift, 0px), -72px) scale(0.25);
            opacity: 0;
          }
        }

        @keyframes campsitePennant {
          0%, 100% { transform: skewY(0deg) scaleX(1); }
          50% { transform: skewY(-6deg) scaleX(0.86); }
        }

        /* The global reduced-motion rule freezes animations mid-keyframe, which
         * would strand the sparks halfway up. Hold a still, lit campfire. */
        @media (prefers-reduced-motion: reduce) {
          .campsite-flame,
          .campsite-glow,
          .campsite-label,
          .campsite-pennant,
          .tent-open .tent-flap-left,
          .tent-open .tent-flap-right {
            animation: none;
          }

          .campsite-spark {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
