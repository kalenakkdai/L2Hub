import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isSpeechRecognitionSupported,
  startSpeechCapture,
} from './speechRecognition'

type FakeResult = { isFinal: boolean; transcript: string }

class FakeSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  maxAlternatives = 1
  onresult: ((event: {
    resultIndex: number
    results: Array<{ isFinal: boolean; 0: { transcript: string } }>
  }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false

  start() {
    this.started = true
  }

  stop() {
    this.onend?.()
  }

  abort() {
    this.onend?.()
  }

  emit(results: FakeResult[], resultIndex = 0) {
    this.onresult?.({
      resultIndex,
      results: results.map((item) => ({
        isFinal: item.isFinal,
        0: { transcript: item.transcript },
      })),
    })
  }
}

describe('speechRecognition', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'SpeechRecognition')
    Reflect.deleteProperty(window, 'webkitSpeechRecognition')
  })

  it('reports support when webkitSpeechRecognition exists', () => {
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: FakeSpeechRecognition,
    })
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('reports unsupported when neither constructor exists', () => {
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('accumulates final results into a transcript snapshot', async () => {
    const holder: { current: FakeSpeechRecognition | null } = { current: null }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class extends FakeSpeechRecognition {
        constructor() {
          super()
          holder.current = this
        }
      },
    })

    const onInterim = vi.fn()
    const capture = startSpeechCapture({ onInterim })
    expect(holder.current?.started).toBe(true)

    holder.current?.emit([{ isFinal: false, transcript: 'hello there' }])
    expect(onInterim).toHaveBeenCalledWith('hello there')

    holder.current?.emit([{ isFinal: true, transcript: 'Hello there.' }])
    const result = await capture.stop()
    expect(result.fullText).toContain('Hello there.')
    expect(result.segments).toHaveLength(1)
    expect(result.language).toBe('en-US')
  })

  it('restarts after a silence-triggered end but not after a fatal error', () => {
    let instance: FakeSpeechRecognition | null = null
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class extends FakeSpeechRecognition {
        starts = 0
        constructor() {
          super()
          instance = this
        }
        start() {
          this.starts += 1
          super.start()
        }
      },
    })

    const onError = vi.fn()
    startSpeechCapture({ onError })
    const fake = instance as unknown as FakeSpeechRecognition & { starts: number }
    expect(fake.starts).toBe(1)

    // Chrome ends the session after silence: recognition should resume.
    fake.onend?.()
    expect(fake.starts).toBe(2)

    // A denied mic is fatal; restarting would spin forever.
    fake.onerror?.({ error: 'not-allowed' })
    fake.onend?.()
    expect(fake.starts).toBe(2)
    expect(onError).toHaveBeenCalledWith(
      'Microphone permission is required for Chrome voice recognition.',
    )
  })
})
