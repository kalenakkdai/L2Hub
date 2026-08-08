import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import { Field } from './primitives'
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
 * Avatar picker.
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
    <Field label="Avatar" htmlFor="avatar" hint="PNG, JPEG, WebP, or GIF, up to 2 MB.">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-100 text-[13px] font-semibold text-accent-ink"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            fallback.slice(0, 1).toUpperCase()
          )}
        </span>

        <input
          ref={input}
          id="avatar"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => void choose(event.target.files?.[0])}
        />

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

      {error && (
        <p role="alert" className="mt-1.5 text-sm text-status-danger">
          {error}
        </p>
      )}
    </Field>
  )
}
