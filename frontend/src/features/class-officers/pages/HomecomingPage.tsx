import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ErrorState } from '../../../components/ui/ErrorState'
import {
  useClassOfficersCommands,
  useClassOfficersSnapshot,
} from '../hooks/useClassOfficers'
import { checkpointTone, homecomingCompletion } from '../lib/progress'
import type {
  Airband,
  CheckpointStatus,
  HomecomingCheckpoint,
  NamedPerson,
} from '../types'

type OutletContext = { canManage: boolean }

function peopleLines(people: NamedPerson[]): string {
  return people
    .map((person) =>
      person.note ? `${person.name} — ${person.note}` : person.name,
    )
    .join('\n')
}

function parsePeople(text: string): NamedPerson[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, ...rest] = line.split('—').map((part) => part.trim())
      return {
        id: `person-${index}-${name}`,
        name,
        note: rest.length ? rest.join(' — ') : null,
      }
    })
}

function airbandLines(bands: Airband[]): string {
  return bands
    .map(
      (band) =>
        `${band.groupName} | ${band.song} | ${band.members.join(', ')}`,
    )
    .join('\n')
}

function parseAirbands(text: string): Airband[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [groupName = 'Airband', song = 'TBD', members = ''] = line
        .split('|')
        .map((part) => part.trim())
      return {
        id: `air-${index}`,
        groupName,
        song,
        members: members
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      }
    })
}

function checkpointLines(checkpoints: HomecomingCheckpoint[]): string {
  return checkpoints
    .map(
      (checkpoint) =>
        `${checkpoint.date} | ${checkpoint.status} | ${checkpoint.title} | ${checkpoint.detail}`,
    )
    .join('\n')
}

function parseCheckpoints(text: string): HomecomingCheckpoint[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [date = '', status = 'upcoming', title = 'Checkpoint', detail = ''] =
        line.split('|').map((part) => part.trim())
      const normalized = (
        ['upcoming', 'done', 'missed'].includes(status) ? status : 'upcoming'
      ) as CheckpointStatus
      return {
        id: `cp-${index}-${date}`,
        date,
        status: normalized,
        title,
        detail,
      }
    })
}

function PersonList({
  title,
  people,
}: {
  title: string
  people: NamedPerson[]
}) {
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-1 text-sm text-ink-muted">
        {people.map((person) => (
          <li key={person.id}>
            {person.name}
            {person.note ? (
              <span className="text-ink-subtle"> · {person.note}</span>
            ) : null}
          </li>
        ))}
        {people.length === 0 ? <li>None listed yet.</li> : null}
      </ul>
    </section>
  )
}

