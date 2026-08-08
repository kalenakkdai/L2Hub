import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Volume2, VolumeX } from 'lucide-react'
import { fetchCurrentUser } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import {
  isBubbleAudioSupported,
  playBubblePops,
  POP_STAGGER_SECONDS,
  unlockBubbleAudio,
} from '../bubbleAudio'
import { fetchLiveParticipants, type LiveParticipant } from '../api'

/**
 * Status still has to be readable at a glance from across the room, so each
 * bubble keeps a tinted core while the soap-film rim stays rainbow for all of
 * them.
 */
function bubbleTint(status: LiveParticipant['status']): CSSProperties {
  switch (status) {
    case 'submitted':
      return {
        '--tint-core': 'rgb(16 185 129 / 0.26)',
        '--tint-glow': 'rgb(16 185 129 / 0.30)',
        '--tint-shadow': 'rgb(4 120 87 / 0.38)',
      } as CSSProperties
    case 'writing':
      return {
        '--tint-core': 'rgb(251 191 36 / 0.26)',
        '--tint-glow': 'rgb(251 191 36 / 0.30)',
        '--tint-shadow': 'rgb(180 83 9 / 0.38)',
      } as CSSProperties
    case 'absent':
      return {
        '--tint-core': 'rgb(203 213 225 / 0.18)',
        '--tint-glow': 'rgb(148 163 184 / 0.22)',
        '--tint-shadow': 'rgb(51 65 85 / 0.38)',
      } as CSSProperties
    default:
      return {
        '--tint-core': 'rgb(244 63 94 / 0.24)',
        '--tint-glow': 'rgb(244 63 94 / 0.28)',
        '--tint-shadow': 'rgb(159 18 57 / 0.38)',
      } as CSSProperties
  }
}

// The list refetches every few seconds. Deriving motion from the participant id
// instead of Math.random keeps each bubble on its own path across refetches
// rather than restarting the animation with new values.
function seedFrom(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000
  }
  return hash
}

function bubbleStyle(
  participant: LiveParticipant,
  index: number,
): CSSProperties {
  const seed = seedFrom(participant.id)
  const driftX = 6 + (seed % 13)
  const driftY = 8 + ((seed >> 3) % 15)
  const size = 84 + (seed % 6) * 7

  return {
    ...bubbleTint(participant.status),
    '--bubble-size': `${size}px`,
    '--drift-x': `${seed % 2 === 0 ? driftX : -driftX}px`,
    '--drift-y': `${driftY}px`,
    '--float-duration': `${9 + (seed % 8)}s`,
    '--wobble-duration': `${7 + ((seed >> 2) % 6)}s`,
    '--float-delay': `-${seed % 9}s`,
    // Each bubble's film catches the light from a slightly different angle.
    '--rim-start': `${seed % 360}deg`,
    '--rim-duration': `${14 + (seed % 11)}s`,
    '--rim-direction': seed % 3 === 0 ? 'reverse' : 'normal',
    // Matches the audio clock so the pop is heard as the bubble appears.
    '--pop-delay': `${index * POP_STAGGER_SECONDS}s`,
  } as CSSProperties
}

function statusLabel(status: LiveParticipant['status']) {
  switch (status) {
    case 'submitted':
      return 'Submitted'
    case 'writing':
      return 'Writing'
    case 'absent':
      return 'Absent'
    default:
      return 'Not started'
  }
}

function initials(displayName: string): string {
  return displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
}

