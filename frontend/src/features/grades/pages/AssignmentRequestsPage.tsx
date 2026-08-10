import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { fetchGradeAssignments } from '../api/fastapiGradebookAdapter'
import { useGradebookContext } from '../context/GradebookProvider'
import {
  gradebookKeys,
  useGradebookCommands,
  useGradebookPermissions,
} from '../hooks/useGradebook'

const field =
  'mt-1 w-full rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm text-ink'
const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'

const CATEGORY_OPTIONS = [
  { id: 'cat-debriefs', label: 'Event debriefs' },
  { id: 'cat-reflections', label: 'Reflections' },
  { id: 'cat-deliverables', label: 'Deliverables' },
  { id: 'cat-participation', label: 'Participation' },
  { id: 'cat-committee-grades', label: 'Committee grades' },
]

/**
 * Every member may propose an assignment; Jan/Jadon approve or reject.
 */
export function AssignmentRequestsPage() {
  const { dataProvider } = useGradebookContext()
  const { hasPermission } = useGradebookPermissions()
  const commands = useGradebookCommands()
  const queryClient = useQueryClient()

  const canRequest =
    hasPermission('gradebook.request_assignment') &&
    Boolean(commands?.submitAssignmentRequest)
  const canReview =
    hasPermission('gradebook.assign') &&
    Boolean(commands?.reviewAssignmentRequest)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState('10')
  const [categoryId, setCategoryId] = useState('cat-deliverables')
  const [createdAssignmentId, setCreatedAssignmentId] = useState<string | null>(
    null,
  )

  const assignmentsQuery = useQuery({
    queryKey: ['gradebook', 'assignments'],
    queryFn: fetchGradeAssignments,
    enabled: canReview,
  })

  const listQuery = useQuery({
    queryKey: ['gradebook', 'assignment-requests'],
    queryFn: async () => {
      if (!dataProvider.getAssignmentRequests) return []
      return dataProvider.getAssignmentRequests()
    },
    enabled: canRequest || canReview,
  })

  const requests = listQuery.data ?? []
  const pending = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests],
  )

  // Jan/Jadon skip their own approval queue and publish the assignment directly.
  const createsDirectly = canReview && Boolean(commands?.createAssignment)

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (createsDirectly) {
        return commands!.createAssignment!({
          title: title.trim(),
          categoryId,
          pointsPossible: Number(points) || 10,
          assignmentType: 'custom',
          description: description.trim() || null,
        })
      }
      if (!commands?.submitAssignmentRequest) {
        throw new Error('Request unavailable')
      }
      return commands.submitAssignmentRequest({
        title: title.trim(),
        description: description.trim() || undefined,
        proposedPoints: Number(points) || 10,
        proposedCategoryId: categoryId,
      })
    },
    onSuccess: async (result) => {
      setTitle('')
      setDescription('')
      setPoints('10')
      setCreatedAssignmentId(createsDirectly ? result.id : null)
      await queryClient.invalidateQueries({
        queryKey: ['gradebook', 'assignment-requests'],
      })
      await queryClient.invalidateQueries({ queryKey: gradebookKeys.me() })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: async (input: {
      id: string
      decision: 'approve' | 'reject'
    }) => {
      if (!commands?.reviewAssignmentRequest) {
        throw new Error('Review unavailable')
      }
      return commands.reviewAssignmentRequest(input.id, input.decision)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['gradebook', 'assignment-requests'],
      })
    },
  })

  if (!canRequest && !canReview) {
    return (
      <GradesErrorState message="You do not have permission to view assignment requests." />
    )
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    submitMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Gradebook sections"
        className="flex border-b border-border-divider"
      >
        <Link
          to="/grades"
          className="px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink"
        >
          My grades
        </Link>
        <span className="border-b-2 border-accent-600 px-3 py-2 text-xs font-semibold text-ink">
          Assignment proposals
        </span>
      </nav>
      <header>
        <h1 className="text-title font-semibold text-ink">
          Assignment proposals
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {createsDirectly
            ? 'Create assignments for the class, and approve or reject what everyone else proposes.'
            : 'Anyone may propose an assignment. It stays a draft until Mr. Jan or Jadon approves it for the gradebook.'}
        </p>
      </header>

      {canRequest || createsDirectly ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
        >
          <h2 className="text-sm font-semibold text-ink">
            {createsDirectly ? 'Create an assignment' : 'Propose an assignment'}
          </h2>
          {createsDirectly ? (
            <p className="text-xs text-ink-subtle">
              Enrolls every active camper right away, then open the roster to
              score and publish.
            </p>
          ) : null}
          <label className="block text-sm text-ink-muted">
            Title
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm text-ink-muted">
            Category
            <select
              className={field}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-ink-muted">
            Description
            <textarea
              className={field}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm text-ink-muted">
            {createsDirectly ? 'Points' : 'Proposed points'}
            <input
              className={field}
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className={barButton}
            disabled={submitMutation.isPending || !title.trim()}
          >
            {submitMutation.isPending
              ? 'Saving…'
              : createsDirectly
                ? 'Create assignment'
                : 'Submit proposal'}
          </button>
          {submitMutation.isError ? (
            <p className="text-xs text-status-danger" role="alert">
              {submitMutation.error instanceof Error
                ? submitMutation.error.message
                : 'Could not save that assignment.'}
            </p>
          ) : null}
          {createdAssignmentId ? (
            <p className="text-xs text-ink-muted">
              Created.{' '}
              <Link
                to={`/grades/events/${createdAssignmentId}`}
                className="font-medium text-accent-ink underline-offset-2 hover:underline"
              >
                Open roster to grade
              </Link>
            </p>
          ) : null}
        </form>
      ) : null}

      {canReview && (assignmentsQuery.data?.length ?? 0) > 0 ? (
        <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Live assignments</h2>
          <ul className="mt-2 space-y-1">
            {assignmentsQuery.data!.map((assignment) => (
              <li key={assignment.id} className="text-xs text-ink">
                <Link
                  to={`/grades/events/${assignment.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {assignment.title}
                </Link>
                <span className="text-ink-subtle">
                  {' '}
                  · {assignment.pointsPossible} pts · open roster to grade
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listQuery.isPending ? (
        <p className="text-sm text-ink-muted">Loading requests…</p>
      ) : null}
      {listQuery.isError ? (
        <GradesErrorState
          message="Could not load assignment requests."
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && requests.length === 0 ? (
        <EmptyGradesState title="No assignment proposals yet." />
      ) : null}

      {requests.length > 0 ? (
        <div className="space-y-3">
          {canReview && pending.length > 0 ? (
            <p className="text-xs text-ink-subtle">
              {pending.length} pending for review
            </p>
          ) : null}
          <ul className="space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-card border border-border-subtle bg-surface px-4 py-3 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{request.title}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {request.submittedBy.name}
                      {request.committeeName
                        ? ` · ${request.committeeName}`
                        : ''}{' '}
                      · {request.status}
                      {request.proposedPoints != null
                        ? ` · ${request.proposedPoints} pts`
                        : ''}
                    </p>
                    {request.description ? (
                      <p className="mt-2 text-sm text-ink-muted">
                        {request.description}
                      </p>
                    ) : null}
                    {request.createdAssignmentId ? (
                      <p className="mt-2 text-xs">
                        <Link
                          to={`/grades/events/${request.createdAssignmentId}`}
                          className="font-medium text-accent-ink underline-offset-2 hover:underline"
                        >
                          Open approved assignment roster
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  {canReview && request.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={barButton}
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            id: request.id,
                            decision: 'approve',
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className={barButton}
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            id: request.id,
                            decision: 'reject',
                          })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
