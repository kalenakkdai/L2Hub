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
import { BubbleFilters } from '../components/BubbleFilters'
import {
  isBubbleAudioSupported,
  playBubblePops,
  POP_STAGGER_SECONDS,
  unlockBubbleAudio,
} from '../bubbleAudio'
import { placeBubble, statusCounts, submittedPercent } from '../lib/bubbleTank'
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
        '--tint-core': 'rgb(16 185 129 / 0.34)',
        '--tint-glow': 'rgb(16 185 129 / 0.38)',
        '--tint-shadow': 'rgb(4 120 87 / 0.34)',
      } as CSSProperties
    case 'writing':
      return {
        '--tint-core': 'rgb(251 191 36 / 0.34)',
        '--tint-glow': 'rgb(251 191 36 / 0.38)',
        '--tint-shadow': 'rgb(180 83 9 / 0.34)',
      } as CSSProperties
    case 'absent':
      return {
        '--tint-core': 'rgb(203 213 225 / 0.20)',
        '--tint-glow': 'rgb(148 163 184 / 0.24)',
        '--tint-shadow': 'rgb(51 65 85 / 0.34)',
      } as CSSProperties
    default:
      return {
        '--tint-core': 'rgb(244 63 94 / 0.32)',
        '--tint-glow': 'rgb(244 63 94 / 0.36)',
        '--tint-shadow': 'rgb(159 18 57 / 0.34)',
      } as CSSProperties
  }
}