export function HomecomingPage() {
  const { canManage } = useOutletContext<OutletContext>()
  const snapshot = useClassOfficersSnapshot()
  const { updateHomecoming } = useClassOfficersCommands()

  const [skitTheme, setSkitTheme] = useState('')
  const [skitScript, setSkitScript] = useState('')
  const [skitScriptUrl, setSkitScriptUrl] = useState('')
  const [skitActorsText, setSkitActorsText] = useState('')
  const [airbandsText, setAirbandsText] = useState('')
  const [actorsText, setActorsText] = useState('')
  const [stageCrewText, setStageCrewText] = useState('')
  const [cleanupCrewText, setCleanupCrewText] = useState('')
  const [checkpointsText, setCheckpointsText] = useState('')

  useEffect(() => {
    if (!snapshot.data) return
    const plan = snapshot.data.homecoming
    setSkitTheme(plan.skitTheme)
    setSkitScript(plan.skitScript)
    setSkitScriptUrl(plan.skitScriptUrl ?? '')
    setSkitActorsText(peopleLines(plan.skitActors))
    setAirbandsText(airbandLines(plan.airbands))
    setActorsText(peopleLines(plan.actors))
    setStageCrewText(peopleLines(plan.stageCrew))
    setCleanupCrewText(peopleLines(plan.cleanupCrew))
    setCheckpointsText(checkpointLines(plan.checkpoints))
  }, [snapshot.data])

  if (snapshot.isPending) {
    return <p className="text-sm text-ink-muted">Loading homecoming…</p>
  }
  if (snapshot.isError || !snapshot.data) {
    return (
      <ErrorState
        title="Could not load homecoming"
        description="Try again in a moment."
        onRetry={() => void snapshot.refetch()}
      />
    )
  }

  const plan = snapshot.data.homecoming
  const completion = homecomingCompletion(plan)

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
        <h2 className="text-sm font-semibold text-ink">
          Homecoming {plan.year}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {plan.skitTheme || 'Theme TBD'}
        </p>
        <p className="mt-3 text-xs text-ink-subtle">
          {completion.done}/{completion.total} checkpoints complete
        </p>
      </section>

      <section
        aria-label="Checkpoints calendar"
        className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
      >
        <h3 className="text-sm font-semibold text-ink">Checkpoints calendar</h3>
        <ol className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {plan.checkpoints.map((checkpoint) => (
            <li
              key={checkpoint.id}
              className="min-w-[160px] shrink-0 rounded-control border border-border-subtle bg-surface-sunken px-3 py-2"
            >
              <p className="text-[11px] font-semibold text-ink-subtle">
                {checkpoint.date}
              </p>
              <p className="mt-1 text-sm font-medium text-ink">{checkpoint.title}</p>
              <p className={`mt-1 text-[11px] capitalize ${checkpointTone(checkpoint.status)}`}>
                {checkpoint.status}
              </p>
              <p className="mt-2 text-xs text-ink-muted">{checkpoint.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
        <h3 className="text-sm font-semibold text-ink">Skit</h3>
        <p className="mt-2 text-xs font-semibold text-ink-subtle">Theme</p>
        <p className="text-sm text-ink">{plan.skitTheme || '—'}</p>
        <p className="mt-3 text-xs font-semibold text-ink-subtle">Script</p>
        <pre className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">
          {plan.skitScript || '—'}
        </pre>
        {plan.skitScriptUrl ? (
          <a
            href={plan.skitScriptUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-status-info hover:underline"
          >
            Open script link
          </a>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PersonList title="Skit actors" people={plan.skitActors} />
        <PersonList title="Homecoming actors" people={plan.actors} />
        <PersonList title="Stage crew" people={plan.stageCrew} />
        <PersonList title="Cleanup crew" people={plan.cleanupCrew} />
      </div>

      <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
        <h3 className="text-sm font-semibold text-ink">Homecoming airbands</h3>
        <ul className="mt-3 space-y-3">
          {plan.airbands.map((band) => (
            <li key={band.id} className="rounded-control border border-border-subtle px-3 py-2">
              <p className="text-sm font-medium text-ink">{band.groupName}</p>
              <p className="text-xs text-ink-muted">{band.song}</p>
              <p className="mt-1 text-xs text-ink-subtle">{band.members.join(', ')}</p>
            </li>
          ))}
          {plan.airbands.length === 0 ? (
            <li className="text-sm text-ink-muted">No airbands listed yet.</li>
          ) : null}
        </ul>
      </section>

      {canManage ? (
        <form
          className="space-y-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
          onSubmit={(event) => {
            event.preventDefault()
            void updateHomecoming.mutateAsync({
              skitTheme,
              skitScript,
              skitScriptUrl: skitScriptUrl || null,
              skitActors: parsePeople(skitActorsText),
              airbands: parseAirbands(airbandsText),
              actors: parsePeople(actorsText),
              stageCrew: parsePeople(stageCrewText),
              cleanupCrew: parsePeople(cleanupCrewText),
              checkpoints: parseCheckpoints(checkpointsText),
            })
          }}
        >
          <h3 className="text-sm font-semibold text-ink">Edit homecoming plan</h3>
          <label className="block text-xs font-medium text-ink-muted">
            Skit theme
            <input
              value={skitTheme}
              onChange={(event) => setSkitTheme(event.target.value)}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block text-xs font-medium text-ink-muted">
            Skit script
            <textarea
              value={skitScript}
              onChange={(event) => setSkitScript(event.target.value)}
              rows={5}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block text-xs font-medium text-ink-muted">
            Script URL (optional)
            <input
              value={skitScriptUrl}
              onChange={(event) => setSkitScriptUrl(event.target.value)}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </label>
          {(
            [
              ['Skit actors (one per line: Name — note)', skitActorsText, setSkitActorsText],
              [
                'Airbands (one per line: Group | Song | Member1, Member2)',
                airbandsText,
                setAirbandsText,
              ],
              ['Homecoming actors', actorsText, setActorsText],
              ['Stage crew', stageCrewText, setStageCrewText],
              ['Cleanup crew', cleanupCrewText, setCleanupCrewText],
              [
                'Checkpoints (date | status | title | detail)',
                checkpointsText,
                setCheckpointsText,
              ],
            ] as const
          ).map(([label, value, setter]) => (
            <label key={label} className="block text-xs font-medium text-ink-muted">
              {label}
              <textarea
                value={value}
                onChange={(event) => setter(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 font-mono text-xs text-ink"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={updateHomecoming.isPending}
            className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
          >
            Save homecoming
          </button>
        </form>
      ) : (
        <p className="text-xs text-ink-subtle">
          Class Advisors can review these lists but cannot edit them.
        </p>
      )}
    </div>
  )
}
