import { useEffect, useRef, useState } from 'react'
import type { OwlPerchTarget } from '../lib/owlTents'

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
/** Landing glide, then time spent sitting on the tent before takeoff. */
const LANDING_MS = 720
const PERCH_MS = 3200
/** Stops the same tent immediately catching the owl again after takeoff. */
const PERCH_COOLDOWN_MS = 8000

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

export type OwlProps = {
  /**
   * Called with the owl's on-screen box every time it moves, so a parent can
   * react to where the owl is flying (e.g. open a tent's doors underneath it).
   */
  onSweep?: (rect: DOMRect) => OwlPerchTarget | null
  /** Full-bleed scenes have no desktop sidebar offset. */
  fullBleed?: boolean
}

export function Owl({ onSweep, fullBleed = false }: OwlProps = {}) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [flying, setFlying] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [roaming, setRoaming] = useState(false)
  const [perched, setPerched] = useState(false)
  const lastX = useRef(WAYPOINTS[0].x)
  const lastProgress = useRef(0)
  const perchedRef = useRef(false)
  const lastPerch = useRef<{ id: string; at: number } | null>(null)
  const landingTimer = useRef(0)
  const takeoffTimer = useRef(0)

  // Kept in a ref so the scroll/roam loops always call the latest handler
  // without needing to resubscribe every time the parent re-renders.
  const onSweepRef = useRef(onSweep)
  useEffect(() => {
    onSweepRef.current = onSweep
  }, [onSweep])

  // Position is written straight to the node instead of through state: scroll
  // fires every frame, and re-rendering React that often to move one element
  // is wasted work.
  function landOn(target: OwlPerchTarget) {
    const anchor = anchorRef.current
    const overlay = overlayRef.current
    if (!anchor || !overlay || perchedRef.current) return

    const recent = lastPerch.current
    if (
      recent?.id === target.id &&
      Date.now() - recent.at < PERCH_COOLDOWN_MS
    ) {
      return
    }

    perchedRef.current = true
    lastPerch.current = { id: target.id, at: Date.now() }
    setPerched(true)
    setFlying(true)

    const overlayRect = overlay.getBoundingClientRect()
    anchor.style.left = `${target.x - overlayRect.left}px`
    anchor.style.top = `${target.y - overlayRect.top}px`

    window.clearTimeout(landingTimer.current)
    window.clearTimeout(takeoffTimer.current)
    landingTimer.current = window.setTimeout(() => {
      setFlying(false)
    }, LANDING_MS)
    takeoffTimer.current = window.setTimeout(() => {
      perchedRef.current = false
      setPerched(false)
      setFlying(true)
      moveTo(lastProgress.current, false)
      landingTimer.current = window.setTimeout(
        () => setFlying(false),
        GLIDE_OUT_MS,
      )
    }, LANDING_MS + PERCH_MS)
  }

  function moveTo(progress: number, mayPerch = true) {
    const anchor = anchorRef.current
    if (!anchor || perchedRef.current) return
    lastProgress.current = progress

    const { x, y } = owlPosition(progress)
    anchor.style.left = `${x}%`
    anchor.style.top = `${y}%`

    // Face the direction of travel, ignoring jitter so the owl does not
    // flicker while hovering around one spot.
    if (Math.abs(x - lastX.current) > 0.35) {
      setFacingLeft(x < lastX.current)
      lastX.current = x
    }

    // Report where the owl now appears so tents below can react as it passes.
    const svg = svgRef.current
    if (svg && onSweepRef.current) {
      const target = onSweepRef.current(svg.getBoundingClientRect())
      if (target && mayPerch) landOn(target)
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
      window.clearTimeout(landingTimer.current)
      window.clearTimeout(takeoffTimer.current)
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

  const bodyClass = [
    'owl-body',
    flying ? 'owl-body-flying' : '',
    perched ? 'owl-body-perched' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-20 ${
          fullBleed ? '' : 'lg:left-64'
        }`}
      >
        <div
          ref={anchorRef}
          className={[
            'owl-anchor',
            roaming ? 'owl-anchor-roaming' : '',
            perched ? 'owl-anchor-perching' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: `${WAYPOINTS[0].x}%`, top: `${WAYPOINTS[0].y}%` }}
        >
          <div className={bodyClass}>
            <svg
              ref={svgRef}
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
              <ellipse cx="32" cy="36" rx="24" ry="21" fill="#ffffff" opacity="0.14" />

              <ellipse cx="32" cy="36" rx="16" ry="17" fill="url(#owl-belly)" />

              {/* Ear tufts */}
              <path d="M20 24 L18 13 L27 20 Z" fill="#ffffff" />
              <path d="M44 24 L46 13 L37 20 Z" fill="#ffffff" />

              {/* Speckles, the snowy owl's giveaway */}
              <g fill="#c9d4e6" opacity="0.75">
                <circle cx="32" cy="47" r="1.5" />
                <circle cx="28.5" cy="42" r="1.5" />
                <circle cx="35.5" cy="42" r="1.5" />
                <circle cx="29" cy="50" r="1.2" />
                <circle cx="35" cy="50" r="1.2" />
              </g>

              {/* Wings hug the flanks and pivot at their own shoulder. Drawn
               * before the face so a raised wing tucks behind the head
               * instead of covering an eye. */}
              <g className="owl-wing owl-wing-far">
                <path
                  d="M22 28.5 C15.5 30.5 11.5 36 12.5 43 C13.2 48 15.5 51.5 18 53 C21.5 49.5 24.2 44 24.7 38 C25 33.5 24 30.2 22 28.5 Z"
                  fill="#c2cee2"
                />
                <path
                  d="M20.5 34 C17.5 37.5 16.5 43 17.5 48.5"
                  fill="none"
                  stroke="#aebdd6"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              </g>
              <g className="owl-wing owl-wing-near">
                <path
                  d="M42 28.5 C48.5 30.5 52.5 36 51.5 43 C50.8 48 48.5 51.5 46 53 C42.5 49.5 39.8 44 39.3 38 C39 33.5 40 30.2 42 28.5 Z"
                  fill="#dbe4f2"
                />
                <path
                  d="M43.5 34 C46.5 37.5 47.5 43 46.5 48.5"
                  fill="none"
                  stroke="#c2cee2"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
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

        .owl-anchor-perching {
          transition:
            left ${LANDING_MS}ms cubic-bezier(0.35, 0, 0.2, 1),
            top ${LANDING_MS}ms cubic-bezier(0.35, 0, 0.2, 1);
        }

        .owl-body {
          animation: owlBob 3.6s ease-in-out infinite;
          filter: drop-shadow(0 6px 14px rgb(5 9 15 / 0.55));
        }

        /* Mid-flight the owl leans into the direction it is travelling. */
        .owl-body-flying {
          animation: owlSwoop 900ms ease-in-out infinite;
        }

        /* Sitting still on a roof: wings fold, feet grip, and the body only
         * breathes instead of hovering several pixels above the perch. */
        .owl-body-perched {
          animation: owlPerched 2.8s ease-in-out infinite;
        }

        .owl-body-perched .owl-wing-far,
        .owl-body-perched .owl-wing-near {
          animation: none;
          transform: rotate(0deg);
        }

        .owl-body-perched .owl-feet {
          opacity: 1;
        }

        /* Each wing turns about its own shoulder — a wing pivoting on the
         * body's centre line reads as detached. The two sides mirror each
         * other so the owl beats both wings the same way at the same time. */
        .owl-wing {
          transform-box: view-box;
        }

        .owl-wing-far {
          transform-origin: 22px 28.5px;
          animation: owlGlideFar 3.6s ease-in-out infinite;
        }

        .owl-wing-near {
          transform-origin: 42px 28.5px;
          animation: owlGlideNear 3.6s ease-in-out infinite;
        }

        .owl-body-flying .owl-wing-far {
          animation: owlFlapFar 260ms ease-in-out infinite;
        }

        .owl-body-flying .owl-wing-near {
          animation: owlFlapNear 260ms ease-in-out infinite;
        }

        .owl-body-flying .owl-feet {
          opacity: 0;
        }

        /* fill-box keeps each eye squashing about itself; the default box
         * would blink them toward the middle of the drawing. */
        .owl-eye {
          animation: owlBlink 6.5s ease-in-out infinite;
          transform-box: fill-box;
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

        @keyframes owlPerched {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(1px) rotate(0deg); }
        }

        @keyframes owlGlideNear {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-4deg); }
        }

        @keyframes owlGlideFar {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(4deg); }
        }

        @keyframes owlFlapNear {
          0%, 100% { transform: rotate(6deg); }
          50% { transform: rotate(-28deg); }
        }

        @keyframes owlFlapFar {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(28deg); }
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
