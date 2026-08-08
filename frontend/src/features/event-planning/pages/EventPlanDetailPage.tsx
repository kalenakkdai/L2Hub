import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import { fetchCurrentUser } from '../../../api/auth'
import { AnonymousReportForm } from '../components/AnonymousReportForm'
import { AssignPeopleForm } from '../components/AssignPeopleForm'
import { PlanStatusBadge } from '../components/PlanStatusBadge'
import { PlanningRagPanel } from '../components/PlanningRagPanel'
import { reportCategoryLabel } from '../lib/rag'
import {
  useEventPlan,
  usePlanningAuth,
  usePlanningCommands,
  usePlanningReports,
} from '../hooks/useEventPlanning'
import type { PlanAssignment, PlanningReport } from '../types'

export function EventPlanDetailPage() {
  const { planId = '' } = useParams()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const { userQuery, hasPermission } = usePlanningAuth()
  const planQuery = useEventPlan(planId)
  const canReviewReports = hasPermission('feedback.view_anonymous')
  const reportsQuery = usePlanningReports(planId, canReviewReports)
  const commands = usePlanningCommands(planId)

  if (meQuery.isPending || userQuery.isPending || planQuery.isPending) {
    return <FullPageMessage>Loading…</FullPageMessage>
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }
  if (planQuery.isError || !planQuery.data) {
    return (
      <AppShell
        name={meQuery.data.full_name ?? meQuery.data.email}
        role={meQuery.data.role}
        permissions={meQuery.data.permissions}
      >
        <ErrorState
          title="Plan not found"
          description="Check the link and try again."
        />
      </AppShell>
    )
  }

  const me = meQuery.data
  const plan = planQuery.data
  const currentUserId = userQuery.data?.id
  const canEnable = hasPermission('planning.enable')
  const canAssign =
    hasPermission('planning.assign') &&
    (plan.createdById === currentUserId || canEnable)
  const canAccept =
    plan.status === 'enabled' || plan.status === 'active'

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <p className="mb-3">
        <Link
          to="/event-planning"
          className="text-xs font-medium text-ink-muted hover:underline"
        >
          ← Event planning
        </Link>
      </p>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-display font-semibold text-ink">{plan.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{plan.summary}</p>
          <p className="mt-2 text-xs text-ink-subtle">
            Created by {plan.createdByName}
            {plan.enabledByName
              ? ` · Enabled by ${plan.enabledByName}`
              : ''}
          </p>
        </div>
        <PlanStatusBadge status={plan.status} />
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {plan.status === 'draft' && plan.createdById === currentUserId ? (
          <button
            type="button"
            className="rounded-control bg-navy-900 px-3 py-2 text-sm font-medium text-white"
            disabled={commands.submitForEnablement.isPending}
            onClick={() => commands.submitForEnablement.mutate(plan.id)}
          >
            Send to Mr. Jan for enablement
          </button>
        ) : null}
        {canEnable && plan.status === 'pending_enablement' ? (
          <button
            type="button"
            data-testid="enable-plan-button"
            className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white"
            disabled={commands.enablePlan.isPending}
            onClick={() => commands.enablePlan.mutate(plan.id)}
          >
            Enable planning
          </button>
        ) : null}
        {!canAccept ? (
          <p className="text-xs text-status-warning">
            Assignees cannot accept until Mr. Jan enables this plan.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Assignments</h2>
          <ul className="mt-3 space-y-2">
            {plan.assignments.map((assignment: PlanAssignment) => {
              const label =
                assignment.targetType === 'committee'
                  ? assignment.committeeName
                  : assignment.memberName
              const isMine =
                assignment.targetType === 'individual' &&
                assignment.memberId === currentUserId
              return (
                <li
                  key={assignment.id}
                  className="rounded-control border border-border-subtle px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {label} · {assignment.roleLabel}
                      </p>
                      <p className="text-[11px] text-ink-subtle capitalize">
                        {assignment.targetType} · {assignment.status}
                      </p>
                    </div>
                    {isMine &&
                    assignment.status === 'invited' &&
                    canAccept ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-control bg-accent-600 px-2.5 py-1 text-xs font-medium text-white"
                          onClick={() =>
                            commands.acceptAssignment.mutate({
                              id: plan.id,
                              assignmentId: assignment.id,
                            })
                          }
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="rounded-control border border-border-strong px-2.5 py-1 text-xs font-medium"
                          onClick={() =>
                            commands.declineAssignment.mutate({
                              id: plan.id,
                              assignmentId: assignment.id,
                            })
                          }
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}
                    {isMine && assignment.status === 'invited' && !canAccept ? (
                      <span className="text-[11px] text-status-warning">
                        Waiting for enablement
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
            {plan.assignments.length === 0 ? (
              <li className="text-sm text-ink-muted">No assignments yet.</li>
            ) : null}
          </ul>

          {canAssign ? (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <h3 className="text-xs font-semibold text-ink-subtle">
                Assign people
              </h3>
              <div className="mt-2">
                <AssignPeopleForm planId={plan.id} />
              </div>
            </div>
          ) : null}
        </section>

        <div className="space-y-4">
          <AnonymousReportForm planId={plan.id} />

          {canReviewReports ? (
            <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
              <h2 className="text-sm font-semibold text-ink">
                Anonymous reports (AC)
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Author identity is never included in these records.
              </p>
              <ul className="mt-3 space-y-2">
                {(reportsQuery.data ?? []).map((report: PlanningReport) => (
                  <li
                    key={report.id}
                    className="rounded-control border border-border-subtle px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-ink">
                      {report.subjectMemberName} ·{' '}
                      {reportCategoryLabel(report.category)}
                    </p>
                    <p className="mt-1 text-ink-muted">{report.details}</p>
                    {report.attachments?.length ? (
                      <ul
                        className="mt-2 flex flex-wrap gap-2"
                        aria-label="Report attachments"
                      >
                        {report.attachments.map((attachment) => (
                          <li key={attachment.id}>
                            {attachment.mimeType.startsWith('image/') ? (
                              <a
                                href={attachment.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={attachment.dataUrl}
                                  alt={attachment.displayName}
                                  className="h-16 w-16 rounded-control border border-border-subtle object-cover"
                                />
                              </a>
                            ) : (
                              <a
                                href={attachment.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={attachment.displayName}
                                className="inline-flex h-16 min-w-16 items-center justify-center rounded-control border border-border-subtle px-2 text-[11px] font-medium text-ink-muted hover:bg-surface-sunken"
                              >
                                {attachment.displayName}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {'authorId' in report ? (
                      <p className="mt-1 text-status-danger">
                        Privacy error: author leaked
                      </p>
                    ) : null}
                  </li>
                ))}
                {(reportsQuery.data ?? []).length === 0 ? (
                  <li className="text-sm text-ink-muted">No reports yet.</li>
                ) : null}
              </ul>
            </section>
          ) : null}

          <PlanningRagPanel />
        </div>
      </div>
    </AppShell>
  )
}
