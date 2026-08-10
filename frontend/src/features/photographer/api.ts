const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export type PublicPhotoEvent = {
  id: string
  name: string
  slug: string
  year: number
  status: string
  startsAt: string | null
}

export type PhotoPermissionOption = {
  value: string
  label: string
}

export type PhotoSubmissionReceipt = {
  id: string
  eventId: string
  eventName: string | null
  creditName: string
  permission: string
  hasDriveLink: boolean
  hasFile: boolean
  createdAt: string | null
}

async function publicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // keep status message
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export function fetchPublicPhotoEvents() {
  return publicJson<{ events: PublicPhotoEvent[] }>('/public/photographer/events')
}

export function fetchPhotoPermissionOptions() {
  return publicJson<{ permissions: PhotoPermissionOption[] }>(
    '/public/photographer/options',
  )
}

export type PhotoSubmissionInput = {
  eventId: string
  creditName: string
  socialMediaUrl: string
  permission: string
  photographerName?: string
  driveUrl?: string
  notes?: string
  file?: File | null
}

export async function submitPhotographerDrop(
  input: PhotoSubmissionInput,
): Promise<PhotoSubmissionReceipt> {
  const form = new FormData()
  form.set('eventId', input.eventId)
  form.set('creditName', input.creditName)
  form.set('socialMediaUrl', input.socialMediaUrl)
  form.set('permission', input.permission)
  form.set('photographerName', input.photographerName ?? '')
  form.set('driveUrl', input.driveUrl ?? '')
  form.set('notes', input.notes ?? '')
  if (input.file) form.set('file', input.file)

  const body = await publicJson<{ submission: PhotoSubmissionReceipt }>(
    '/public/photographer/submissions',
    { method: 'POST', body: form },
  )
  return body.submission
}
