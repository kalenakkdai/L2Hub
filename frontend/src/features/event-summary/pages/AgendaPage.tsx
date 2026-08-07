import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { fetchAgenda, generateAgenda } from '../api'

export function AgendaPage() {
  const { eventId = '' } = useParams()
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const agendaQuery = useQuery({
    queryKey: ['events', eventId, 'agenda'],
    queryFn: () => fetchAgenda(eventId),
    enabled: Boolean(eventId),
    retry: false,
  })

  const generateMutation = useMutation({
    mutationFn: () => generateAgenda(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'agenda'] })
    },
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
  const canGenerate = hasPermission(me, 'agenda.generate')
  const unauthorized =
    agendaQuery.error instanceof ApiError && agendaQuery.error.status === 403
  const missing =
    agendaQuery.error instanceof ApiError && agendaQuery.error.status === 404

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Leadership agenda</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Draft agenda generated from the Event Summary.
        </p>
      </header>

      {unauthorized ? (
        <ErrorState
          title="Unauthorized"
          description="Agenda access requires generate or view-all permissions."
        />
      ) : null}

      {missing || generateMutation.data ? null : null}

      {(missing || (!agendaQuery.data && !agendaQuery.isPending)) && canGenerate ? (
        <div className="mb-4">
          <Button
            type="button"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            Generate agenda
          </Button>
        </div>
      ) : null}

      {agendaQuery.isPending ? (
        <p className="text-sm text-ink-muted">Loading agenda…</p>
      ) : null}

      {agendaQuery.data || generateMutation.data ? (
        <article className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
          <p className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            {(agendaQuery.data ?? generateMutation.data)?.status} draft
          </p>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            {String(
              ((agendaQuery.data ?? generateMutation.data)?.content as { title?: string })
                ?.title ?? 'Agenda',
            )}
          </h2>
          <div className="mt-4 space-y-5">
            {(
              (
                (agendaQuery.data ?? generateMutation.data)?.content as {
                  sections?: Array<{ heading: string; items: string[] }>
                }
              )?.sections ?? []
            ).map((section) => (
              <section key={section.heading}>
                <h3 className="text-sm font-semibold text-ink">{section.heading}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink to={`/events/${eventId}/wrapped`} variant="secondary">
          Back to Wrapped
        </ButtonLink>
        <ButtonLink to={`/events/${eventId}/summary`} variant="ghost">
          Summary
        </ButtonLink>
      </div>
    </AppShell>
  )
}
