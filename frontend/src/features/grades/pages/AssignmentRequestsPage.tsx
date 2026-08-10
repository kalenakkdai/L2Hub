import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { useGradebookContext } from '../context/GradebookProvider'
import {
  useGradebookCommands,
  useGradebookPermissions,
} from '../hooks/useGradebook'

const field =
  'mt-1 w-full rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm text-ink'
const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'

/**
 * Heads send draft assignment proposals to Jan; Jan/Jadon approve or reject.
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!commands?.submitAssignmentRequest) {
        throw new Error('Request unavailable')
      }
      return commands.submitAssignmentRequest({
        title: title.trim(),
        description: description.trim() || undefined,
        proposedPoints: Number(points) || 10,
        proposedCategoryId: 'cat-deliverables',
      })
    },
    onSuccess: async () => {
      setTitle('')
      setDescription('')
      setPoints('10')
      await queryClient.invalidateQueries({
        queryKey: ['gradebook', 'assignment-requests'],
      })
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
      <p className="mb-1">
        <Link
          to="/grades"
          className="text-sm font-medium text-ink-muted underline"
        >
          ← Grades
        </Link>
      </p>
      <header>
        <h1 className="text-title font-semibold text-ink">
          Assignment requests
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Committee heads send draft assignments to Jan. Jan or Jadon approve
          before they appear in the gradebook.
        </p>
      </header>

      {canRequest ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
        >
          <h2 className="text-sm font-semibold text-ink">Send a draft to Jan</h2>
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
            Description
            <textarea
              className={field}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm text-ink-muted">
            Proposed points
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
            {submitMutation.isPending ? 'Sending…' : 'Send draft request'}
          </button>
        </form>
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
        <EmptyGradesState title="No assignment requests yet." />
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