export function LiveBubblesPage() {
  const { eventId = '' } = useParams()
  const [soundOn, setSoundOn] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  // Bumping the wave remounts the bubbles, which replays their entrance.
  const [wave, setWave] = useState(0)
  const popped = useRef<Set<string>>(new Set())

  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const liveQuery = useQuery({
    queryKey: ['events', eventId, 'live'],
    queryFn: () => fetchLiveParticipants(eventId),
    enabled: Boolean(eventId),
    refetchInterval: 4000,
  })

  const participants = liveQuery.data?.participants

  useEffect(() => {
    if (!participants?.length) return

    // Only bubbles that have not been on screen before pop, so a refetch does
    // not set the whole room off again.
    const fresh = participants.filter((p) => !popped.current.has(p.id))
    participants.forEach((p) => popped.current.add(p.id))

    if (fresh.length && soundOn) {
      playBubblePops(fresh.length)
    }
    // `wave` is a dependency on purpose: a replay clears the set above and
    // needs this to run again even though the roster itself has not changed.
  }, [participants, soundOn, wave])

  const replay = () => {
    popped.current.clear()
    setWave((current) => current + 1)
  }

  const toggleSound = async () => {
    if (soundOn) {
      setSoundOn(false)
      return
    }

    // Unlocking has to happen inside this click: browsers block audio started
    // any other way.
    const unlocked = await unlockBubbleAudio()
    setSoundOn(unlocked)
    setAudioBlocked(!unlocked)
    if (unlocked) replay()
  }

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  const unauthorized =
    liveQuery.error instanceof ApiError && liveQuery.error.status === 403

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <div className="bubble-stage pointer-events-none fixed inset-0 z-0 lg:left-64" />

      <div className="on-navy relative z-10 pb-16">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/12 pt-2 pb-4 sm:pt-6">
          <div>
            <h1 className="text-display font-semibold text-navy-ink">
              Live debrief bubbles
            </h1>
            <p className="mt-1 text-sm text-navy-ink-muted">
              Participant status for the active or completed debrief session.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="navy"
              size="sm"
              onClick={() => void toggleSound()}
              disabled={!isBubbleAudioSupported()}
              aria-pressed={soundOn}
            >
              {soundOn ? (
                <Volume2 aria-hidden="true" className="h-4 w-4" />
              ) : (
                <VolumeX aria-hidden="true" className="h-4 w-4" />
              )}
              {soundOn ? 'Sound on' : 'Pop with sound'}
            </Button>
            <Button type="button" variant="navy" size="sm" onClick={replay}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Pop again
            </Button>
          </div>
        </header>

        {audioBlocked ? (
          <p className="mb-4 text-xs text-navy-ink-muted">
            This browser blocked audio. Interact with the page and try the sound
            button again.
          </p>
        ) : null}

        {unauthorized ? (
          <ErrorState
            title="Unauthorized"
            description="Live monitor access is limited to ASBO+, AC, and President."
          />
        ) : null}

        {liveQuery.isPending ? (
          <p className="text-sm text-navy-ink-muted">Loading participants…</p>
        ) : null}

        {liveQuery.data ? (
          <>
            <div className="mb-6 flex flex-wrap gap-3 text-xs text-navy-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Submitted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Writing
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Not started
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-zinc-300" /> Absent
              </span>
            </div>

            <div
              key={wave}
              className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-8"
            >
              {liveQuery.data.participants.map((p, index) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-2 text-center"
                  title={statusLabel(p.status)}
                  style={bubbleStyle(p, index)}
                >
                  <span className="bubble-entrance">
                    <span className="bubble-float">
                      <span className="bubble">
                        <span className="bubble-rim" aria-hidden="true" />
                        <span className="bubble-gloss" aria-hidden="true" />
                        <span className="bubble-spark" aria-hidden="true" />
                        <span className="bubble-initials">
                          {initials(p.displayName)}
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-medium text-navy-ink">
                    {p.displayName}
                  </span>
                  <span className="text-[11px] text-navy-ink-muted">
                    {statusLabel(p.status)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-10">
          <ButtonLink to={`/events/${eventId}/summary`} variant="navy">
            Back to summary
          </ButtonLink>
        </div>
      </div>

      <style>{`
        /* A dark stage: soap films are only visible against something dark. */
        .bubble-stage {
          background:
            radial-gradient(
              ellipse at 18% 8%,
              rgb(28 46 82 / 0.85),
              rgb(5 9 15 / 0) 55%
            ),
            radial-gradient(
              ellipse at 85% 90%,
              rgb(12 63 58 / 0.7),
              rgb(5 9 15 / 0) 55%
            ),
            linear-gradient(160deg, #070d18 0%, #05090f 60%, #04070c 100%);
        }

        .bubble-entrance {
          display: inline-flex;
          animation: bubblePop 700ms cubic-bezier(0.2, 1.4, 0.35, 1)
            var(--pop-delay, 0s) backwards;
        }

        .bubble-float {
          display: inline-flex;
          animation: bubbleFloat var(--float-duration, 12s) ease-in-out
            var(--float-delay, 0s) infinite;
          will-change: transform;
        }

        .bubble {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: var(--bubble-size, 92px);
          width: var(--bubble-size, 92px);
          border-radius: 9999px;
          /* Three stacked gradients: the top-left sheen, the status tint, and
           * the light that bounces back up off the surface below. */
          background:
            radial-gradient(
              circle at 30% 26%,
              rgb(255 255 255 / 0.40),
              rgb(255 255 255 / 0.05) 42%,
              rgb(255 255 255 / 0) 62%
            ),
            radial-gradient(
              circle at 50% 52%,
              var(--tint-core, rgb(255 255 255 / 0.12)),
              rgb(255 255 255 / 0) 70%
            ),
            radial-gradient(
              circle at 50% 116%,
              rgb(255 255 255 / 0.28),
              rgb(255 255 255 / 0) 42%
            );
          box-shadow:
            inset 0 0 0 1px rgb(255 255 255 / 0.30),
            inset 0 0 20px rgb(255 255 255 / 0.18),
            inset 0 -12px 24px var(--tint-shadow, rgb(0 0 0 / 0.3)),
            0 12px 30px rgb(3 6 12 / 0.55),
            0 0 28px var(--tint-glow, rgb(255 255 255 / 0.12));
          /* Refraction: whatever is behind the bubble bends through it. */
          backdrop-filter: blur(2px) saturate(1.3);
          -webkit-backdrop-filter: blur(2px) saturate(1.3);
          animation: bubbleWobble var(--wobble-duration, 9s) ease-in-out
            var(--float-delay, 0s) infinite;
        }

        /* Thin-film interference: the rainbow band that rides a soap bubble's
         * edge. Masked to a ring so the colour never floods the middle. */
        .bubble-rim {
          position: absolute;
          inset: -3%;
          border-radius: 9999px;
          background: conic-gradient(
            from var(--rim-start, 0deg),
            #ff3b30,
            #ff9500,
            #ffd60a,
            #34c759,
            #32ade6,
            #5e5ce6,
            #ff2d55,
            #ff3b30
          );
          -webkit-mask: radial-gradient(
            closest-side,
            transparent 66%,
            #000 79%,
            #000 100%
          );
          mask: radial-gradient(
            closest-side,
            transparent 66%,
            #000 79%,
            #000 100%
          );
          filter: blur(3px) saturate(1.5);
          mix-blend-mode: screen;
          opacity: 0.9;
          animation: rimSpin var(--rim-duration, 16s) linear infinite;
          animation-direction: var(--rim-direction, normal);
        }

        /* Specular highlight: reads as a wet surface rather than a flat disc. */
        .bubble-gloss {
          position: absolute;
          top: 11%;
          left: 15%;
          height: 30%;
          width: 38%;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 30% 30%,
            rgb(255 255 255 / 0.9),
            rgb(255 255 255 / 0) 70%
          );
          filter: blur(1px);
        }

        /* The small hard glint opposite the main highlight. */
        .bubble-spark {
          position: absolute;
          right: 22%;
          bottom: 20%;
          height: 9%;
          width: 9%;
          border-radius: 9999px;
          background: rgb(255 255 255 / 0.75);
          filter: blur(0.5px);
        }

        .bubble-initials {
          position: relative;
          font-size: 0.875rem;
          font-weight: 600;
          color: #ffffff;
          text-shadow: 0 1px 6px rgb(3 6 12 / 0.8);
        }

        @keyframes bubblePop {
          0% {
            transform: scale(0.1);
            opacity: 0;
            filter: blur(6px);
          }
          55% {
            transform: scale(1.16);
            opacity: 1;
            filter: blur(0);
          }
          78% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }

        @keyframes rimSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes bubbleFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          25% {
            transform: translate3d(var(--drift-x), calc(var(--drift-y) * -1), 0);
          }
          50% {
            transform: translate3d(
              calc(var(--drift-x) * -0.7),
              calc(var(--drift-y) * -0.35),
              0
            );
          }
          75% {
            transform: translate3d(
              calc(var(--drift-x) * 0.5),
              calc(var(--drift-y) * 0.6),
              0
            );
          }
        }

        @keyframes bubbleWobble {
          0%,
          100% {
            border-radius: 49% 51% 52% 48% / 52% 48% 52% 48%;
          }
          33% {
            border-radius: 54% 46% 48% 52% / 46% 55% 45% 54%;
          }
          66% {
            border-radius: 46% 54% 55% 45% / 55% 44% 56% 44%;
          }
        }

        /* The global reduced-motion rule stops the animations; pin a clean
         * circle so a paused wobble frame is not what users are left with. */
        @media (prefers-reduced-motion: reduce) {
          .bubble {
            border-radius: 9999px;
          }

          .bubble-entrance {
            animation: none;
          }
        }
      `}</style>
    </AppShell>
  )
}
