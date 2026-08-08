/**
 * The campsite moon: a glowing yellow disc with cratered bumps.
 *
 * It draws itself rather than living in `NightSky`'s SVG. That one is rendered
 * with `preserveAspectRatio="none"` so the star field covers any viewport
 * shape, and the same stretch would pull the moon into an ellipse. Keeping the
 * moon in its own square, aspect-preserving SVG is what keeps it round.
 */

type Crater = { x: number; y: number; r: number }

// Scattered by hand rather than seeded, so the face stays recognisable.
const CRATERS: Crater[] = [
  { x: 47, y: 45, r: 7.5 },
  { x: 71, y: 55, r: 4.6 },
  { x: 56, y: 73, r: 5.8 },
  { x: 74, y: 76, r: 3 },
  { x: 42, y: 64, r: 3.4 },
  { x: 62, y: 36, r: 2.6 },
  { x: 37, y: 54, r: 2.2 },
  { x: 66, y: 66, r: 2 },
]

export function Moon() {
  return (
    <div
      aria-hidden="true"
      className="moon pointer-events-none absolute top-[4%] right-[6%] aspect-square w-[clamp(88px,12vw,176px)]"
    >
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Offset centre reads as a lit sphere rather than a flat coin. */}
          <radialGradient id="moon-face" cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#fffbe0" />
            <stop offset="45%" stopColor="#ffe98a" />
            <stop offset="100%" stopColor="#f0bd42" />
          </radialGradient>
          <radialGradient id="moon-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe98a" stopOpacity="0.5" />
            <stop offset="42%" stopColor="#ffd75e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffd75e" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className="moon-halo" cx={60} cy={60} r={58} fill="url(#moon-halo)" />

        <g className="moon-disc">
          <circle data-moon="disc" cx={60} cy={60} r={34} fill="url(#moon-face)" />

          {CRATERS.map((crater, index) => (
            <g key={`crater-${index}`} data-crater={index}>
              {/* Catch-light below the rim, then the dent itself: together they
               * make each crater sit proud of the surface. */}
              <circle
                cx={crater.x + 0.9}
                cy={crater.y + 1}
                r={crater.r}
                fill="#fff8d4"
                opacity={0.45}
              />
              <circle cx={crater.x} cy={crater.y} r={crater.r} fill="#e0a72c" opacity={0.5} />
            </g>
          ))}
        </g>
      </svg>

      <style>{`
        .moon-disc {
          animation: moonGlow 7s ease-in-out infinite;
        }

        .moon-halo {
          transform-box: fill-box;
          transform-origin: center;
          animation: moonHalo 7s ease-in-out infinite;
        }

        @keyframes moonGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 224, 130, 0.45)); }
          50% { filter: drop-shadow(0 0 20px rgba(255, 224, 130, 0.8)); }
        }

        @keyframes moonHalo {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }

        /* The global reduced-motion rule freezes animations mid-keyframe, which
         * could leave the moon stuck dim. Hold it lit instead. */
        @media (prefers-reduced-motion: reduce) {
          .moon-disc {
            filter: drop-shadow(0 0 14px rgba(255, 224, 130, 0.6));
          }

          .moon-halo {
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  )
}
