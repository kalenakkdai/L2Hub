import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Mic, Square } from 'lucide-react'
import { ErrorState } from '../../../components/ui/ErrorState'
import { fetchEvents } from '../../event-summary/api'
import { getSuggestedMeetingTitle } from '../api/client'
import { useNoteTakerCommands } from '../hooks/useNoteTaker'
import {
  eventOptionGroups,
  eventTimelinePath,
  findEventLabel,
} from '../lib/eventOptions'
import {
  isSpeechRecognitionSupported,
  startSpeechCapture,
  type SpeechCapture,
} from '../lib/speechRecognition'

type OutletContext = { canRecord: boolean }

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function NoteTakerNewPage() {
  const { canRecord } = useOutletContext<OutletContext>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const linkedEventId = searchParams.get('eventId')
  const linkedEventName = searchParams.get('eventName')
  const { createSession, uploadAudio } = useNoteTakerCommands()

  // A campfire link preselects its event; otherwise the picker starts empty.
  const [eventId, setEventId] = useState<string | null>(linkedEventId)

  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents })
  const now = useMemo(() => new Date(), [])
  const optionGroups = useMemo(
    () => eventOptionGroups(eventsQuery.data?.events ?? [], now),
    [eventsQuery.data, now],
  )
  const selectedEventLabel = findEventLabel(
    optionGroups,
    eventId,
    linkedEventName,
  )
  const listedEventIds = useMemo(
    () =>
      new Set(
        optionGroups.flatMap((group) => group.options.map((option) => option.id)),
      ),
    [optionGroups],
  )

  // The server owns naming, so the placeholder shows exactly what an empty
  // title would produce rather than a guess made in the browser.
  const suggestedTitleQuery = useQuery({
    queryKey: ['note-taker', 'suggested-title', eventId],
    queryFn: () => getSuggestedMeetingTitle(eventId),
  })
  const suggestedTitle = suggestedTitleQuery.data?.title ?? ''

  const [title, setTitle] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const speechStopRef = useRef<(() => Promise<SpeechCapture>) | null>(null)
  const speechAbortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      speechAbortRef.current?.()
    }
  }, [])

  if (!canRecord) {
    return (
      <ErrorState
        variant="unauthorized"
        title="Cannot record"
        description="You need note_taker.record to capture a meeting."
      />
    )
  }

  if (!isSpeechRecognitionSupported()) {
    return (
      <ErrorState
        variant="error"
        title="Chrome voice recognition required"
        description="Open L2 Hub in Google Chrome or Microsoft Edge to record meetings. Safari and Firefox do not expose the Web Speech API used here."
      />
    )
  }

  async function startRecording() {
    setMicError(null)
    setSubmitError(null)
    setLiveTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start(250)
      mediaRecorderRef.current = recorder

      const capture = startSpeechCapture({
        onInterim: setLiveTranscript,
        onFinal: setLiveTranscript,
        onError: setMicError,
      })
      speechStopRef.current = capture.stop
      speechAbortRef.current = capture.abort

      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setRecording(true)
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current)
      }, 200)
    } catch {
      speechAbortRef.current?.()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      setMicError('Microphone access is required to record a meeting.')
    }
  }

  async function stopAndUpload() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    setBusy(true)
    setSubmitError(null)

    const speechStop = speechStopRef.current
    const speechPromise = speechStop ? speechStop() : Promise.resolve<SpeechCapture>({
      fullText: '',
      segments: [],
      language: 'en-US',
    })

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          }),
        )
      }
      recorder.stop()
    })

    const speech = await speechPromise

    if (timerRef.current) window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    speechStopRef.current = null
    speechAbortRef.current = null
    setRecording(false)

    const durationMs = startedAtRef.current
      ? Date.now() - startedAtRef.current
      : elapsedMs

    if (!speech.fullText.trim()) {
      setSubmitError(
        'No speech was recognized. Check the mic, speak clearly, and try again in Chrome.',
      )
      setBusy(false)
      return
    }

    try {
      const session = await createSession.mutateAsync({
        title: title.trim() || undefined,
        eventId,
      })
      await uploadAudio.mutateAsync({
        sessionId: session.id,
        blob,
        durationMs,
        transcript: speech,
      })
      navigate(`/note-taker/${session.id}`)
    } catch {
      setSubmitError('Could not upload the recording. Is the backend running?')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-5 border-b border-border-subtle pb-4">
        <p className="text-xs font-semibold text-ink-subtle">
          <Link to="/note-taker" className="hover:text-ink">
            Note Taker
          </Link>
          {' / '}
          New
        </p>
        <h1 className="mt-1 text-display font-semibold text-ink">Record a meeting</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Chrome turns speech into text live. When you stop, we save the original
          audio, the transcript, and a drafted meeting note.
        </p>
        {selectedEventLabel ? (
          <p className="mt-2 text-xs font-medium text-status-info">
            Filing under {selectedEventLabel}
          </p>
        ) : null}
      </header>

      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-xs font-medium text-ink-muted" htmlFor="meeting-event">
          Event
        </label>
        {eventId ? (
          <Link
            to={eventTimelinePath(eventId)}
            className="text-xs font-medium text-status-info hover:underline"
          >
            Open timeline
          </Link>
        ) : null}
      </div>
      <select
        id="meeting-event"
        value={eventId ?? ''}
        onChange={(event) => setEventId(event.target.value || null)}
        disabled={recording || busy}
        className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink disabled:opacity-60"
      >
        <option value="">No event — general leadership meeting</option>
        {eventId && !listedEventIds.has(eventId) && selectedEventLabel ? (
          <option value={eventId}>{selectedEventLabel}</option>
        ) : null}
        {optionGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-ink-subtle">
        {eventsQuery.isError
          ? 'Could not load events, so this meeting will file without one.'
          : 'The doc files itself onto that event’s campfire timeline.'}
      </p>

      <label className="mt-4 block text-xs font-medium text-ink-muted">
        Meeting title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={recording || busy}
          placeholder={suggestedTitle}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
        />
      </label>
      <p className="mt-1 text-[11px] text-ink-subtle">
        Leave this blank to use the auto-generated name
        {suggestedTitle ? ` (“${suggestedTitle}”)` : ''}. You can rename the doc
        later.
      </p>

      <div className="mt-6 rounded-card border border-border-subtle bg-surface p-6 text-center shadow-xs">
        <p className="font-mono text-3xl font-semibold text-ink">
          {formatElapsed(elapsedMs)}
        </p>
        <p className="mt-1 text-xs text-ink-subtle">
          {recording
            ? 'Listening with Chrome voice recognition…'
            : busy
              ? 'Uploading & drafting notes…'
              : 'Ready'}
        </p>

        <div className="mt-5 flex justify-center gap-3">
          {!recording ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startRecording()}
              className="inline-flex items-center gap-2 rounded-control bg-accent-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
            >
              <Mic size={16} aria-hidden="true" />
              Start recording
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopAndUpload()}
              className="inline-flex items-center gap-2 rounded-control bg-status-danger px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <Square size={16} aria-hidden="true" />
              Stop & generate notes
            </button>
          )}
        </div>

        {liveTranscript ? (
          <div className="mt-5 rounded-control border border-border-subtle bg-surface-muted px-3 py-2 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
              Live transcript
            </p>
            <p className="mt-1 text-sm text-ink">{liveTranscript}</p>
          </div>
        ) : recording ? (
          <p className="mt-4 text-sm text-ink-muted">Speak clearly — words will appear here.</p>
        ) : null}

        {micError ? (
          <p className="mt-4 text-sm text-status-danger">{micError}</p>
        ) : null}
        {submitError ? (
          <p className="mt-4 text-sm text-status-danger">{submitError}</p>
        ) : null}
      </div>
    </div>
  )
}
