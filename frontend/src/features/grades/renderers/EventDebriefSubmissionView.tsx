import type { EventDebriefSubmissionContent } from '../types'

function Stars({
  rating,
  max = 5,
}: {
  rating: number | null
  max?: number
}) {
  if (rating === null) {
    return <span className="text-sm text-slate-500">N/A</span>
  }
  const full = Math.round(rating)
  return (
    <span
      className="inline-flex items-center gap-2 text-sm text-slate-800"
      aria-label={`${rating} out of ${max}`}
    >
      <span aria-hidden="true" className="tracking-tight text-amber-600">
        {'★'.repeat(Math.max(0, full))}
        {'☆'.repeat(Math.max(0, max - full))}
      </span>
      <span className="tabular-nums">
        {rating} / {max}
      </span>
    </span>
  )
}

export function EventDebriefSubmissionView({
  data,
}: {
  data: EventDebriefSubmissionContent
}) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-base font-semibold text-slate-900">
          Overall Event Rating
        </h3>
        <div className="mt-2">
          <Stars
            rating={data.overallRating}
            max={data.overallMaxRating ?? 5}
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-900">
          Committee Helpfulness
        </h3>
        <ul className="mt-2 space-y-2">
          {data.committeeRatings.map((item) => (
            <li
              key={item.committeeId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
            >
              <span className="text-slate-800">{item.committeeName}</span>
              <Stars rating={item.rating} max={item.maxRating ?? 5} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-900">
          Three Things Our Station Did Well
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
          {data.strengths.map((item, index) => (
            <li key={`strength-${index}`}>{item}</li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-900">
          Three Improvements for Next Year
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
          {data.improvements.map((item, index) => (
            <li key={`improvement-${index}`}>{item}</li>
          ))}
        </ol>
      </section>

      {data.materialRequests.length > 0 ? (
        <section>
          <h3 className="text-base font-semibold text-slate-900">
            Material Requests
          </h3>
          <ul className="mt-2 space-y-3">
            {data.materialRequests.map((item) => (
              <li
                key={item.id}
                className="rounded border border-slate-200 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {item.name}
                  {typeof item.quantity === 'number'
                    ? ` · Qty ${item.quantity}`
                    : ''}
                </p>
                {item.reason ? (
                  <p className="mt-1 text-slate-600">
                    <span className="font-medium text-slate-700">Reason:</span>{' '}
                    {item.reason}
                  </p>
                ) : null}
                {item.purchasingUrl ? (
                  <p className="mt-1">
                    <a
                      href={item.purchasingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sky-700 underline hover:text-sky-800"
                    >
                      Open purchasing link
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.hasAnonymousConcern ? (
        <section>
          <h3 className="text-base font-semibold text-slate-900">
            Anonymous Concern
          </h3>
          {data.anonymousConcernVisibleText ? (
            <p className="mt-2 text-sm text-slate-800">
              {data.anonymousConcernVisibleText}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              An anonymous concern was submitted. Author-identifying details are
              never shown here.
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}
