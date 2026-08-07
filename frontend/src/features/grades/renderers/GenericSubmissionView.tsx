import type { GenericSubmissionContent } from '../types'
import { Check, Circle } from 'lucide-react'

export function GenericSubmissionView({
  data,
}: {
  data: GenericSubmissionContent
}) {
  return (
    <div className="space-y-3">
      {data.title ? (
        <h3 className="text-base font-semibold text-slate-900">{data.title}</h3>
      ) : null}
      {data.body ? (
        <p className="whitespace-pre-wrap text-sm text-slate-800">{data.body}</p>
      ) : null}
      {data.checklist && data.checklist.length > 0 ? (
        <ul className="space-y-1.5">
          {data.checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 text-sm text-slate-800"
            >
              {item.completed ? (
                <Check size={14} className="text-emerald-600" aria-hidden="true" />
              ) : (
                <Circle size={14} className="text-slate-400" aria-hidden="true" />
              )}
              <span>{item.label}</span>
              <span className="sr-only">
                {item.completed ? 'Completed' : 'Not completed'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
