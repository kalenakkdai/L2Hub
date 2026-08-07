import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { fetchSummaryStatus, type GenerationStatus } from '../api'

const FALLBACK_STAGES: GenerationStatus['stages'] = [
  { key: 'collecting_submissions', label: 'Collecting submissions…', done: false },
  { key: 'analyzing_responses', label: 'Analyzing responses…', done: false },
  { key: 'generating_insights', label: 'Generating insights…', done: false },
  { key: 'comparing_previous_years', label: 'Comparing previous years…', done: false },
  { key: 'building_wrapped', label: 'Building Wrapped…', done: false },
  { key: 'creating_agenda', label: 'Creating agenda…', done: false },
  { key: 'done', label: 'Done.', done: false },
]

export function GenerationTheaterPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const statusQuery = useQuery({
    queryKey: ['events', eventId, 'summary-status'],
    queryFn: () => fetchSummaryStatus(eventId),
    enabled: Boolean(eventId),
    refetchInterval: (query) =>
      query.state.data?.status === 'generating' ? 800 : false,
  })

  const [revealIndex, setRevealIndex] = useState(0)
  const stages = statusQuery.data?.stages ?? FALLBACK_STAGES
  const complete =
    statusQuery.data?.status === 'generated' ||
    statusQuery.data?.status === 'published'

  useEffect(() => {
    if (!complete) return
    setRevealIndex(0)
    const id = window.setInterval(() => {
      setRevealIndex((i) => {
        if (i >= stages.length - 1) {
          window.clearInterval(id)
          return i
        }
        return i + 1
      })
    }, 420)
    return () => window.clearInterval(id)
  }, [complete, stages.length])

  const displayStages = useMemo(() => {
    if (!complete) return stages
    return stages.map((stage, index) => ({
      ...stage,
      done: index <= revealIndex,
    }))
  }, [complete, revealIndex, stages])

  const theaterDone = complete && revealIndex >= stages.length - 1

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
      contentClassName="max-w-3xl"
    >
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
          Generation theater
        </p>
        <h1 className="mt-2 text-display font-semibold text-ink">
          Building your Event Wrapped
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {statusQuery.data?.label ?? 'Preparing synthesis stages…'}
        </p>
      </header>

      {statusQuery.isError ? (
        <ErrorState
          title="Could not load generation status"
          description="You may not have permission to poll this job."
          onRetry={() => void statusQuery.refetch()}
        />
      ) : (
        <ol className="space-y-3">
          {displayStages.map((stage) => (
            <li
              key={stage.key}
              className={`flex items-center gap-3 rounded-card border px-4 py-3 transition duration-300 ${
                stage.done
                  ? 'border-accent-200 bg-accent-50 text-ink'
                  : 'border-border-subtle bg-surface text-ink-muted'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  stage.done
                    ? 'bg-accent-600 text-white'
                    : 'bg-status-neutral-bg text-ink-subtle'
                }`}
              >
                {stage.done ? '✓' : '·'}
              </span>
              <span className="text-sm font-medium">{stage.label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {theaterDone ? (
          <ButtonLink to={`/events/${eventId}/wrapped`}>Open Wrapped</ButtonLink>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void statusQuery.refetch()}
          >
            Refresh status
          </Button>
        )}
        <ButtonLink to={`/events/${eventId}/summary`} variant="ghost">
          Back to summary
        </ButtonLink>
      </div>

      {theaterDone ? (
        <p className="mt-4 text-center text-xs text-ink-subtle">
          Generation complete.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void navigate(`/events/${eventId}/wrapped`)}
          >
            Continue
          </button>
        </p>
      ) : null}
    </AppShell>
  )
}
