import { useEffect, useRef, useState } from 'react'

/**
 * A snowy owl that glides along a path through the night sky, tracking the
 * scroll position frame by frame. Decorative: hidden from assistive tech and
 * never intercepts pointer events.
 *
 * Waypoints are percentages of the backdrop layer, so the owl stays inside the
 * content column on every screen size.
 */

type Point = { x: number; y: number }

export const WAYPOINTS: Point[] = [
  { x: 72, y: 12 },
  { x: 22, y: 28 },
  { x: 66, y: 46 },
  { x: 24, y: 64 },
  { x: 70, y: 82 },
]

const OWL_SIZE = 116
/** How long the owl keeps flapping after the page stops moving. */
const GLIDE_OUT_MS = 420
/** A hop between waypoints when the page is too short to scroll. */
const ROAM_MS = 5000

/** Eases each segment so the owl slows into a waypoint and accelerates away. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Fraction of the page that has been scrolled. A page too short to scroll sits
 * at zero rather than dividing by zero.
 */
export function scrollProgress(scrollTop: number, scrollable: number): number {
  if (scrollable <= 0) return 0
  return Math.min(1, Math.max(0, scrollTop / scrollable))
}

/**
 * Position along the waypoint path for a given progress, interpolated rather
 * than snapped so the owl tracks the scroll wheel continuously.
 */
export function owlPosition(progress: number): Point {
  const clamped = Math.min(1, Math.max(0, progress))
  const scaled = clamped * (WAYPOINTS.length - 1)
  const index = Math.min(WAYPOINTS.length - 2, Math.floor(scaled))
  const eased = smoothstep(scaled - index)
  const from = WAYPOINTS[index]
  const to = WAYPOINTS[index + 1]

  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  }
}

