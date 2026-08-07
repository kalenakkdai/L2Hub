import type { ReflectionSubmissionContent } from '../types'

export function ReflectionSubmissionView({
  data,
}: {
  data: ReflectionSubmissionContent
}) {
  return (
    <div className="space-y-3">
      {data.prompt ? (
        <p className="text-sm font-medium text-slate-700">{data.prompt}</p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm text-slate-800">{data.body}</p>
    </div>
  )
}
