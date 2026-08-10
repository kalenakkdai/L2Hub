import { useMemo, useState } from 'react'
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom'
import {
  useMessengerAgendaCommands,
  useMessengerSession,
} from '../hooks/useMessengerAgenda'
import type { MessengerAgendaSession } from '../types'
import { agendaToPlanDocument } from '../lib/planBridge'
import {
  AttributedLine,
  AttributedTranscript,
  ContributorLegend,
  contributorIndex,
} from '../components/AgendaHighlights'

type OutletCtx = { canIngest: boolean; canPlan: boolean }

const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'
const field =
  'mt-1 w-full rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm text-ink'

export function MessengerAgendaSessionPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const { canIngest, canPlan } = useOutletContext<OutletCtx>()
  const sessionQuery = useMessengerSession(sessionId)
  const commands = useMessengerAgendaCommands()
  const [draftText, setDraftText] = useState('')

  const session = sessionQuery.data
  const isFinal = session?.status === 'finalized'
  const isCapturing = session?.status === 'capturing'

  const storageKey = useMemo(
    () => (session ? `l2hub.messenger-agenda.bridge.${session.id}` : null),
    [session],
  )

  if (sessionQuery.isPending) {
    return <p className="text-sm text-ink-muted">Loading session…</p>
  }
  if (sessionQuery.isError || !session) {
    return (
      <div>
        <p className="text-sm text-ink-muted">Session not found.</p>
        <Link to="/messenger-agenda" className="text-sm underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p>
        <Link
          to="/messenger-agenda"
          className="text-xs font-medium text-ink-muted underline"
        >
          ← Messenger Agenda
        </Link>
      </p>

      <header>
        <h1 className="text-title font-semibold text-ink">{session.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Status: <span className="font-medium text-ink">{session.status}</span>
          {session.threadLabel ? ` · ${session.threadLabel}` : ''}
          {' · '}
          Keywords: “{session.startKeyword}” → “{session.endKeyword}”
        </p>
      </header>

      {canIngest && !isFinal ? (
        <section className="space-y-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Capture</h2>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-ink-muted">
            <li>Press Start capturing (server clock).</li>
            <li>
              Say or type <strong className="text-ink">{session.startKeyword}</strong>{' '}
              in the chat.
            </li>
            <li>Paste or sync the conversation while the meeting runs.</li>
            <li>
              Say or type <strong className="text-ink">{session.endKeyword}</strong>{' '}
              — the agenda generates automatically.
            </li>
          </ol>

          {!isCapturing ? (
            <button
              type="button"
              className={barButton}
              disabled={commands.startCapture.isPending}
              onClick={() => commands.startCapture.mutate(session.id)}
            >
              Start capturing
            </button>
          ) : (
            <p className="text-xs font-medium text-accent-700" role="status">
              Capturing since{' '}
              {session.capturingStartedAt
                ? new Date(session.capturingStartedAt).toLocaleTimeString()
                : 'now'}
            </p>
          )}

          <label className="block text-sm text-ink-muted">
            Chat text (Messenger paste or live sync)
            <textarea
              className={field}
              rows={10}
              value={draftText || session.rawText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={`Paste the Messenger thread here. Include "${session.startKeyword}" and "${session.endKeyword}".`}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={barButton}
              disabled={commands.ingest.isPending || !(draftText || session.rawText)}
              onClick={() => {
                const text = draftText || session.rawText
                void commands.ingest
                  .mutateAsync({ sessionId: session.id, rawText: text })
                  .then((next) => {
                    setDraftText(next.rawText)
                  })
              }}
            >
              Ingest chat
            </button>
            <button
              type="button"
              className={barButton}
              disabled={commands.finalize.isPending}
              onClick={() => commands.finalize.mutate(session.id)}
            >
              Finalize now
            </button>
          </div>
        </section>
      ) : null}

      {session.capturedText ? (
        <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Captured window</h2>
            <p className="text-xs text-ink-subtle">
              {session.contributors.length} contributor
              {session.contributors.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="mt-2">
            <ContributorLegend contributors={session.contributors} />
          </div>
          {session.transcript.length > 0 ? (
            <AttributedTranscript
              lines={session.transcript}
              contributors={session.contributors}
            />
          ) : (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-ink-muted">
              {session.capturedText}
            </pre>
          )}
        </section>
      ) : null}

      {isFinal ? (
        <>
          <AgendaPreview session={session} />

          <section className="space-y-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Assignments</h2>
              {canIngest ? (
                <button
                  type="button"
                  className={barButton}
                  disabled={commands.generateAssignments.isPending}
                  onClick={() => commands.generateAssignments.mutate(session.id)}
                >
                  Auto-generate assignments
                </button>
              ) : null}
            </div>
            {(session.assignments?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-muted">
                No assignment drafts yet. Press Auto-generate assignments.
              </p>
            ) : (
              <ul className="space-y-2">
                {session.assignments.map((item, index) => {
                  const person = item.attributedTo
                    ? session.contributors.find((c) => c.name === item.attributedTo)
                    : undefined
                  return (
                    <li
                      key={`${item.committeeSlug}-${index}`}
                      className="rounded-control border border-border-subtle border-l-2 px-3 py-2 text-sm"
                      style={
                        person
                          ? {
                              borderLeftColor: person.color,
                              backgroundColor: person.highlight,
                            }
                          : undefined
                      }
                    >
                      <p className="font-medium text-ink">{item.roleLabel}</p>
                      <p className="text-xs text-ink-subtle">
                        {item.committeeName} · from “{item.sourceLine}”
                      </p>
                      {item.attributedTo ? (
                        <p
                          className="mt-1 text-xs font-semibold"
                          style={{ color: person?.color }}
                        >
                          Raised by {item.attributedTo}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {canPlan ? (
            <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
              <h2 className="text-sm font-semibold text-ink">Event planning</h2>
              <p className="mt-1 text-xs text-ink-subtle">
                Opens a new event plan with this agenda and assignment drafts
                ready to apply.
              </p>
              <button
                type="button"
                className={`${barButton} mt-3`}
                onClick={() => {
                  if (!storageKey) return
                  const bridge = {
                    sessionId: session.id,
                    title: session.agenda.title || session.title,
                    summary: session.agenda.summary || session.capturedText.slice(0, 280),
                    agenda: agendaToPlanDocument(session),
                    assignments: session.assignments,
                  }
                  window.sessionStorage.setItem(storageKey, JSON.stringify(bridge))
                  navigate(
                    `/event-planning?fromMessenger=${encodeURIComponent(session.id)}`,
                  )
                }}
              >
                Open new event from agenda
              </button>
              {session.planId ? (
                <p className="mt-2 text-xs text-ink-subtle">
                  Linked plan:{' '}
                  <Link
                    to={`/event-planning/${session.planId}`}
                    className="underline"
                  >
                    {session.planId}
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function AgendaPreview({ session }: { session: MessengerAgendaSession }) {
  const agenda = session.agenda
  const index = contributorIndex(session.contributors)
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Meeting agenda</h2>
        <ContributorLegend contributors={session.contributors} />
      </div>
      <p className="mt-1 text-base font-semibold text-ink">
        {agenda.title || session.title}
      </p>
      {agenda.summary ? (
        <p className="mt-2 text-sm text-ink-muted">{agenda.summary}</p>
      ) : null}
      {agenda.goals && agenda.goals.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase text-ink-subtle">Goals</h3>
          <ul className="mt-1 space-y-1">
            {agenda.goals.map((goal, i) => (
              <AttributedLine
                key={`goal-${i}`}
                bullet={goal}
                contributors={index}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {(agenda.sections ?? []).map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold uppercase text-ink-subtle">
              {section.title}
            </h3>
            {section.bullets.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">—</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {section.bullets.map((bullet, i) => (
                  <AttributedLine
                    key={`${section.title}-${i}`}
                    bullet={bullet}
                    contributors={index}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
