import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  ACCEPTED_TYPES,
  AvatarUploadError,
  removeAvatar,
  uploadAvatar,
} from '../../lib/avatars'

type AvatarFieldProps = {
  avatarUrl: string | null
  /** Fallback initial when there is no image. */
  fallback: string
  onChange: (url: string | null) => void
}

/**
 * Avatar picker, for the settings sidebar.
 *
 * Sits beside the section list rather than inside the Profile card, where it
 * was one 40px circle among a grid of text inputs. A picture of a person is
 * not a form field, and at that size it was too small to tell whether the
 * thing you just uploaded was the thing you meant to upload.
 *
 * Uploads before saving the profile, so the column only ever points at an
 * object that exists. A failed upload leaves the previous avatar alone.
 */
export function AvatarField({ avatarUrl, fallback, onChange }: AvatarFieldProps) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)

    try {
      onChange(await uploadAvatar(file))
    } catch (caught) {
      setError(
        caught instanceof AvatarUploadError
          ? caught.message
          : 'The upload did not go through. Try again.',
      )
    } finally {
      setBusy(false)
      // Let the same file be chosen again after a failure.
      if (input.current) input.current.value = ''
    }
  }

  const clear = async () => {
    setBusy(true)
    setError(null)
    try {
      await removeAvatar(avatarUrl)
      onChange(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-3">
      <span
        aria-hidden="true"
        className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-accent-100 text-4xl font-semibold text-accent-ink"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          fallback.slice(0, 1).toUpperCase()
        )}
      </span>

      {/* The visible control is the button; the input stays reachable by name
          for assistive tech rather than being labelled only by the button. */}
      <label htmlFor="avatar" className="sr-only">
        Avatar
      </label>
      <input
        ref={input}
        id="avatar"
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={(event) => void choose(event.target.files?.[0])}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {busy ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload'}
        </Button>

        {avatarUrl && !busy && (
          <Button variant="ghost" size="sm" onClick={() => void clear()}>
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <p className="mt-2 text-[12px] text-ink-subtle">PNG, JPEG, WebP, or GIF, up to 2 MB.</p>

      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
}
