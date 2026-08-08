import { supabase } from './supabase'

/**
 * Avatar uploads, straight from the browser to Supabase Storage.
 *
 * Not routed through FastAPI: apiFetch only speaks JSON, and the backend's
 * ObjectStorage abstraction writes to local disk, which cannot serve a URL
 * that survives a restart. Storage policies do the authorisation — an object
 * is keyed "<user-id>/…" and a camper may only write inside their own folder.
 */

export const AVATAR_BUCKET = 'avatars'

/** Matches the bucket's allowed_mime_types. */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** Matches the bucket's file_size_limit. */
export const MAX_BYTES = 2 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export type AvatarError =
  | 'unsupported_type'
  | 'too_large'
  | 'not_signed_in'
  | 'upload_failed'

export const AVATAR_ERRORS: Record<AvatarError, string> = {
  unsupported_type: 'Choose a PNG, JPEG, WebP, or GIF.',
  too_large: 'That image is over 2 MB. Choose a smaller one.',
  not_signed_in: 'You are not signed in.',
  upload_failed: 'The upload did not go through. Try again.',
}

export class AvatarUploadError extends Error {
  readonly reason: AvatarError

  constructor(reason: AvatarError) {
    super(AVATAR_ERRORS[reason])
    this.name = 'AvatarUploadError'
    this.reason = reason
  }
}

/**
 * Checks a file before it leaves the browser.
 *
 * The bucket enforces both rules too, and that is what actually protects the
 * project. This exists so a camper learns their photo is too big without
 * waiting for a 2 MB round trip to fail.
 */
export function validateAvatar(file: File): AvatarError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'unsupported_type'
  if (file.size > MAX_BYTES) return 'too_large'
  return null
}

/**
 * Uploads and returns the public URL.
 *
 * The object key is stable per camper, so replacing an avatar overwrites
 * rather than accumulating orphans. A cache-busting query is appended to the
 * returned URL because the path never changes.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const problem = validateAvatar(file)
  if (problem) throw new AvatarUploadError(problem)

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new AvatarUploadError('not_signed_in')

  const path = `${userId}/avatar.${EXTENSIONS[file.type] ?? 'png'}`

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new AvatarUploadError('upload_failed')

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

/** Removes the stored object. The profile column is cleared by the caller. */
export async function removeAvatar(currentUrl: string | null): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId || !currentUrl) return

  // Recover the key from the public URL rather than guessing the extension.
  const match = /\/avatars\/(.+?)(\?|$)/.exec(currentUrl)
  const path = match?.[1] ?? `${userId}/avatar.png`

  await supabase.storage.from(AVATAR_BUCKET).remove([path])
}