export function Owl() {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [flying, setFlying] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [roaming, setRoaming] = useState(false)
  const lastX = useRef(WAYPOINTS[0].x)

  // Position is written straight to the node instead of through state: scroll
  // fires every frame, and re-rendering React that often to move one element
  // is wasted work.
  const moveTo = (progress: number) => {
    const anchor = anchorRef.current
    if (!anchor) return

    const { x, y } = owlPosition(progress)
    anchor.style.left = `${x}%`
    anchor.style.top = `${y}%`

    // Face the direction of travel, ignoring jitter so the owl does not
    // flicker while hovering around one spot.
    if (Math.abs(x - lastX.current) > 0.35) {
      setFacingLeft(x < lastX.current)
      lastX.current = x
    }
  }

  useEffect(() => {
    let frame = 0
    let stopTimer = 0

    const read = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - doc.clientHeight
      setRoaming(scrollable <= 8)
      if (scrollable <= 8) return

      moveTo(scrollProgress(doc.scrollTop, scrollable))
      // Wings beat while the page moves and settle once it stops.
      setFlying(true)
      window.clearTimeout(stopTimer)
      stopTimer = window.setTimeout(() => setFlying(false), GLIDE_OUT_MS)
    }

    const onScroll = () => {
      // Scroll fires faster than the screen refreshes, so collapse bursts into
      // one read per frame.
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        read()
      })
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
      window.clearTimeout(stopTimer)
    }
  }, [])

  useEffect(() => {
    if (!roaming) return

    // Short pages never scroll, so the owl would be stuck at the first
    // waypoint. Let it hop along the path on its own instead.
    let step = 0
    const timer = window.setInterval(() => {
      step = (step + 1) % WAYPOINTS.length
      moveTo(step / (WAYPOINTS.length - 1))
      setFlying(true)
      window.setTimeout(() => setFlying(false), 1200)
    }, ROAM_MS)

    return () => window.clearInterval(timer)
  }, [roaming])

  const bodyClass = ['owl-body', flying ? 'owl-body-flying' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-20 lg:left-64"
      >
        <div
          ref={anchorRef}
          className={roaming ? 'owl-anchor owl-anchor-roaming' : 'owl-anchor'}
          style={{ left: `${WAYPOINTS[0].x}%`, top: `${WAYPOINTS[0].y}%` }}
        >
          <div className={bodyClass}>
            <svg
              width={OWL_SIZE}
              height={OWL_SIZE}
              viewBox="0 0 64 64"
              style={{ transform: facingLeft ? 'scaleX(-1)' : undefined }}
            >
              <defs>
                <radialGradient id="owl-belly" cx="50%" cy="38%" r="62%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#dfe6f2" />
                </radialGradient>
              </defs>

              {/* Moonlit halo so the white owl reads against a pale star */}
              <ellipse cx="32" cy="36" rx="21" ry="20" fill="#ffffff" opacity="0.14" />

              <g className="owl-wing owl-wing-far">
                <path d="M32 26 C20 24 12 32 14 42 C20 44 28 40 32 34 Z" fill="#c9d4e6" />
              </g>

              <ellipse cx="32" cy="36" rx="16" ry="17" fill="url(#owl-belly)" />

              {/* Ear tufts */}
              <path d="M20 24 L18 13 L27 20 Z" fill="#ffffff" />
              <path d="M44 24 L46 13 L37 20 Z" fill="#ffffff" />

              {/* Speckles, the snowy owl's giveaway */}
              <g fill="#c9d4e6" opacity="0.75">
                <circle cx="25" cy="42" r="1.5" />
                <circle cx="32" cy="47" r="1.5" />
                <circle cx="39" cy="42" r="1.5" />
                <circle cx="28" cy="49" r="1.2" />
                <circle cx="36" cy="49" r="1.2" />
              </g>

              {/* Face */}
              <circle cx="25.5" cy="31" r="6.4" fill="#ffffff" />
              <circle cx="38.5" cy="31" r="6.4" fill="#ffffff" />
              <circle className="owl-eye" cx="25.5" cy="31" r="4.2" fill="#1b2a42" />
              <circle className="owl-eye" cx="38.5" cy="31" r="4.2" fill="#1b2a42" />
              <circle cx="27" cy="29.5" r="1.5" fill="#ffffff" opacity="0.95" />
              <circle cx="40" cy="29.5" r="1.5" fill="#ffffff" opacity="0.95" />
              <path d="M32 33 L34.6 37 L29.4 37 Z" fill="#f59e0b" />

              {/* Feet, tucked while flying */}
              <g className="owl-feet" fill="#f59e0b">
                <rect x="27" y="51" width="3.2" height="4" rx="1.4" />
                <rect x="33.8" y="51" width="3.2" height="4" rx="1.4" />
              </g>

              <g className="owl-wing owl-wing-near">
                <path d="M32 26 C44 24 52 32 50 42 C44 44 36 40 32 34 Z" fill="#eef2f9" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      <style>{`
        .owl-anchor {
          position: absolute;
          /* Percentages place the owl's centre, not its corner. */
          margin-left: -${OWL_SIZE / 2}px;
          margin-top: -${OWL_SIZE / 2}px;
          /* Just enough easing to smooth scroll jitter without lagging behind
           * the wheel. */
          transition:
            left 120ms linear,
            top 120ms linear;
        }

        /* Roaming hops are a real flight between two points, not a scroll
         * nudge, so they get a proper glide. */
        .owl-anchor-roaming {
          transition:
            left 1200ms cubic-bezier(0.45, 0, 0.25, 1),
            top 1200ms cubic-bezier(0.45, 0, 0.25, 1);
        }

        .owl-body {
          animation: owlBob 3.6s ease-in-out infinite;
          filter: drop-shadow(0 6px 14px rgb(5 9 15 / 0.55));
        }

        /* Mid-flight the owl leans into the direction it is travelling. */
        .owl-body-flying {
          animation: owlSwoop 900ms ease-in-out infinite;
        }

        .owl-wing {
          transform-origin: 32px 27px;
          animation: owlGlide 3.6s ease-in-out infinite;
        }

        .owl-body-flying .owl-wing {
          animation: owlFlap 260ms ease-in-out infinite;
        }

        .owl-body-flying .owl-feet {
          opacity: 0;
        }

        .owl-eye {
          animation: owlBlink 6.5s ease-in-out infinite;
          transform-origin: center;
        }

        @keyframes owlBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes owlSwoop {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-10px) rotate(4deg); }
        }

        @keyframes owlGlide {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-5deg); }
        }

        @keyframes owlFlap {
          0%, 100% { transform: rotate(-6deg) scaleY(1); }
          50% { transform: rotate(-46deg) scaleY(0.72); }
        }

        @keyframes owlBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }

        /* The global reduced-motion rule stops the flapping and the position
         * tween, so the owl simply sits at the point on the path for the
         * current scroll position instead of animating toward it. */
        @media (prefers-reduced-motion: reduce) {
          .owl-body,
          .owl-wing,
          .owl-eye {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
