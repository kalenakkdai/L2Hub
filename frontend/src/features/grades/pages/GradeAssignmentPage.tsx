import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AssignmentSummaryRail } from '../components/AssignmentSummaryRail'
import { CompletionCriteria } from '../components/CompletionCriteria'
import { GradeStatusIndicator } from '../components/GradeStatusIndicator'
import { SubmissionHistory } from '../components/SubmissionHistory'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { SubmissionContentView } from '../renderers/SubmissionContentView'
import {
  gradebookKeys,
  useGradeAssignment,
  useGradebookCommands,
  useGradebookPermissions,
  useSubmissionHistory,
} from '../hooks/useGradebook'

const barButton =
  'rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50'

export function GradeAssignmentPage() {
  const { assignmentId = '' } = useParams()
  const detailQuery = useGradeAssignment(assignmentId)
  const historyQuery = useSubmissionHistory(assignmentId)
  const { hasPermission } = useGradebookPermissions()
  const commands = useGradebookCommands()
  const queryClient = useQueryClient()

  const canEdit = hasPermission('gradebook.edit') && Boolean(commands?.updateGrade)
  const canExcuse =
    hasPermission('gradebook.mark_excused') && Boolean(commands?.markExcused)
  const canReopen =
    hasPermission('debrief.reopen') && Boolean(commands?.reopenSubmission)

  const excuseMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!commands?.markExcused) throw new Error('Mark excused unavailable')
      return commands.markExcused(entryId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: gradebookKeys.assignment(assignmentId),
      })
      await queryClient.invalidateQueries({ queryKey: ['gradebook', 'me'] })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!commands?.reopenSubmission) throw new Error('Reopen unavailable')
      const studentId = detailQuery.data?.student?.id
      if (!studentId) throw new Error('Student id unavailable')
      return commands.reopenSubmission(assignmentId, studentId)
    },
  })

  if (detailQuery.isPending) {
    return (
      <main className="px-4 py-6 sm:px-6">
        <p className="text-sm text-slate-500" role="status">
          Loading assignment…
        </p>
      </main>
    )
  }

  if (detailQuery.isError) {
    return (
      <main className="px-4 py-6 sm:px-6">
        <GradesErrorState
          message={
            detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'Assignment not found'
          }
          onRetry={() => void detailQuery.refetch()}
        />
        <p className="mt-4">
          <Link to="/grades" className="text-sm font-medium text-sky-700 underline">
            Back to Grades
          </Link>
        </p>
      </main>
    )
  }

  const detail = detailQuery.data
  const entry = detail.entry

  return (
    <main className="flex min-h-screen flex-col">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 px-4 py-5 sm:px-6">
          <p className="mb-3">
            <Link
              to="/grades"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              ← Grades
            </Link>
          </p>

          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                {entry.assignmentTitle}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {[entry.event?.name, entry.assignmentType.replaceAll('_', ' ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="lg:hidden">
              <GradeStatusIndicator status={entry.status} size="md" />
            </div>
          </header>

          {/* Rail collapses above content on smaller screens */}
          <div className="mt-4 lg:hidden">
            <AssignmentSummaryRail detail={detail} />
          </div>

          <section
            aria-labelledby="submission-heading"
            className="mt-4 border border-slate-200"
          >
            <h2
              id="submission-heading"
              className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-900"
            >
              Submission
            </h2>
            <div className="px-3 py-3">
              {detail.submission ? (
                <SubmissionContentView content={detail.submission.content} />
              ) : (
                <EmptyGradesState title="No submission is available for this assignment." />
              )}
            </div>
          </section>

          {detail.feedback ? (
            <div className="mt-4 border border-slate-200 px-3 py-3">
              <CompletionCriteria feedback={detail.feedback} />
            </div>
          ) : null}

          <div className="mt-4 border border-slate-200 px-3 py-3">
            <SubmissionHistory
              items={historyQuery.data ?? []}
              isLoading={historyQuery.isPending}
              errorMessage={historyQuery.isError ? 'History unavailable.' : null}
            />
          </div>
        </div>

        <div className="hidden lg:block">
          <AssignmentSummaryRail detail={detail} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-2.5 sm:px-6">
        <section
          aria-label="Assignment actions"
          className="flex flex-wrap items-center justify-end gap-2"
        >
          {entry.event ? (
            <Link
              to={`/grades/events/${entry.event.id}`}
              className={barButton}
            >
              View Event Gradebook
            </Link>
          ) : null}
          {canExcuse ? (
            <button
              type="button"
              data-testid="mark-excused-button"
              disabled={excuseMutation.isPending}
              onClick={() => excuseMutation.mutate(entry.id)}
              className={barButton}
            >
              Mark Excused
            </button>
          ) : null}
          {canReopen && detail.student ? (
            <button
              type="button"
              data-testid="reopen-submission-button"
              disabled={reopenMutation.isPending}
              onClick={() => reopenMutation.mutate()}
              className={barButton}
            >
              Reopen Submission
            </button>
          ) : null}
          {canEdit ? (
            <span
              data-testid="edit-grade-control"
              className="rounded-sm border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600"
            >
              Edit Grade available
            </span>
          ) : null}
          {entry.canResubmit ? (
            <button type="button" className={barButton}>
              Resubmit
            </button>
          ) : null}
          {entry.canSubmit ? (
            <button
              type="button"
              className="rounded-sm bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              {entry.status === 'draft' ? 'Continue Draft' : 'Submit'}
            </button>
          ) : null}
        </section>
      </div>
    </main>
  )
}
