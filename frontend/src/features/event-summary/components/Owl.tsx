import { useEffect, useRef, useState } from 'react'

/**
 * A snowy owl that perches around the night sky and flies to the next perch as
 * the page is scrolled. Decorative: hidden from assistive tech and never
 * intercepts pointer events.
 *
 * Perches are expressed as percentages of the backdrop layer, so the owl stays
 * inside the content column on every screen size.
 */

type Perch = { x: number; y: number }

export const PERCHES: Perch[] = [
  { x: 74, y: 10 },
  { x: 20, y: 26 },
  { x: 66, y: 46 },
  { x: 26, y: 66 },
  { x: 70, y: 82 },
]

const FLIGHT_MS = 1200

/**
 * Maps how far the page is scrolled onto a perch index. A page too short to
 * scroll keeps the owl on the first perch rather than dividing by zero.
 */
export function perchIndexFor(scrollTop: number, scrollable: number): number {
  if (scrollable <= 0) return 0
  const progress = Math.min(1, Math.max(0, scrollTop / scrollable))
  return Math.round(progress * (PERCHES.length - 1))
}

function perchForScroll(): number {
  const doc = document.documentElement
  return perchIndexFor(doc.scrollTop, doc.scrollHeight - doc.clientHeight)
}

export function Owl() {
  const [index, setIndex] = useState(0)
  const [flying, setFlying] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const previousIndex = useRef(0)

  useEffect(() => {
    let frame = 0

    const onScroll = () => {
      // Scroll fires far more often than the owl needs to move, so collapse
      // bursts into one read per frame.
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setIndex(perchForScroll())
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    // Short pages never scroll, so the owl would be stuck on its first perch.
    // Let it roam on a timer instead, and yield to scrolling the moment the
    // page grows tall enough to drive it.
    const timer = window.setInterval(() => {
      const doc = document.documentElement
      if (doc.scrollHeight - doc.clientHeight > 8) return
      setIndex((current) => (current + 1) % PERCHES.length)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (previousIndex.current === index) return

    // Face the direction of travel so the owl never flies backwards.
    setFacingLeft(PERCHES[index].x < PERCHES[previousIndex.current].x)
    previousIndex.current = index
    setFlying(true)

    const timer = window.setTimeout(() => setFlying(false), FLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [index])

  const perch = PERCHES[index]

  return (
    <>
      <div
        aria-hidden="true"
        className="owl-perch pointer-events-none fixed inset-0 z-20 lg:left-64"
      >
        <div
          className="owl-anchor absolute"
          style={{ left: `${perch.x}%`, top: `${perch.y}%` }}
        >
          <div className={flying ? 'owl-body owl-body-flying' : 'owl-body'}>
            <svg
              className="owl-svg"
              width="64"
              height="64"
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
          /* Percentages place the owl's centre, not its corner. */
          margin-left: -32px;
          margin-top: -32px;
          transition:
            left ${FLIGHT_MS}ms cubic-bezier(0.45, 0, 0.25, 1),
            top ${FLIGHT_MS}ms cubic-bezier(0.45, 0, 0.25, 1);
        }

        .owl-body {
          animation: owlBob 3.6s ease-in-out infinite;
          filter: drop-shadow(0 4px 10px rgb(5 9 15 / 0.55));
        }

        /* Mid-flight the owl leans into the direction it is travelling. */
        .owl-body-flying {
          animation: owlSwoop ${FLIGHT_MS}ms ease-in-out;
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
          50% { transform: translateY(-5px); }
        }

        @keyframes owlSwoop {
          0% { transform: translateY(0) rotate(0deg); }
          35% { transform: translateY(-14px) rotate(-9deg); }
          70% { transform: translateY(-6px) rotate(6deg); }
          100% { transform: translateY(0) rotate(0deg); }
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

        /* The global reduced-motion rule stops the flapping and the flight
         * tween, so the owl simply sits on the perch for the current scroll
         * position instead of animating between them. */
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
