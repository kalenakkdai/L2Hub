import type { ComponentType } from 'react'
import type { GradeSubmissionContent } from '../types'
import { EventDebriefSubmissionView } from './EventDebriefSubmissionView'
import { ReflectionSubmissionView } from './ReflectionSubmissionView'
import { GenericSubmissionView } from './GenericSubmissionView'

type RendererMap = {
  event_debrief: ComponentType<{ data: Extract<GradeSubmissionContent, { type: 'event_debrief' }>['data'] }>
  reflection: ComponentType<{ data: Extract<GradeSubmissionContent, { type: 'reflection' }>['data'] }>
  generic: ComponentType<{ data: Extract<GradeSubmissionContent, { type: 'generic' }>['data'] }>
}

export const detailRenderers: RendererMap = {
  event_debrief: EventDebriefSubmissionView,
  reflection: ReflectionSubmissionView,
  generic: GenericSubmissionView,
}

export function SubmissionContentView({
  content,
}: {
  content: GradeSubmissionContent | null
}) {
  if (!content) {
    return (
      <p className="text-sm text-slate-500" role="status">
        No submission content is available.
      </p>
    )
  }

  if (content.type === 'event_debrief') {
    const Renderer = detailRenderers.event_debrief
    return <Renderer data={content.data} />
  }
  if (content.type === 'reflection') {
    const Renderer = detailRenderers.reflection
    return <Renderer data={content.data} />
  }
  const Renderer = detailRenderers.generic
  return <Renderer data={content.data} />
}
