import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { CampsiteScene } from '../components/CampsiteScene'
import { FeedbackConstellation } from '../components/FeedbackConstellation'
import { fetchWrapped, markWrappedPresented } from '../api'

/** Full-bleed backdrop for the projected story deck. */
const CAMPSITE_BACKDROP =
  'relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,#14532d_0%,#062016_55%,#03140d_100%)] text-emerald-50'

/** Matches the translucent card the events list uses over the same backdrop. */
const SECTION =
  'overflow-hidden rounded-card border border-white/12 bg-white/[0.07] shadow-card backdrop-blur-sm'

type Slide =
  | { id: string; title: string; body: React.ReactNode }
  | { id: 'constellation'; title: string; body: React.ReactNode }

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

export function WrappedPage() {
  const { eventId = '' } = useParams()
  const reducedMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [listMode, setListMode] = useState(false)
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const wrappedQuery = useQuery({
    queryKey: ['events', eventId, 'wrapped'],
    queryFn: () => fetchWrapped(eventId),
    enabled: Boolean(eventId),
  })

  const canPresent = hasPermission(meQuery.data, 'wrapped.present')
  const presentMutation = useMutation({
    mutationFn: () => markWrappedPresented(eventId),
    onSuccess: () => {
      // The events list uses this to unlock each event's recap drop-down.
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const slides = useMemo((): Slide[] => {
    const data = wrappedQuery.data
    if (!data) return []
    const w = data.wrapped as Record<string, any>
    return [
      {
        id: 'hero',
        title: w.hero?.title ?? data.event.name,
        body: (
          <div className="text-center">
            <p className="text-sm tracking-[0.25em] text-emerald-200/80 uppercase">
              Event Wrapped
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
              {w.hero?.title}
            </h2>
            <p className="mt-4 text-lg text-emerald-50/90">{w.hero?.tagline}</p>
            <p className="mt-6 text-sm text-emerald-100/70">
              {w.hero?.contributors} contributors · {w.hero?.submissionRate}% submitted
            </p>
          </div>
        ),
      },
      {
        id: 'rating',
        title: 'Overall rating',
        body: (
          <div className="text-center">
            <p className="text-6xl font-semibold text-white">
              {w.overallRating?.score}
              <span className="text-2xl text-emerald-200/70">
                /{w.overallRating?.max}
              </span>
            </p>
            <p className="mt-3 text-emerald-100">★★★★★</p>
          </div>
        ),
      },
      {
        id: 'committees',
        title: 'Committee rankings',
        body: (
          <ul className="mx-auto max-w-md space-y-3">
            {(w.committeeRankings ?? []).map(
              (c: { name: string; rating: number }, i: number) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between rounded-control bg-white/10 px-4 py-3"
                >
                  <span className="text-emerald-50">
                    {i + 1}. {c.name}
                  </span>
                  <span className="font-semibold text-white">{c.rating}</span>
                </li>
              ),
            )}
          </ul>
        ),
      },
      {
        id: 'participation',
        title: 'Participation',
        body: (
          <div className="text-center">
            <p className="text-5xl font-semibold text-white">
              {w.participation?.completionPercent}%
            </p>
            <p className="mt-3 text-emerald-100/80">
              {w.participation?.submitted}/{w.participation?.invited} submitted ·{' '}
              {w.participation?.absent} absent
            </p>
          </div>
        ),
      },
      {
        id: 'timeline',
        title: 'Submission timeline',
        body: (
          <div className="mx-auto max-w-lg text-center">
            <p className="text-emerald-50">
              Median response in {w.timeline?.medianSeconds}s ·{' '}
              {w.timeline?.firstMinutePercent}% in the first minute
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {(w.timeline?.bubbles ?? []).map(
                (b: { t: number; status: string }, i: number) => (
                  <span
                    key={`${b.t}-${i}`}
                    className={`h-8 w-8 rounded-full ${
                      b.status === 'submitted'
                        ? 'bg-emerald-400'
                        : b.status === 'writing'
                          ? 'bg-amber-300'
                          : 'bg-zinc-500'
                    }`}
                    title={`${b.status} @ ${b.t}s`}
                  />
                ),
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'strengths',
        title: 'Top strengths',
        body: (
          <ul className="mx-auto max-w-xl space-y-3">
            {(w.topStrengths ?? []).map((t: { id: string; label: string; summary: string }) => (
              <li key={t.id} className="rounded-control bg-white/10 px-4 py-3">
                <p className="font-semibold text-white">{t.label}</p>
                <p className="mt-1 text-sm text-emerald-100/80">{t.summary}</p>
              </li>
            ))}
          </ul>
        ),
      },
      {
        id: 'improvements',
        title: 'Top improvements',
        body: (
          <ul className="mx-auto max-w-xl space-y-3">
            {(w.topImprovements ?? []).map(
              (t: {
                id: string
                label: string
                summary: string
                recommendedAction?: string
              }) => (
                <li key={t.id} className="rounded-control bg-white/10 px-4 py-3">
                  <p className="font-semibold text-white">{t.label}</p>
                  <p className="mt-1 text-sm text-emerald-100/80">{t.summary}</p>
                  {t.recommendedAction ? (
                    <p className="mt-2 text-sm text-emerald-200">
                      → {t.recommendedAction}
                    </p>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        ),
      },
      {
        id: 'materials',
        title: 'Material requests',
        body: (
          <ul className="mx-auto max-w-xl space-y-3">
            {(w.materialRequests ?? []).map(
              (m: {
                name: string
                requests: number
                quantity: number
                estimatedCost: number
              }) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded-control bg-white/10 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-emerald-100/70">
                      {m.requests} requests · qty {m.quantity}
                    </p>
                  </div>
                  <p className="text-emerald-50">${m.estimatedCost}</p>
                </li>
              ),
            )}
          </ul>
        ),
      },
      {
        id: 'breakdown',
        title: 'Committee breakdown',
        body: (
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {(w.committeeBreakdown ?? []).map(
              (c: {
                name: string
                rating: number
                strengths: string[]
                improvements: string[]
              }) => (
                <div key={c.name} className="rounded-control bg-white/10 px-4 py-3">
                  <p className="font-semibold text-white">
                    {c.name} · {c.rating}
                  </p>
                  <p className="mt-2 text-xs text-emerald-100/80">
                    Strengths: {c.strengths.join(', ')}
                  </p>
                  <p className="mt-1 text-xs text-emerald-100/80">
                    Improve: {c.improvements.join(', ')}
                  </p>
                </div>
              ),
            )}
          </div>
        ),
      },
      {
        id: 'historical',
        title: 'Historical comparison',
        body: (
          <div className="mx-auto max-w-lg text-center text-emerald-50">
            <p className="text-lg">
              vs {w.historicalComparison?.previousEvent}
            </p>
            <p className="mt-4 text-3xl font-semibold text-white">
              +{w.historicalComparison?.ratingDeltaPercent}% rating
            </p>
            <p className="mt-2 text-sm text-emerald-100/80">
              Parking complaints{' '}
              {w.historicalComparison?.parkingComplaintDeltaPercent}%
            </p>
            <p className="mt-4 text-sm">
              Resolved: {(w.historicalComparison?.resolvedIssues ?? []).join(', ')}
            </p>
            <p className="mt-1 text-sm">
              Still open: {(w.historicalComparison?.repeatedIssues ?? []).join(', ')}
            </p>
          </div>
        ),
      },
      {
        id: 'executive',
        title: 'Executive summary',
        body: (
          <div className="mx-auto max-w-2xl text-emerald-50">
            <p className="text-base leading-relaxed">
              {data.executiveSummary?.summary as string}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-emerald-200 uppercase">
                  Successes
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {((data.executiveSummary?.successes as string[]) ?? []).map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-emerald-200 uppercase">
                  Actions
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {(
                    (data.executiveSummary?.recommendedActions as string[]) ?? []
                  ).map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Link
                to={`/events/${eventId}/agenda`}
                className="inline-flex h-10 items-center rounded-control bg-emerald-400 px-4 text-sm font-semibold text-emerald-950"
              >
                Open leadership agenda
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: 'constellation',
        title: 'Feedback Constellation',
        body: (
          <FeedbackConstellation
            nodes={data.graph.nodes}
            edges={data.graph.edges}
            themes={data.graph.themes}
            reducedMotion={reducedMotion || listMode}
          />
        ),
      },
    ]
  }, [eventId, listMode, reducedMotion, wrappedQuery.data])

  // Pitch a tent for the committees this event actually ran with, falling back
  // to the full Leadership roster when Wrapped does not name them.
  const wrappedCommittees = useMemo(() => {
    const w = wrappedQuery.data?.wrapped as Record<string, any> | undefined
    const named = [
      ...((w?.committeeBreakdown ?? []) as Array<{ name?: string }>),
      ...((w?.committeeRankings ?? []) as Array<{ name?: string }>),
    ]
      .map((entry) => entry?.name)
      .filter((name): name is string => Boolean(name?.trim()))
    return named.length > 0 ? Array.from(new Set(named)) : undefined
  }, [wrappedQuery.data])

  // Reaching the final slide of the deck is what counts as having gone through
  // the Wrapped with the class. A ref keeps it to one call per visit; the
  // server ignores repeats anyway and owns the timestamp.
  const markedPresented = useRef(false)
  const reachedEnd = slides.length > 0 && index >= slides.length - 1
  const alreadyPresented = Boolean(wrappedQuery.data?.event.wrappedPresentedAt)

  useEffect(() => {
    if (listMode || !reachedEnd || !canPresent || alreadyPresented) return
    if (markedPresented.current) return
    markedPresented.current = true
    presentMutation.mutate()
  }, [alreadyPresented, canPresent, listMode, presentMutation, reachedEnd])

  useEffect(() => {
    if (listMode || reducedMotion) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex((i) => Math.min(i + 1, Math.max(slides.length - 1, 0)))
      }
      if (event.key === 'ArrowLeft') {
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listMode, reducedMotion, slides.length])

  if (meQuery.isPending || wrappedQuery.isPending) {
    return <FullPageMessage>Loading Wrapped…</FullPageMessage>
  }

  if (wrappedQuery.isError || !wrappedQuery.data) {
    const unauthorized =
      wrappedQuery.error instanceof ApiError && wrappedQuery.error.status === 403
    return (
      <FullPageMessage>
        <ErrorState
          title={unauthorized ? 'Unauthorized' : 'Wrapped unavailable'}
          description={
            unauthorized
              ? 'Draft Wrapped is restricted to AC, President, and generators until published.'
              : 'Generate and publish an Event Summary first.'
          }
        />
        <div className="mt-4 text-center">
          <Link to={`/events/${eventId}/summary`} className="text-sm underline">
            Back to summary
          </Link>
        </div>
      </FullPageMessage>
    )
  }

  const slide = slides[index]

  if (listMode || reducedMotion) {
    const me = meQuery.data

    // The same frame the events list uses: sidebar chrome, campsite backdrop
    // offset past it, and translucent cards. Only the story deck is
    // full-bleed, because a deck being projected should not show navigation.
    return (
      <AppShell
        name={me?.full_name ?? me?.email ?? 'Camper'}
        role={me?.role ?? 'member'}
        permissions={me?.permissions}
      >
        <CampsiteScene committees={wrappedCommittees} />

        <div className="on-navy relative z-10 pb-16 text-emerald-50">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-white/12 pt-2 pb-4 sm:pt-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-navy-ink-muted uppercase">
                Event Wrapped
              </p>
              <h1 className="mt-1 text-display font-semibold text-navy-ink">
                {wrappedQuery.data.event.name} Wrapped
              </h1>
              <p className="mt-1 text-sm text-navy-ink-muted">
                Every card from the deck, on one scrollable page.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canPresent && !alreadyPresented ? (
                <Button
                  type="button"
                  variant="navy"
                  size="sm"
                  disabled={presentMutation.isPending || presentMutation.isSuccess}
                  onClick={() => presentMutation.mutate()}
                >
                  {presentMutation.isSuccess
                    ? 'Recap unlocked'
                    : 'Mark reviewed with class'}
                </Button>
              ) : null}
              {!reducedMotion ? (
                <Button
                  type="button"
                  variant="navy"
                  size="sm"
                  onClick={() => setListMode(false)}
                >
                  Story view
                </Button>
              ) : null}
              <ButtonLink
                to={`/events/${eventId}/summary`}
                variant="navy"
                size="sm"
              >
                Exit
              </ButtonLink>
            </div>
          </header>

          <div className="space-y-5">
            {slides.map((s, position) => (
              <section key={s.id} aria-label={s.title} className={SECTION}>
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/12 px-4 py-3">
                  <h2 className="text-sm font-semibold text-navy-ink">{s.title}</h2>
                  <span className="rounded-control bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-navy-ink-muted">
                    {position + 1} / {slides.length}
                  </span>
                </header>
                <div className="px-4 py-5">{s.body}</div>
              </section>
            ))}
          </div>

          {/*
            Scroll clearance for the campsite, which is pinned to the viewport
            rather than scrolled with the page — the same reservation the
            events list makes, minus the 16rem sidebar above lg.
          */}
          <div aria-hidden="true" className="h-[31.25vw] lg:h-[calc(31.25vw_-_5rem)]" />
        </div>
      </AppShell>
    )
  }

  return (
    <div className={CAMPSITE_BACKDROP}>
      <CampsiteScene committees={wrappedCommittees} fullBleed owl={false} />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link to={`/events/${eventId}/summary`} className="text-sm text-emerald-100/80">
            Exit
          </Link>
          <p className="text-xs tracking-wide text-emerald-200/70">
            {index + 1} / {slides.length}
          </p>
          <button
            type="button"
            className="text-sm text-emerald-100/80 underline"
            onClick={() => setListMode(true)}
          >
            List view
          </button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-emerald-200/70 uppercase">
            {slide?.title}
          </p>
          <div
            key={slide?.id}
            className="w-full max-w-5xl animate-[fadeRise_420ms_ease-out]"
          >
            {slide?.body}
          </div>
        </main>

        <footer className="flex flex-col items-center gap-2 px-4 py-6">
          {canPresent &&
          reachedEnd &&
          (alreadyPresented || presentMutation.isSuccess) ? (
            <p className="text-xs text-emerald-200/80" role="status">
              Reviewed with the class — the recap is now open on the events list.
            </p>
          ) : null}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="h-10 rounded-control border border-white/20 px-4 text-sm disabled:opacity-40"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="h-10 rounded-control bg-emerald-400 px-4 text-sm font-semibold text-emerald-950 disabled:opacity-40"
              disabled={index >= slides.length - 1}
              onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
            >
              Next
            </button>
          </div>
        </footer>
      </div>
      <style>{`
        @keyframes fadeRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
