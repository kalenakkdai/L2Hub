/**
 * A directed snowy owl that flies from one point on the page to another.
 * Used on My Tasks when a camper picks a campfire — the owl glides to that
 * fire before the task panel opens.
 */

import { useEffect, useState } from 'react'

const OWL_SIZE = 88
const FLIGHT_MS = 900

export type OwlPoint = { x: number; y: number }

type FlyingOwlProps = {
  from: OwlPoint
  to: OwlPoint
  /** Bumps when a new flight should start. */
  flightKey: number
  onArrived?: () => void
}

export function FlyingOwl({ from, to, flightKey, onArrived }: FlyingOwlProps) {
  const [pos, setPos] = useState(from)
  const [flying, setFlying] = useState(false)
  const [facingLeft, setFacingLeft] = useState(to.x < from.x)

  useEffect(() => {
    setFacingLeft(to.x < from.x)
    setPos(from)
    setFlying(true)

    // Double rAF so the browser paints `from` before we tween to `to`.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => setPos(to))
    })
    const done = window.setTimeout(() => {
      setFlying(false)
      onArrived?.()
    }, FLIGHT_MS)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(done)
    }
  }, [flightKey, from.x, from.y, to.x, to.y, onArrived])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      <div
        className="absolute"
        style={{
          left: pos.x,
          top: pos.y,
          marginLeft: -OWL_SIZE / 2,
          marginTop: -OWL_SIZE / 2,
          transition: `left ${FLIGHT_MS}ms cubic-bezier(0.45, 0, 0.25, 1), top ${FLIGHT_MS}ms cubic-bezier(0.45, 0, 0.25, 1)`,
        }}
      >
        <div className={flying ? 'my-tasks-owl my-tasks-owl-flying' : 'my-tasks-owl'}>
          <svg
            width={OWL_SIZE}
            height={OWL_SIZE}
            viewBox="0 0 64 64"
            style={{ transform: facingLeft ? 'scaleX(-1)' : undefined }}
          >
            <defs>
              <radialGradient id="my-tasks-owl-belly" cx="50%" cy="38%" r="62%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#dfe6f2" />
              </radialGradient>
            </defs>
            <ellipse cx="32" cy="36" rx="24" ry="21" fill="#ffffff" opacity="0.14" />
            <ellipse cx="32" cy="36" rx="16" ry="17" fill="url(#my-tasks-owl-belly)" />
            <path d="M20 24 L18 13 L27 20 Z" fill="#ffffff" />
            <path d="M44 24 L46 13 L37 20 Z" fill="#ffffff" />
            <g fill="#c9d4e6" opacity="0.75">
              <circle cx="32" cy="47" r="1.5" />
              <circle cx="28.5" cy="42" r="1.5" />
              <circle cx="35.5" cy="42" r="1.5" />
            </g>
            <g className="my-tasks-owl-wing my-tasks-owl-wing-far">
              <path
                d="M22 28.5 C15.5 30.5 11.5 36 12.5 43 C13.2 48 15.5 51.5 18 53 C21.5 49.5 24.2 44 24.7 38 C25 33.5 24 30.2 22 28.5 Z"
                fill="#c2cee2"
              />
            </g>
            <g className="my-tasks-owl-wing my-tasks-owl-wing-near">
              <path
                d="M42 28.5 C48.5 30.5 52.5 36 51.5 43 C50.8 48 48.5 51.5 46 53 C42.5 49.5 39.8 44 39.3 38 C39 33.5 40 30.2 42 28.5 Z"
                fill="#dbe4f2"
              />
            </g>
            <circle cx="25.5" cy="31" r="6.4" fill="#ffffff" />
            <circle cx="38.5" cy="31" r="6.4" fill="#ffffff" />
            <circle cx="25.5" cy="31" r="4.2" fill="#1b2a42" />
            <circle cx="38.5" cy="31" r="4.2" fill="#1b2a42" />
            <circle cx="27" cy="29.5" r="1.5" fill="#ffffff" opacity="0.95" />
            <circle cx="40" cy="29.5" r="1.5" fill="#ffffff" opacity="0.95" />
            <path d="M32 33 L34.6 37 L29.4 37 Z" fill="#f59e0b" />
          </svg>
        </div>
      </div>
      <style>{`
        .my-tasks-owl {
          animation: myTasksOwlBob 3.6s ease-in-out infinite;
          filter: drop-shadow(0 6px 14px rgb(5 9 15 / 0.55));
        }
        .my-tasks-owl-flying {
          animation: myTasksOwlSwoop 700ms ease-in-out infinite;
        }
        .my-tasks-owl-wing {
          transform-box: view-box;
        }
        .my-tasks-owl-wing-far {
          transform-origin: 22px 28.5px;
          animation: myTasksOwlGlideFar 3.6s ease-in-out infinite;
        }
        .my-tasks-owl-wing-near {
          transform-origin: 42px 28.5px;
          animation: myTasksOwlGlideNear 3.6s ease-in-out infinite;
        }
        .my-tasks-owl-flying .my-tasks-owl-wing-far {
          animation: myTasksOwlFlapFar 260ms ease-in-out infinite;
        }
        .my-tasks-owl-flying .my-tasks-owl-wing-near {
          animation: myTasksOwlFlapNear 260ms ease-in-out infinite;
        }
        @keyframes myTasksOwlBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes myTasksOwlSwoop {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
        @keyframes myTasksOwlGlideNear {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-4deg); }
        }
        @keyframes myTasksOwlGlideFar {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes myTasksOwlFlapNear {
          0%, 100% { transform: rotate(6deg); }
          50% { transform: rotate(-28deg); }
        }
        @keyframes myTasksOwlFlapFar {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(28deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .my-tasks-owl,
          .my-tasks-owl-wing {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
