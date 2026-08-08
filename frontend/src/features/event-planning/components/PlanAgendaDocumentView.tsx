import type { PlanAgendaDocument as AgendaDoc } from '../types'

/**
 * Renders the auto-generated meeting agenda in the Winter Ball document layout:
 * school header, school year, titled agenda date, Goals, then Roman sections.
 */
export function PlanAgendaDocumentView({ agenda }: { agenda: AgendaDoc }) {
  return (
    <article
      aria-label="Plan agenda"
      className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs"
    >
      <header className="border-b border-border-subtle pb-3 text-center">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          {agenda.schoolName}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{agenda.schoolYear} School Year</p>
        <h2 className="mt-3 text-base font-semibold text-ink">{agenda.title}</h2>
        <p className="mt-1 text-[11px] text-ink-subtle">
          Draft from {agenda.templateSource}
        </p>
      </header>

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-ink">Goals</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {agenda.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </section>

      <div className="mt-5 space-y-5">
        {agenda.sections.map((section) => (
          <section key={section.roman} aria-label={`${section.roman}. ${section.title}`}>
            <h3 className="text-sm font-semibold text-ink">
              {section.roman}. {section.title}
            </h3>
            <ol className="mt-2 space-y-2 text-sm text-ink-muted">
              {section.items.map((item) => (
                <li key={`${section.roman}-${item.letter ?? item.text}`}>
                  <p>
                    {item.letter ? (
                      <span className="font-medium text-ink">{item.letter}. </span>
                    ) : null}
                    {item.text}
                  </p>
                  {item.subItems?.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-subtle">
                      {item.subItems.map((sub) => (
                        <li key={sub}>{sub}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </article>
  )
}
