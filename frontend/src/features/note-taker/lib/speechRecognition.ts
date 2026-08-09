/**
 * Chrome / Chromium Web Speech API wrappers.
 *
 * The browser does the speech-to-text. We only accumulate final results into a
 * transcript the backend can turn into a meeting note. Audio is still recorded
 * separately with MediaRecorder so the original recording is kept.
 */

export type SpeechSegment = {
  startMs: number
  endMs: number
  text: string
}

export type SpeechCapture = {
  fullText: string
  segments: SpeechSegment[]
  language: string | null
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

/** Errors where an immediate restart would fail identically. */
const FATAL_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'network',
])

function speechConstructor(): SpeechRecognitionConstructor | null {
  const win = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return speechConstructor() !== null
}

/**
 * Starts continuous recognition. Returns a stop handle that resolves to the
 * final transcript once the recognition session ends.
 */
export function startSpeechCapture(options?: {
  language?: string
  onInterim?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (message: string) => void
}): {
  stop: () => Promise<SpeechCapture>
  abort: () => void
} {
  const Constructor = speechConstructor()
  if (!Constructor) {
    throw new Error(
      'Chrome voice recognition is not available in this browser. Use Chrome or Edge.',
    )
  }

  const recognition = new Constructor()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = options?.language ?? 'en-US'
  recognition.maxAlternatives = 1

  const startedAt = Date.now()
  const segments: SpeechSegment[] = []
  let finals: string[] = []
  let interim = ''
  let stopping = false
  let fatal = false
  let resolveStop: ((capture: SpeechCapture) => void) | null = null

  const snapshot = (): SpeechCapture => {
    const fullText = [...finals, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    return {
      fullText,
      segments: segments.map((segment) => ({ ...segment })),
      language: recognition.lang || null,
    }
  }

  recognition.onresult = (event) => {
    let nextInterim = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const text = result[0]?.transcript?.trim()
      if (!text) continue
      if (result.isFinal) {
        const endMs = Date.now() - startedAt
        const startMs =
          segments.length > 0 ? segments[segments.length - 1].endMs : Math.max(0, endMs - 1500)
        segments.push({ startMs, endMs, text })
        finals = [...finals, text]
        options?.onFinal?.(finals.join(' '))
      } else {
        nextInterim = `${nextInterim} ${text}`.trim()
      }
    }
    interim = nextInterim
    options?.onInterim?.([...finals, interim].filter(Boolean).join(' '))
  }

  recognition.onerror = (event) => {
    // `no-speech` and `aborted` are expected when a quiet room ends recording.
    if (event.error === 'aborted' || event.error === 'no-speech') return
    // Restarting after these would spin: the next attempt fails the same way.
    if (FATAL_ERRORS.has(event.error)) fatal = true
    options?.onError?.(
      event.error === 'not-allowed'
        ? 'Microphone permission is required for Chrome voice recognition.'
        : `Voice recognition error: ${event.error}`,
    )
  }

  recognition.onend = () => {
    // Chrome stops after silence; keep going until the user presses Stop.
    if (!stopping && !fatal) {
      try {
        recognition.start()
      } catch {
        // Already started, or the page is tearing down.
      }
      return
    }
    resolveStop?.(snapshot())
    resolveStop = null
  }

  recognition.start()

  return {
    stop: () =>
      new Promise((resolve) => {
        stopping = true
        resolveStop = resolve
        try {
          recognition.stop()
        } catch {
          resolve(snapshot())
        }
        // If onend never fires, still return what we have.
        window.setTimeout(() => {
          if (resolveStop) {
            resolveStop(snapshot())
            resolveStop = null
          }
        }, 1500)
      }),
    abort: () => {
      stopping = true
      try {
        recognition.abort()
      } catch {
        // ignore
      }
    },
  }
}
