import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  useMessengerAgendaCommands,
  useMessengerConnection,
  useMessengerSessions,
} from '../hooks/useMessengerAgenda'

type OutletCtx = { canIngest: boolean; canPlan: boolean }

const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'

export function MessengerAgendaListPage() {
  const navigate = useNavigate()
  const { canIngest } = useOutletContext<OutletCtx>()
  const connectionQuery = useMessengerConnection()
  const sessionsQuery = useMessengerSessions()
  const commands = useMessengerAgendaCommands()

  const connection = connectionQuery.data
  const threads = connection?.grantedThreads ?? []

  return (
    <div className="space-y-6">
      <header className="border-b border-border-subtle pb-4">
        <p className="mb-2">
          <Link to="/tools" className="text-xs font-medium text-ink-muted underline">
            ← Tools
          </Link>
        </p>
        <h1 className="text-display font-semibold text-ink">Messenger Agenda</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Grant access to Messenger chats, press Start, say or type{' '}
          <span className="font-medium text-ink">agenda start</span>, capture the
          conversation, then say <span className="font-medium text-ink">agenda end</span>{' '}
          to generate a meeting agenda. Open a new event plan and auto-generate
          assignments from the same capture.
        </p>
      </header>

      <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
        <h2 className="text-sm font-semibold text-ink">Messenger access</h2>
        <p className="mt-1 text-xs text-ink-subtle">
          Only chats you explicitly grant are readable. Paste mode always works
          as a fallback.
        </p>
        {connectionQuery.isPending ? (
          <p className="mt-3 text-sm text-ink-muted">Checking connection…</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink">
              Status:{' '}
              <span className="font-medium">
                {connection?.status === 'connected' ? 'Connected' : 'Not connected'}
              </span>
            </p>
            {connection?.status === 'connected' && threads.length > 0 ? (
              <ul className="space-y-1 text-sm text-ink-muted">
                {threads.map((thread) => (
                  <li key={thread.id}>• {thread.label}</li>
                ))}
              </ul>
            ) : null}
            {canIngest ? (
              <div className="flex flex-wrap gap-2">
                {connection?.status !== 'connected' ? (
                  <button
                    type="button"
                    className={barButton}
                    disabled={commands.connect.isPending}
                    onClick={() => commands.connect.mutate([])}
                  >
                    Connect Messenger chats
                  </button>
                ) : (
                  <button
                    type="button"
                    className={barButton}
                    disabled={commands.disconnect.isPending}
                    onClick={() => commands.disconnect.mutate()}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {canIngest ? (
        <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">New capture</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={barButton}
              disabled={commands.createSession.isPending}
              onClick={() => {
                void commands.createSession
                  .mutateAsync({ title: 'Messenger agenda', source: 'paste' })
                  .then((session) => navigate(`/messenger-agenda/${session.id}`))
              }}
            >
              Start from paste
            </button>
            {connection?.status === 'connected'
              ? threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    className={barButton}
                    disabled={commands.createSession.isPending}
                    onClick={() => {
                      void commands.createSession
                        .mutateAsync({
                          title: `${thread.label} agenda`,
                          source: 'messenger',
                          threadId: thread.id,
                          threadLabel: thread.label,
                        })
                        .then((session) =>
                          navigate(`/messenger-agenda/${session.id}`),
                        )
                    }}
                  >
                    Capture {thread.label}
                  </button>
                ))
              : null}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Recent sessions</h2>
        {sessionsQuery.isPending ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-muted">No captures yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface shadow-xs">
            {sessionsQuery.data?.map((session) => (
              <li key={session.id}>
                <Link
                  to={`/messenger-agenda/${session.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-sunken"
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      {session.title}
                    </span>
                    <span className="text-xs text-ink-subtle">
                      {session.status}
                      {session.threadLabel ? ` · ${session.threadLabel}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-ink-muted">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
