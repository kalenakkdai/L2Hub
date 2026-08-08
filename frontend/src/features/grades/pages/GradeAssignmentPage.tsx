import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AssignmentRubricPanel } from '../components/AssignmentRubricPanel'
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
import type { RubricCriterionScore } from '../types'

const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'

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

  const rubricMutation = useMutation({
    mutationFn: async (scores: RubricCriterionScore[]) => {
      if (!commands?.updateGrade) throw new Error('Rubric grading unavailable')
      const entryId = detailQuery.data?.entry.id
      if (!entryId) throw new Error('Grade entry unavailable')
      return commands.updateGrade(entryId, {
        rubricScores: scores,
        status: 'graded',
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: gradebookKeys.assignment(assignmentId),
      })
      await queryClient.invalidateQueries({ queryKey: ['gradebook', 'me'] })
    },
  })

  if (detailQuery.isPending) {
    return (
      <p className="text-sm text-ink-muted" role="status">
        Loading assignment…
      </p>
    )
  }

  if (detailQuery.isError) {
    return (
      <div>
        <GradesErrorState
          message={
            detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'Assignment not found'
          }
          onRetry={() => void detailQuery.refetch()}
        />
        <p className="mt-4">
          <Link to="/grades" className="text-sm font-medium text-accent-ink underline">
            Back to Grades
          </Link>
        </p>
      </div>
    )
  }

  const detail = detailQuery.data
  const entry = detail.entry

  return (
    <div className="-mx-4 flex min-h-[70vh] flex-col sm:-mx-6 lg:-mx-10">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 px-4 sm:px-6 lg:px-10">
          <p className="mb-3">
            <Link
              to="/grades"
              className="text-xs font-medium text-ink-muted hover:text-ink hover:underline"
            >
              ← Grades
            </Link>
          </p>

          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
            <div>
              <h1 className="text-title font-semibold text-ink">
                {entry.assignmentTitle}
              </h1>
              <p className="mt-1 text-xs text-ink-subtle">
                {[entry.event?.name, entry.assignmentType.replaceAll('_', ' ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="lg:hidden">
              <GradeStatusIndicator status={entry.status} size="md" />
            </div>
          </header>

          <div className="mt-4 lg:hidden">
            <AssignmentSummaryRail detail={detail} />
          </div>

          <section
            aria-labelledby="submission-heading"
            className="mt-4 overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xs"
          >
            <h2
              id="submission-heading"
              className="border-b border-border-subtle bg-surface-sunken px-3 py-2 text-[13px] font-semibold text-ink"
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

          <div className="mt-4 overflow-hidden rounded-card border border-border-subtle bg-surface px-3 py-3 shadow-xs">
            <AssignmentRubricPanel
              rubric={detail.rubric}
              evaluation={detail.rubricEvaluation}
              dueAt={entry.dueAt}
              submittedAt={
                detail.submission?.submittedAt ?? entry.submittedAt
              }
              editable={canEdit}
              busy={rubricMutation.isPending}
              onSave={
                canEdit
                  ? (scores) => rubricMutation.mutate(scores)
                  : undefined
              }
            />
          </div>

          {detail.feedback ? (
            <div className="mt-4 overflow-hidden rounded-card border border-border-subtle bg-surface px-3 py-3 shadow-xs">
              <CompletionCriteria feedback={detail.feedback} />
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-card border border-border-subtle bg-surface px-3 py-3 shadow-xs">
            <SubmissionHistory
              items={historyQuery.data ?? []}
              isLoading={historyQuery.isPending}
              errorMessage={historyQuery.isError ? 'History unavailable.' : null}
            />
          </div>
        </div>

        <div className="hidden border-l border-border-subtle lg:block">
          <AssignmentSummaryRail detail={detail} />
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 border-t border-border-subtle bg-surface px-4 py-2.5 sm:px-6 lg:px-10">
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
              className="rounded-control border border-dashed border-border-strong px-3 py-1.5 text-xs text-ink-muted"
            >
              Edit rubric parts above
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
              className="rounded-control bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700"
            >
              {entry.status === 'draft' ? 'Continue Draft' : 'Submit'}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  )
}