function statusDot(status: LiveParticipant['status']): string {
  switch (status) {
    case 'submitted':
      return 'bg-emerald-400'
    case 'writing':
      return 'bg-amber-300'
    case 'absent':
      return 'bg-zinc-300'
    default:
      return 'bg-rose-400'
  }
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

function bubbleStyle(
  participant: LiveParticipant,
  index: number,
  total: number,
): CSSProperties {
  const placement = placeBubble(participant.id, index, total)

  return {
    ...bubbleTint(participant.status),
    left: `${placement.leftPercent}%`,
    top: `${placement.topPercent}%`,
    '--bubble-size': `${placement.size}px`,
    '--depth-opacity': `${0.72 + placement.depth * 0.28}`,
    '--drift-x': `${placement.leftPercent > 50 ? -placement.driftX : placement.driftX}px`,
    '--drift-y': `${placement.driftY}px`,
    '--float-duration': `${placement.floatDuration}s`,
    '--wobble-duration': `${placement.wobbleDuration}s`,
    '--float-delay': `${placement.floatDelay}s`,
    '--rim-start': `${placement.rimStart}deg`,
    '--rim-duration': `${placement.rimDuration}s`,
    '--rim-direction': placement.rimReverse ? 'reverse' : 'normal',
    // Matches the audio clock so the pop is heard as the bubble appears.
    '--pop-delay': `${index * POP_STAGGER_SECONDS}s`,
  } as CSSProperties
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
  const roster = liveQuery.data?.participants ?? []
  const counts = statusCounts(roster)
  const percent = submittedPercent(roster)

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <div className="bubble-stage pointer-events-none fixed inset-0 z-0 lg:left-64" />
      <BubbleFilters />

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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* Left: the readable record. */}
            <section
              aria-label="Live debrief"
              className="rounded-card border border-white/12 bg-white/[0.07] p-4 shadow-card backdrop-blur-sm"
            >
              <h2 className="text-sm font-semibold text-navy-ink">Live debrief</h2>
              <p className="mt-1 text-xs text-navy-ink-muted">
                {counts.submitted} of {roster.length} submitted · {percent}%
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ['Submitted', counts.submitted, 'bg-emerald-400'],
                    ['Writing', counts.writing, 'bg-amber-300'],
                    ['Not started', counts.not_started, 'bg-rose-400'],
                    ['Absent', counts.absent, 'bg-zinc-300'],
                  ] as const
                ).map(([label, value, dot]) => (
                  <div
                    key={label}
                    className="rounded-control bg-white/[0.06] px-2.5 py-2"
                  >
                    <dt className="flex items-center gap-1.5 text-navy-ink-muted">
                      <i className={`h-2 w-2 rounded-full ${dot}`} />
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-base font-semibold text-navy-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <ul
                aria-label="Participants"
                className="mt-4 max-h-[46vh] space-y-1 overflow-y-auto pr-1"
              >
                {roster.map((participant) => (
                  <li
                    key={participant.id}
                    className="flex items-center justify-between gap-2 rounded-control px-2 py-1.5 hover:bg-white/[0.06]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <i
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${statusDot(participant.status)}`}
                      />
                      <span className="truncate text-xs font-medium text-navy-ink">
                        {participant.displayName}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-navy-ink-muted">
                      {statusLabel(participant.status)}
                    </span>
                  </li>
                ))}
                {roster.length === 0 ? (
                  <li className="px-2 py-3 text-xs text-navy-ink-muted">
                    No participants yet.
                  </li>
                ) : null}
              </ul>
            </section>

            {/* Right: the same roster, floating. */}
            <section
              aria-label="Bubble tank"
              key={wave}
              className="bubble-tank relative h-[clamp(420px,68vh,760px)] overflow-hidden rounded-card border border-white/12"
            >
              {roster.map((participant, index) => (
                <span
                  key={participant.id}
                  className="bubble-slot absolute"
                  style={bubbleStyle(participant, index, roster.length)}
                  title={`${participant.displayName} · ${statusLabel(participant.status)}`}
                >
                  <span className="bubble-entrance">
                    <span className="bubble-float">
                      <span className="bubble">
                        <span className="bubble-film" aria-hidden="true" />
                        <span className="bubble-sheenfilm" aria-hidden="true" />
                        <span className="bubble-fresnel" aria-hidden="true" />
                        <span className="bubble-gloss" aria-hidden="true" />
                        <span className="bubble-spark" aria-hidden="true" />
                        <span className="bubble-initials">
                          {initials(participant.displayName)}
                        </span>
                      </span>
                      <span className="bubble-name">{participant.displayName}</span>
                    </span>
                  </span>
                </span>
              ))}
            </section>
          </div>
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

        /* The tank is a touch lighter than the page so the films read. */
        .bubble-tank {
          background:
            radial-gradient(
              ellipse at 30% 15%,
              rgb(40 62 104 / 0.55),
              rgb(5 9 15 / 0) 60%
            ),
            radial-gradient(
              ellipse at 78% 88%,
              rgb(14 74 68 / 0.5),
              rgb(5 9 15 / 0) 58%
            ),
            linear-gradient(170deg, #0a1220 0%, #060b14 70%, #04070c 100%);
        }

        .bubble-slot {
          /* Positioned by its centre, so the jittered percentages line up. */
          transform: translate(-50%, -50%);
          opacity: var(--depth-opacity, 1);
        }

        .bubble-entrance {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          animation: bubblePop 700ms cubic-bezier(0.2, 1.4, 0.35, 1)
            var(--pop-delay, 0s) backwards;
        }

        .bubble-float {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
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
          /* A bubble is mostly window: a soft top-left sheen, a faint status
           * tint, and the light that transmits back up through the bottom. */
          background:
            radial-gradient(
              circle at 32% 24%,
              rgb(255 255 255 / 0.30),
              rgb(255 255 255 / 0.04) 38%,
              rgb(255 255 255 / 0) 58%
            ),
            radial-gradient(
              circle at 50% 55%,
              var(--tint-core, rgb(255 255 255 / 0.12)),
              rgb(255 255 255 / 0) 78%
            ),
            radial-gradient(
              circle at 50% 108%,
              rgb(255 255 255 / 0.34),
              rgb(255 255 255 / 0) 46%
            );
          box-shadow:
            inset 0 0 0 1px rgb(255 255 255 / 0.22),
            inset 0 10px 22px rgb(255 255 255 / 0.10),
            inset 0 -14px 26px var(--tint-shadow, rgb(0 0 0 / 0.3)),
            0 16px 34px rgb(3 6 12 / 0.5),
            0 0 34px var(--tint-glow, rgb(255 255 255 / 0.12));
          /* Refraction: whatever is behind the bubble bends through it. */
          backdrop-filter: blur(4px) saturate(1.5) brightness(1.08);
          -webkit-backdrop-filter: blur(4px) saturate(1.5) brightness(1.08);
          animation: bubbleWobble var(--wobble-duration, 9s) ease-in-out
            var(--float-delay, 0s) infinite;
        }

        /* Thin-film interference: the rainbow that rides a soap bubble's skin.
         * Displaced by turbulence so the colour crawls like liquid instead of
         * spinning as a rigid wheel. */
        .bubble-film {
          position: absolute;
          inset: -3%;
          border-radius: 9999px;
          background: conic-gradient(
            from var(--rim-start, 0deg),
            #ff5f6d,
            #ffb057,
            #fff07a,
            #7bf7a5,
            #6fd6ff,
            #9a8cff,
            #ff86c8,
            #ff5f6d
          );
          -webkit-mask: radial-gradient(
            closest-side,
            transparent 64%,
            #000 84%,
            rgb(0 0 0 / 0.35) 100%
          );
          mask: radial-gradient(
            closest-side,
            transparent 64%,
            #000 84%,
            rgb(0 0 0 / 0.35) 100%
          );
          /* Heavily blurred and dimmed: iridescence is a wash, not a decal. */
          filter: url(#bubble-liquid) blur(5px) saturate(1.15);
          mix-blend-mode: screen;
          opacity: 0.55;
          animation: rimSpin var(--rim-duration, 16s) linear infinite;
          animation-direction: var(--rim-direction, normal);
        }

        /* A second, fainter film drifting the other way across the whole
         * surface, so the colour pools and shifts instead of turning as one
         * rigid wheel. */
        .bubble-sheenfilm {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: conic-gradient(
            from calc(var(--rim-start, 0deg) * -1),
            #ff9ec4,
            #9fe8ff,
            #c8ffd6,
            #fff3a8,
            #c9b8ff,
            #ff9ec4
          );
          filter: url(#bubble-sheen) blur(9px);
          mix-blend-mode: screen;
          opacity: 0.2;
          animation: rimSpin calc(var(--rim-duration, 16s) * 1.7) linear infinite;
          animation-direction: var(--rim-direction, normal);
        }

        /* Fresnel: a real bubble is nearly invisible head-on and bright at the
         * grazing edge. This thin bright ring is what sells the sphere. */
        .bubble-fresnel {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 50% 50%,
            rgb(255 255 255 / 0) 70%,
            rgb(255 255 255 / 0.14) 86%,
            rgb(255 255 255 / 0.72) 96%,
            rgb(255 255 255 / 0.22) 100%
          );
          mix-blend-mode: screen;
          pointer-events: none;
        }

        /* Specular highlight: reads as a wet surface rather than a flat disc. */
        .bubble-gloss {
          position: absolute;
          top: 8%;
          left: 12%;
          height: 36%;
          width: 44%;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 32% 30%,
            rgb(255 255 255 / 0.95),
            rgb(255 255 255 / 0.35) 45%,
            rgb(255 255 255 / 0) 72%
          );
          filter: url(#bubble-sheen) blur(2px);
        }

        /* The small hard glint opposite the main highlight. */
        .bubble-spark {
          position: absolute;
          right: 24%;
          bottom: 22%;
          height: 8%;
          width: 8%;
          border-radius: 9999px;
          background: rgb(255 255 255 / 0.85);
          filter: blur(0.6px);
        }

        .bubble-initials {
          position: relative;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #ffffff;
          text-shadow: 0 1px 6px rgb(3 6 12 / 0.8);
        }

        .bubble-name {
          max-width: 11ch;
          overflow: hidden;
          font-size: 0.6875rem;
          font-weight: 500;
          color: rgb(226 232 240 / 0.92);
          text-align: center;
          text-overflow: ellipsis;
          text-shadow: 0 1px 5px rgb(3 6 12 / 0.9);
          white-space: nowrap;
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

        /* Surface tension: the outline is never perfectly circular. */
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
