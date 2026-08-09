import { useId, useState } from 'react'
import { Link } from 'react-router-dom'

type SyllabusSection = 'attendance' | 'levels' | 'manual'

const SECTIONS: { id: SyllabusSection; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'levels', label: 'Levels' },
  { id: 'manual', label: 'Site manual' },
]

/**
 * Course reference material that lives next to the gradebook list tabs.
 * Attendance policy mirrors the server-authoritative attendance module;
 * levels describe the dashboard progression model; the site manual is a
 * short map of L2 Hub for Leadership 2.
 */
export function SyllabusPanel() {
  const baseId = useId()
  const [section, setSection] = useState<SyllabusSection>('attendance')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Leadership 2 syllabus</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Attendance rules, how levels work, and a short guide to using L2 Hub.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-sunken p-1"
        role="tablist"
        aria-label="Syllabus sections"
      >
        {SECTIONS.map((item) => {
          const selected = section === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${section}`}
        aria-labelledby={`${baseId}-${section}`}
        className="rounded-lg border border-border-subtle bg-surface px-4 py-4 sm:px-5"
      >
        {section === 'attendance' ? <AttendanceSection /> : null}
        {section === 'levels' ? <LevelsSection /> : null}
        {section === 'manual' ? <ManualSection /> : null}
      </div>
    </div>
  )
}

function AttendanceSection() {
  return (
    <article className="space-y-4 text-sm text-ink-muted">
      <header>
        <h3 className="text-base font-semibold text-ink">Attendance policy</h3>
        <p className="mt-1">
          Leadership meets on campus during the scheduled class window. Timing
          and lateness come from the server clock, not your laptop or phone.
        </p>
      </header>

      <ul className="list-disc space-y-2 pl-5">
        <li>
          Default class window is <strong className="font-medium text-ink">8:00–8:50 AM</strong>{' '}
          Pacific unless Campsite settings change it.
        </li>
        <li>
          Arriving more than <strong className="font-medium text-ink">60 seconds</strong> after
          class start is late and scores <strong className="font-medium text-ink">90%</strong> for
          that day.
        </li>
        <li>
          On-time presence scores <strong className="font-medium text-ink">100%</strong>. Closing
          the day subtracts bathroom/errand time from minutes in the room.
        </li>
        <li>
          Falling under <strong className="font-medium text-ink">80%</strong> presence marks the
          day for follow-up and can queue a parent alert.
        </li>
        <li>
          Check-in uses the shared kiosk (barcode / student ID) or an optional
          personal-device passkey from My settings. Raw student IDs are never
          stored in plain text.
        </li>
        <li>
          Leaving for an errand uses the whereabouts map so committee heads and
          advisers know where you went and can ping you to return.
        </li>
      </ul>

      <p>
        Operators open the scanner at{' '}
        <Link to="/attendance" className="font-medium text-accent-ink underline-offset-2 hover:underline">
          Attendance
        </Link>
        . Students use{' '}
        <Link to="/whereabouts" className="font-medium text-accent-ink underline-offset-2 hover:underline">
          Whereabouts map
        </Link>{' '}
        when they have access.
      </p>
    </article>
  )
}

function LevelsSection() {
  return (
    <article className="space-y-4 text-sm text-ink-muted">
      <header>
        <h3 className="text-base font-semibold text-ink">Class levels system</h3>
        <p className="mt-1">
          Levels track how far you have progressed in Leadership 2. Your
          dashboard shows the current level title and how many points remain to
          reach the next one (“get to level”).
        </p>
      </header>

      <ul className="list-disc space-y-2 pl-5">
        <li>
          Earn points from completed work, participation, and verified
          check-ins. The Campsite can set how many points sit between levels
          (often about 200).
        </li>
        <li>
          Each level has a title (for example Section Lead). Crossing the
          threshold unlocks the next title on your progress card.
        </li>
        <li>
          Streaks and participation rate sit beside points so consistency
          matters as much as one-off high scores.
        </li>
        <li>
          Grades and levels are related but separate: the gradebook is weighted
          assignment evidence; levels are the broader Leadership progression
          track shown on the dashboard.
        </li>
      </ul>

      <p>
        Check your standing anytime from the{' '}
        <Link to="/dashboard" className="font-medium text-accent-ink underline-offset-2 hover:underline">
          Dashboard
        </Link>{' '}
        progress panel.
      </p>
    </article>
  )
}

function ManualSection() {
  return (
    <article className="space-y-4 text-sm text-ink-muted">
      <header>
        <h3 className="text-base font-semibold text-ink">L2 Hub site manual</h3>
        <p className="mt-1">
          Short map of the product so you can find the right surface quickly.
        </p>
      </header>

      <dl className="space-y-3">
        <ManualRow
          title="Dashboard"
          to="/dashboard"
          body="Greeting, open work, next event, grades snapshot, and points/level progress. Use the search bar to jump to any page you can open."
        />
        <ManualRow
          title="Grades"
          to="/grades"
          body="Upcoming, Missing, and Completed assignment lists, weighted category totals, theoretical what-if scores, and this Syllabus tab."
        />
        <ManualRow
          title="Events & debriefs"
          to="/events"
          body="Happening now, upcoming, and previous events. Live debrief bubbles and Event Wrapped live under each event once advisers start them."
        />
        <ManualRow
          title="Event planning"
          to="/event-planning"
          body="Draft plans, agendas, and assignments. When Mr. Jan enables a plan it appears under Events."
        />
        <ManualRow
          title="Tools / Note Taker"
          to="/note-taker"
          body="Record meetings with Chrome speech, keep a raw transcript, and file notes onto event campfires as reusable logs."
        />
        <ManualRow
          title="Attendance & whereabouts"
          to="/attendance"
          body="Daily check-in for operators; map and return pings for students who leave the room."
        />
        <ManualRow
          title="My settings"
          to="/settings"
          body="Profile, notification preferences, and optional attendance passkey enrollment on your own device."
        />
      </dl>
    </article>
  )
}

function ManualRow({
  title,
  to,
  body,
}: {
  title: string
  to: string
  body: string
}) {
  return (
    <div className="border-t border-border-divider pt-3 first:border-t-0 first:pt-0">
      <dt>
        <Link
          to={to}
          className="font-medium text-accent-ink underline-offset-2 hover:underline"
        >
          {title}
        </Link>
      </dt>
      <dd className="mt-1">{body}</dd>
    </div>
  )
}
