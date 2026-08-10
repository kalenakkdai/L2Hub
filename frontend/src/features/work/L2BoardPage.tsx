import { useQuery } from '@tanstack/react-query'
import { Loader } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import {
  fetchBoard,
  fetchBoardCommittees,
  type BoardColumn,
  type BoardTask,
} from './api'
import { AssignTaskDialog } from './AssignTaskDialog'
import { BoardCompactRow } from './BoardCompactRow'
import { CommitteeColumn } from './CommitteeColumn'
import { DEFAULT_BOARD_VIEW, parseViewMode, type BoardViewMode } from './boardView'
import { todayStamp } from './dueDates'
import { NewTaskDialog } from './NewTaskDialog'
import { ViewModeSwitcher } from './ViewModeSwitcher'

/**
 * Every committee and what it is working on.
 *
 * Two layouts, because the page answers two questions. Expanded is the
 * original strip of columns, good for working inside one committee. Compact
 * folds each committee into a row so the whole of Leadership 2 fits on one
 * screen, which is the question a leadership surface is usually asked.
 *
 * Writing stays scoped either way — `canAddTask` comes from the server, per
 * column.
 */
export function L2BoardPage() {
  const me = useCurrentUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [addingTo, setAddingTo] = useState<BoardColumn | null>(null)
  const [assigning, setAssigning] = useState<
    { task: BoardTask; committeeName: string } | null
  >(null)
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set())

  const view = parseViewMode(searchParams.get('view'))

  // Computed once per render and passed down, so a board left open across
  // midnight cannot end up with rows disagreeing about what "today" is.
  const today = todayStamp()

  const board = useQuery({ queryKey: ['board'], queryFn: fetchBoard })
  const picker = useQuery({
    queryKey: ['board', 'committees'],
    queryFn: fetchBoardCommittees,
    staleTime: 300_000,
  })

  const setView = (next: BoardViewMode) => {
    const params = new URLSearchParams(searchParams)
    // The default is left out of the address rather than written into it, and
    // replace: true keeps Back meaning "the previous page" rather than
    // "the previous layout".
    if (next === DEFAULT_BOARD_VIEW) params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  const toggleRow = (id: string) =>
    setOpenRows((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const columns = board.data?.committees ?? []
  const allOpen = columns.length > 0 && columns.every((c) => openRows.has(c.id))

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <p className="mb-1.5 text-[13px] text-ink-subtle">Leadership</p>
      <h1 className="text-display font-bold text-ink">L2 Board</h1>
    </header>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
      header={header}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[70ch] text-sm text-ink-subtle">
          What every committee is working on, and who has it. Adding a task here
          also lets you say which other committees you need — each one gets a{' '}
          <Link to="/requests" className="text-accent-600 underline-offset-2 hover:underline">
            request
          </Link>{' '}
          on the record.
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {view === 'compact' && columns.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setOpenRows(allOpen ? new Set() : new Set(columns.map((c) => c.id)))
              }
              className="rounded-control border border-border-subtle px-2.5 py-1 text-[12.5px] text-ink-muted transition hover:border-accent-600 hover:text-accent-ink"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
          <ViewModeSwitcher value={view} onChange={setView} />
        </div>
      </div>

      {board.isPending && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Setting up the board…
        </p>
      )}

      {board.isError && (
        <ErrorState
          title="Could not load the board"
          description="The committees did not come back. Try again in a moment."
          onRetry={() => void board.refetch()}
        />
      )}

      {board.isSuccess &&
        (columns.length === 0 ? (
          <EmptyState
            title="No committees yet"
            description="Once committees exist, their work shows up here."
          />
        ) : view === 'compact' ? (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
            <ul>
              {columns.map((column) => (
                <BoardCompactRow
                  key={column.id}
                  column={column}
                  open={openRows.has(column.id)}
                  onToggle={() => toggleRow(column.id)}
                  onAddTask={() => setAddingTo(column)}
                  onReassign={(task) =>
                    setAssigning({ task, committeeName: column.name })
                  }
                  today={today}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            {columns.map((column) => (
              <CommitteeColumn
                key={column.id}
                column={column}
                onAddTask={() => setAddingTo(column)}
                onReassign={(task) =>
                  setAssigning({ task, committeeName: column.name })
                }
                today={today}
              />
            ))}
          </div>
        ))}

      {addingTo && (
        <NewTaskDialog
          committee={addingTo}
          allCommittees={picker.data?.committees ?? []}
          onClose={() => setAddingTo(null)}
        />
      )}

      {assigning && (
        <AssignTaskDialog
          task={assigning.task}
          committeeName={assigning.committeeName}
          onClose={() => setAssigning(null)}
        />
      )}
    </AppShell>
  )
}
