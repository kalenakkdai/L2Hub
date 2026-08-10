import { useMutation, useQuery } from '@tanstack/react-query'
import { Camera, CheckCircle2 } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchPhotoPermissionOptions,
  fetchPublicPhotoEvents,
  submitPhotographerDrop,
  type PublicPhotoEvent,
} from './api'

const FIELD =
  'mt-1 w-full rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-600 focus:ring-[3px] focus:ring-accent-600/13'

const LABEL = 'block text-sm font-medium text-ink'

/**
 * Public photo drop for event photographers — no login.
 *
 * Share `/photographer` (or the link on the sign-in page). Photographers pick
 * an event, say how to credit them on Instagram, choose Instagram / Yearbook /
 * Other permissions, then paste a Drive link and/or upload files.
 */
export function PhotographerUploadPage() {
  const eventsQuery = useQuery({
    queryKey: ['public', 'photographer', 'events'],
    queryFn: fetchPublicPhotoEvents,
  })
  const optionsQuery = useQuery({
    queryKey: ['public', 'photographer', 'options'],
    queryFn: fetchPhotoPermissionOptions,
  })

  const [eventId, setEventId] = useState('')
  const [photographerName, setPhotographerName] = useState('')
  const [creditName, setCreditName] = useState('')
  const [socialMediaUrl, setSocialMediaUrl] = useState('')
  const [permission, setPermission] = useState('instagram')
  const [driveUrl, setDriveUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = useMutation({
    mutationFn: submitPhotographerDrop,
  })

  const events = eventsQuery.data?.events ?? []
  const grouped = useMemo(() => groupEvents(events), [events])
  const permissions = optionsQuery.data?.permissions ?? []

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!eventId) {
      setFormError('Select which event these photos are for.')
      return
    }
    if (!creditName.trim()) {
      setFormError('Tell us how you want to be credited on Instagram.')
      return
    }
    if (!socialMediaUrl.trim()) {
      setFormError('Add your social media link so we can credit you correctly.')
      return
    }
    if (!driveUrl.trim() && !file) {
      setFormError('Paste a Google Drive link or choose a file to upload.')
      return
    }

    submit.mutate({
      eventId,
      creditName: creditName.trim(),
      socialMediaUrl: socialMediaUrl.trim(),
      permission,
      photographerName: photographerName.trim(),
      driveUrl: driveUrl.trim(),
      notes: notes.trim(),
      file,
    })
  }

  if (submit.isSuccess) {
    const receipt = submit.data
    return (
      <PublicShell>
        <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-xs">
          <CheckCircle2
            className="size-8 text-emerald-600"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-2xl font-semibold text-ink">Photos received</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Thanks
            {receipt.creditName ? (
              <>
                {' '}
                — we&apos;ll credit you as{' '}
                <strong className="text-ink">{receipt.creditName}</strong>
              </>
            ) : null}
            {receipt.eventName ? (
              <>
                {' '}
                for <strong className="text-ink">{receipt.eventName}</strong>
              </>
            ) : null}
            . Leadership will pull from your Drive link
            {receipt.hasFile ? ' and the file you uploaded' : ''} when they post.
          </p>
          <button
            type="button"
            className="mt-5 rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700"
            onClick={() => {
              submit.reset()
              setDriveUrl('')
              setFile(null)
              setNotes('')
            }}
          >
            Send another drop
          </button>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <header className="mb-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          <Camera className="size-3.5" aria-hidden="true" />
          Photographer drop
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Share event photos
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          No login needed. Pick the event, tell us how to credit you on
          Instagram, choose whether photos may go to Instagram, Yearbook, or
          other Leadership use, then paste a Google Drive link and/or upload
          files.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-card border border-border-subtle bg-surface p-5 shadow-xs sm:p-6"
        noValidate
      >
        <label className={LABEL}>
          Event
          <select
            className={FIELD}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
            disabled={eventsQuery.isPending}
          >
            <option value="">
              {eventsQuery.isPending ? 'Loading events…' : 'Select an event'}
            </option>
            {grouped.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.year})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className={LABEL}>
          Usage permission
          <select
            className={FIELD}
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            required
          >
            {(permissions.length
              ? permissions
              : [
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'yearbook', label: 'Yearbook' },
                  {
                    value: 'instagram_and_yearbook',
                    label: 'Instagram and Yearbook',
                  },
                  { value: 'other', label: 'Other' },
                ]
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-subtle">
            Where Leadership may use these photos.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Your name (optional)
            <input
              className={FIELD}
              value={photographerName}
              onChange={(e) => setPhotographerName(e.target.value)}
              autoComplete="name"
              placeholder="Avery Chen"
            />
          </label>
          <label className={LABEL}>
            How to credit you on Instagram
            <input
              className={FIELD}
              value={creditName}
              onChange={(e) => setCreditName(e.target.value)}
              required
              placeholder="@your.handle · Avery Chen"
            />
          </label>
        </div>

        <label className={LABEL}>
          Social media link
          <input
            className={FIELD}
            type="url"
            value={socialMediaUrl}
            onChange={(e) => setSocialMediaUrl(e.target.value)}
            required
            placeholder="https://instagram.com/your.handle"
          />
          <span className="mt-1 block text-xs text-ink-subtle">
            Instagram, portfolio, or the profile you want tagged in posts.
          </span>
        </label>

        <label className={LABEL}>
          Google Drive link
          <input
            className={FIELD}
            type="url"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
          />
          <span className="mt-1 block text-xs text-ink-subtle">
            Share the folder with view access (or “anyone with the link”).
          </span>
        </label>

        <label className={LABEL}>
          Or upload a file
          <input
            className={`${FIELD} file:mr-3 file:rounded-control file:border-0 file:bg-surface-sunken file:px-2 file:py-1 file:text-xs`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,application/zip,.zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="mt-1 block text-xs text-ink-subtle">
            JPEG, PNG, WebP, HEIC, PDF, or ZIP · 40 MB max. You can send both a
            Drive link and a file.
          </span>
        </label>

        <label className={LABEL}>
          Notes for Leadership (optional)
          <textarea
            className={FIELD}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Favorite shots are in the Selects folder…"
          />
        </label>

        {(formError || submit.isError) && (
          <p className="text-sm text-status-danger" role="alert">
            {formError ??
              (submit.error instanceof Error
                ? submit.error.message
                : 'Could not send your drop.')}
          </p>
        )}

        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded-control bg-accent-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
        >
          {submit.isPending ? 'Sending…' : 'Send photos'}
        </button>
      </form>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-surface-sunken px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            to="/login"
            className="text-sm font-semibold tracking-tight text-ink"
          >
            L2 Hub
          </Link>
          <Link to="/login" className="text-xs text-ink-muted underline">
            Leadership sign in
          </Link>
        </div>
        {children}
      </div>
    </main>
  )
}

function groupEvents(events: PublicPhotoEvent[]) {
  const byYear = new Map<number, PublicPhotoEvent[]>()
  for (const event of events) {
    const list = byYear.get(event.year) ?? []
    list.push(event)
    byYear.set(event.year, list)
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      label: String(year),
      events: items,
    }))
}
