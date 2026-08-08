import type { CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { fetchLiveParticipants, type LiveParticipant } from '../api'

function bubbleTone(status: LiveParticipant['status']) {
  switch (status) {
    case 'submitted':
      return 'from-emerald-300 via-emerald-500 to-emerald-700'
    case 'writing':
      return 'from-amber-200 via-amber-400 to-amber-600'
    case 'absent':
      return 'from-zinc-200 via-zinc-400 to-zinc-500'
    default:
      return 'from-rose-300 via-rose-500 to-rose-700'
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

function bubbleMotion(id: string): CSSProperties {
  const seed = seedFrom(id)
  const driftX = 6 + (seed % 13)
  const driftY = 8 + ((seed >> 3) % 15)
  const size = 52 + (seed % 5) * 4

  return {
    '--bubble-size': `${size}px`,
    '--drift-x': `${seed % 2 === 0 ? driftX : -driftX}px`,
    '--drift-y': `${driftY}px`,
    '--float-duration': `${9 + (seed % 8)}s`,
    '--wobble-duration': `${7 + ((seed >> 2) % 6)}s`,
    '--float-delay': `-${seed % 9}s`,
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

export function LiveBubblesPage() {
  const { eventId = '' } = useParams()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const liveQuery = useQuery({
    queryKey: ['events', eventId, 'live'],
    queryFn: () => fetchLiveParticipants(eventId),
    enabled: Boolean(eventId),
    refetchInterval: 4000,
  })

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
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Live debrief bubbles</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Participant status for the active or completed debrief session.
        </p>
      </header>

      {unauthorized ? (
        <ErrorState
          title="Unauthorized"
          description="Live monitor access is limited to ASBO+, AC, and President."
        />
      ) : null}

      {liveQuery.isPending ? (
        <p className="text-sm text-ink-muted">Loading participants…</p>
      ) : null}

      {liveQuery.data ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Submitted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Writing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Not started
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Absent
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {liveQuery.data.participants.map((p) => (
              <div
                key={p.id}
                className="flex w-28 flex-col items-center gap-2 text-center"
                title={statusLabel(p.status)}
                style={bubbleMotion(p.id)}
              >
                <span className="bubble-float flex h-20 w-20 items-center justify-center">
                  <span
                    className={`bubble-skin flex items-center justify-center bg-gradient-to-br text-sm font-semibold text-white ${bubbleTone(p.status)}`}
                  >
                    <span className="bubble-gloss" aria-hidden="true" />
                    <span className="relative drop-shadow-sm">
                      {p.displayName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </span>
                </span>
                <span className="text-xs font-medium text-ink">{p.displayName}</span>
                <span className="text-[11px] text-ink-subtle">
                  {statusLabel(p.status)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-8">
        <ButtonLink to={`/events/${eventId}/summary`} variant="ghost">
          Back to summary
        </ButtonLink>
      </div>

      <style>{`
        .bubble-float {
          animation: bubbleFloat var(--float-duration, 12s) ease-in-out
            var(--float-delay, 0s) infinite;
          will-change: transform;
        }

        .bubble-skin {
          position: relative;
          height: var(--bubble-size, 56px);
          width: var(--bubble-size, 56px);
          overflow: hidden;
          animation: bubbleWobble var(--wobble-duration, 9s) ease-in-out
            var(--float-delay, 0s) infinite;
          box-shadow:
            inset 0 -6px 12px rgb(0 0 0 / 0.18),
            inset 0 6px 10px rgb(255 255 255 / 0.35),
            0 8px 18px rgb(16 24 40 / 0.16);
        }

        /* Specular highlight: reads as a wet surface rather than a flat disc. */
        .bubble-gloss {
          position: absolute;
          top: 12%;
          left: 16%;
          height: 34%;
          width: 42%;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 30% 30%,
            rgb(255 255 255 / 0.85),
            rgb(255 255 255 / 0) 70%
          );
          filter: blur(1px);
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
            border-radius: 55% 45% 47% 53% / 45% 56% 44% 55%;
          }
          66% {
            border-radius: 45% 55% 56% 44% / 56% 43% 57% 44%;
          }
        }

        /* The global reduced-motion rule stops the animations; pin a clean
         * circle so a paused wobble frame is not what users are left with. */
        @media (prefers-reduced-motion: reduce) {
          .bubble-skin {
            border-radius: 9999px;
          }
        }
      `}</style>
    </AppShell>
  )
}
