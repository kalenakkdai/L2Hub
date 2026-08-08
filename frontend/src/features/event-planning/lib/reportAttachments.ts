import type { PlanningReportAttachment } from '../types'

/** Max attachments per anonymous report. */
export const MAX_REPORT_ATTACHMENTS = 5

/** Max size per file (5 MB) — keeps screenshots practical without huge payloads. */
export const MAX_REPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const REPORT_ATTACHMENT_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf'

const ALLOWED_MIME = new Set(REPORT_ATTACHMENT_ACCEPT.split(','))

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export function isAllowedReportAttachment(file: File): boolean {
  return ALLOWED_MIME.has(file.type) && file.size <= MAX_REPORT_ATTACHMENT_BYTES
}

/**
 * Build a privacy-safe display name. Original filenames are discarded so
 * device/user names in the file name cannot identify the reporter.
 */
export function sanitizeAttachmentDisplayName(
  mimeType: string,
  index: number,
): string {
  const ext = EXT_BY_MIME[mimeType] ?? 'bin'
  const kind = mimeType.startsWith('image/') ? 'screenshot' : 'file'
  return `${kind}-${index + 1}.${ext}`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read file'))
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert selected File objects into redacted report attachments.
 * Rejects disallowed types/sizes and never stores the original filename.
 */
export async function filesToReportAttachments(
  files: File[],
  startingIndex = 0,
): Promise<PlanningReportAttachment[]> {
  const attachments: PlanningReportAttachment[] = []
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    if (!isAllowedReportAttachment(file)) {
      throw new Error(
        `"${file.name}" is not allowed. Use PNG, JPEG, WebP, GIF, or PDF under 5 MB.`,
      )
    }
    const dataUrl = await readFileAsDataUrl(file)
    attachments.push({
      id: `att-${crypto.randomUUID().slice(0, 8)}`,
      displayName: sanitizeAttachmentDisplayName(
        file.type,
        startingIndex + i,
      ),
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl,
    })
  }
  return attachments
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
