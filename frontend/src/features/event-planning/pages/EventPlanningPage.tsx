import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { useQuery } from '@tanstack/react-query'
import { PlanStatusBadge } from '../components/PlanStatusBadge'
import { PlanningRagPanel } from '../components/PlanningRagPanel'
import { EventCampfireBoard } from '../../note-taker'
import {
  useEventPlans,
  usePlanningAuth,
  usePlanningCommands,
} from '../hooks/useEventPlanning'
import type { EventPlan } from '../types'

export function EventPlanningPage() {
  const navigate = useNavigate()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const { userQuery, hasPermission: hasPlanningPermission } = usePlanningAuth()
  const plansQuery = useEventPlans()
  const { createPlan } = usePlanningCommands()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [eventDate, setEventDate] = useState('')

  if (meQuery.isPending || userQuery.isPending) {
    return <FullPageMessage>Loading…</FullPageMessage>
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  const canCreate =
    hasPlanningPermission('planning.create') ||
    hasPermission(me, 'planning.create') ||
    hasPermission(me, 'events.create')

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Event planning</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Anyone can start a plan and assign committees or individuals. Creating a
          plan auto-generates a Winter Ball–style meeting agenda. Mr. Jan must
          enable a plan before people can accept their assignments.
        </p>
      </header>

      <div className="mb-4">
        <EventCampfireBoard permissions={me.permissions} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {canCreate ? (
            <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
              <h2 className="text-sm font-semibold text-ink">Start a plan</h2>
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void createPlan
                    .mutateAsync({ title, summary, eventDate: eventDate || null })
                    .then((plan) => {
                      setTitle('')
                      setSummary('')
                      setEventDate('')
                      navigate(`/event-planning/${plan.id}`)
                    })
                }}
              >
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Event title"
                  className="w-full rounded-control border border-border-strong px-3 py-2 text-sm"
                />
                <textarea
                  required
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="What is this event, and what needs owners?"
                  rows={3}
                  className="w-full rounded-control border border-border-strong px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="rounded-control border border-border-strong px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={createPlan.isPending}
                  className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
                >
                  Create plan
                </button>
              </form>
            </section>
          ) : null}

          {plansQuery.isPending ? (
            <p className="text-sm text-ink-muted">Loading plans…</p>
          ) : null}
          {plansQuery.isError ? (
            <ErrorState
              title="Could not load plans"
              description="Try again in a moment."
              onRetry={() => void plansQuery.refetch()}
            />
          ) : null}

          {plansQuery.data ? (
            <ul className="space-y-3">
              {plansQuery.data.map((plan: EventPlan) => (
                <li
                  key={plan.id}
                  className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/event-planning/${plan.id}`}
                        className="text-sm font-semibold text-status-info hover:underline"
                      >
                        {plan.title}
                      </Link>
                      <p className="mt-1 text-xs text-ink-muted">{plan.summary}</p>
                      <p className="mt-2 text-[11px] text-ink-subtle">
                        Created by {plan.createdByName}
                        {plan.eventDate ? ` · ${plan.eventDate}` : ''}
                        {` · ${plan.assignments.length} assignment${plan.assignments.length === 1 ? '' : 's'}`}
                        {' · agenda ready'}
                      </p>
                    </div>
                    <PlanStatusBadge status={plan.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <PlanningRagPanel />
      </div>
    </AppShell>
  )
}
