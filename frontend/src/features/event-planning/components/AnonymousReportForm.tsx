import { useRef, useState } from 'react'
import type {
  PlanningReportAttachment,
  PlanningReportCategory,
} from '../types'
import {
  usePlanningCommands,
  usePlanningDirectory,
} from '../hooks/useEventPlanning'
import { reportCategoryLabel } from '../lib/rag'
import {
  MAX_REPORT_ATTACHMENTS,
  REPORT_ATTACHMENT_ACCEPT,
  filesToReportAttachments,
  formatAttachmentSize,
} from '../lib/reportAttachments'

const CATEGORIES: PlanningReportCategory[] = [
  'inefficiency',
  'disruptive',
  'not_completing_on_time',
  'not_doing_work',
  'other',
]

export function AnonymousReportForm({ planId }: { planId: string }) {
  const { members } = usePlanningDirectory()
  const { submitReport } = usePlanningCommands(planId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [subjectMemberId, setSubjectMemberId] = useState('')
  const [category, setCategory] =
    useState<PlanningReportCategory>('inefficiency')
  const [details, setDetails] = useState('')
  const [attachments, setAttachments] = useState<PlanningReportAttachment[]>(
    [],
  )
  const [attachError, setAttachError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const onFilesSelected = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setAttachError(null)
    const remaining = MAX_REPORT_ATTACHMENTS - attachments.length
    if (remaining <= 0) {
      setAttachError(`You can attach up to ${MAX_REPORT_ATTACHMENTS} files.`)
      return
    }
    try {
      const next = await filesToReportAttachments(
        Array.from(fileList).slice(0, remaining),
        attachments.length,
      )
      setAttachments((current) => [...current, ...next])
    } catch (error) {
      setAttachError(
        error instanceof Error ? error.message : 'Could not add files',
      )
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await submitReport.mutateAsync({
      id: planId,
      input: {
        subjectMemberId,
        category,
        details,
        attachments,
      },
    })
    setDetails('')
    setAttachments([])
    setAttachError(null)
    setSent(true)
  }

  return (
    <section
      aria-labelledby="anonymous-report-heading"
      className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
    >
      <h2
        id="anonymous-report-heading"
        className="text-sm font-semibold text-ink"
      >
        Anonymous project report
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Report a project member confidentially. Your identity is never attached
        to the report — not even for AC review. Original file names are not
        saved.
      </p>

      <form className="mt-3 space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <label
            htmlFor="report-subject"
            className="text-xs font-medium text-ink-muted"
          >
            Member
          </label>
          <select
            id="report-subject"
            required
            value={subjectMemberId}
            onChange={(event) => setSubjectMemberId(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">Select a member…</option>
            {(members.data ?? []).map((member: { id: string; name: string; committeeName?: string | null }) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.committeeName ? ` · ${member.committeeName}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="report-category"
            className="text-xs font-medium text-ink-muted"
          >
            Concern
          </label>
          <select
            id="report-category"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as PlanningReportCategory)
            }
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {reportCategoryLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="report-details"
            className="text-xs font-medium text-ink-muted"
          >
            Details
          </label>
          <textarea
            id="report-details"
            required
            rows={4}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            placeholder="Describe what is happening on this project…"
          />
        </div>

        <div>
          <label
            htmlFor="report-attachments"
            className="text-xs font-medium text-ink-muted"
          >
            Files / screenshots
          </label>
          <p className="mt-0.5 text-[11px] text-ink-subtle">
            Optional. PNG, JPEG, WebP, GIF, or PDF · up to{' '}
            {MAX_REPORT_ATTACHMENTS} files · 5 MB each
          </p>
          <input
            ref={fileInputRef}
            id="report-attachments"
            type="file"
            accept={REPORT_ATTACHMENT_ACCEPT}
            multiple
            data-testid="report-attachments-input"
            onChange={(event) => void onFilesSelected(event.target.files)}
            className="mt-1 block w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-border-subtle"
          />

          {attachments.length > 0 ? (
            <ul
              className="mt-2 space-y-2"
              aria-label="Selected attachments"
            >
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-control border border-border-subtle bg-surface-sunken px-2 py-2"
                >
                  {attachment.mimeType.startsWith('image/') ? (
                    <img
                      src={attachment.dataUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded bg-surface text-[11px] font-medium text-ink-muted">
                      PDF
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {attachment.displayName}
                    </p>
                    <p className="text-[11px] text-ink-subtle">
                      {formatAttachmentSize(attachment.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="text-xs font-medium text-status-danger hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {attachError ? (
            <p className="mt-1 text-sm text-status-danger" role="alert">
              {attachError}
            </p>
          ) : null}
        </div>

        {submitReport.isError ? (
          <p className="text-sm text-status-danger" role="alert">
            {submitReport.error instanceof Error
              ? submitReport.error.message
              : 'Could not send report'}
          </p>
        ) : null}
        {sent && submitReport.isSuccess ? (
          <p className="text-sm text-accent-ink" role="status">
            Report submitted anonymously.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitReport.isPending}
          className="rounded-control bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
        >
          Submit anonymous report
        </button>
      </form>
    </section>
  )
}
