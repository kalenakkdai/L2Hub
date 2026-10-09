import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Loader } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { fetchBoard, type BoardTask } from './api'
import { taskDueState, todayStamp } from './dueDates'
import { TaskRow } from './TaskRow'

type MyTask = { task: BoardTask; committeeName: string; canEdit: boolean }

/** Soonest first; undated work sinks below anything with a deadline. */
function byDue(a: MyTask, b: MyTask): number {
  const left = a.task.dueOn ?? '9999-12-31'
  const right = b.task.dueOn ?? '9999-12-31'
  return left.localeCompare(right) || a.task.createdAt.localeCompare(b.task.createdAt)
}

function TaskGroup({
  title,
  tasks,
  today,
  viewerId,
}: {
  title: string
  tasks: MyTask[]
  today: string
  viewerId: string
}) {
  if (tasks.length === 0) return null
  return (
    <section aria-label={title} className="mb-6">
      <h2 className="mb-2 text-[13px] font-semibold text-ink-subtle">
        {title} <span className="font-mono font-normal">{tasks.length}</span>
      </h2>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <ul>
          {tasks.map(({ task, committeeName, canEdit }) => (
            <TaskRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              committeeName={committeeName}
              viewerId={viewerId}
              today={today}
              // Reassigning is a committee decision, made on the board.
              onReassign={() => undefined}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * Everything assigned to the signed-in camper, across every committee.
 *
 * Reads the same board query as the L2 Board, so moving a task here moves it
 * there too. Reassignment stays on the board; here the only change is status.
 */
export function MyTasksPage() {
  const me = useCurrentUser()
  const [showDone, setShowDone] = useState(false)
  const board = useQuery({ queryKey: ['board'], queryFn: fetchBoard })
  const today = todayStamp()

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const mine: MyTask[] = (board.data?.committees ?? []).flatMap((column) =>
    column.tasks
      .filter((task) => task.assignee?.id === profile.id)
      // Reassign lives on the board, so the row never offers it here.
      .map((task) => ({ task, committeeName: column.name, canEdit: false })),
  )
  mine.sort(byDue)

  const open = mine.filter(({ task }) => task.status !== 'done')
  const overdue = open.filter(({ task }) => taskDueState(task, today) === 'overdue')
  const todo = open.filter(
    ({ task }) => task.status === 'todo' && taskDueState(task, today) !== 'overdue',
  )
  const doing = open.filter(
    ({ task }) => task.status === 'doing' && taskDueState(task, today) !== 'overdue',
  )
  const done = mine.filter(({ task }) => task.status === 'done')

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <p className="mb-1.5 text-[13px] text-ink-subtle">
        {board.isSuccess
          ? open.length > 0
            ? `${open.length} open${overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}`
            : 'Nothing open'
          : 'Your work'}
      </p>
      <h1 className="text-display font-bold text-ink">My tasks</h1>
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
      <p className="mb-5 max-w-[70ch] text-sm text-ink-subtle">
        Everything assigned to you, from every committee. Change a status here
        and it changes on the{' '}
        <Link to="/board" className="text-accent-600 underline-offset-2 hover:underline">
          L2 Board
        </Link>{' '}
        too.
      </p>

      {board.isPending && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Finding your tasks…
        </p>
      )}

      {board.isError && (
        <ErrorState
          title="Could not load your tasks"
          description="Try again in a moment."
          onRetry={() => void board.refetch()}
        />
      )}

      {board.isSuccess &&
        (mine.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nothing assigned to you"
            description="When someone gives you a task on the L2 Board, it shows up here."
          />
        ) : (
          <>
            {open.length === 0 && (
              <p className="mb-6 text-sm text-ink-subtle">
                You are all caught up.
              </p>
            )}
            <TaskGroup title="Overdue" tasks={overdue} today={today} viewerId={profile.id} />
            <TaskGroup title="In progress" tasks={doing} today={today} viewerId={profile.id} />
            <TaskGroup title="To do" tasks={todo} today={today} viewerId={profile.id} />

            {done.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={showDone}
                  onClick={() => setShowDone((was) => !was)}
                  className="mb-2 text-[13px] text-accent-600 underline-offset-2 hover:underline"
                >
                  {showDone ? 'Hide' : 'Show'} {done.length} done
                </button>
                {showDone && (
                  <TaskGroup title="Done" tasks={done} today={today} viewerId={profile.id} />
                )}
              </>
            )}
          </>
        ))}
    </AppShell>
  )
}
