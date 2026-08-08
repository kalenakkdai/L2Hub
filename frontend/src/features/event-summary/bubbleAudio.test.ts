import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closeBubbleAudio,
  isBubbleAudioSupported,
  playBubblePops,
  popPitch,
  unlockBubbleAudio,
} from './bubbleAudio'

afterEach(() => {
  closeBubbleAudio()
  vi.unstubAllGlobals()
})

describe('popPitch', () => {
  it('is deterministic for a given position in the wave', () => {
    expect(popPitch(7)).toBe(popPitch(7))
  })

  it('never repeats the pitch of the bubble before it', () => {
    for (let index = 1; index < 60; index += 1) {
      expect(popPitch(index)).not.toBe(popPitch(index - 1))
    }
  })

  it('stays within a musical range around the base pitch', () => {
    for (let index = 0; index < 60; index += 1) {
      expect(popPitch(index)).toBeGreaterThanOrEqual(0.8);
      expect(popPitch(index)).toBeLessThanOrEqual(1.35)
    }
  })
})

describe('when the browser has no Web Audio support', () => {
  it('reports itself unsupported instead of throwing', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(isBubbleAudioSupported()).toBe(false)
  })

  it('fails to unlock rather than rejecting', async () => {
    vi.stubGlobal('AudioContext', undefined)
    await expect(unlockBubbleAudio()).resolves.toBe(false)
  })

  it('stays silent instead of scheduling pops', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(playBubblePops(12)).toBe(0)
  })
})

describe('when the browser blocks playback', () => {
  it('reports the failed unlock so the UI can say so', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'suspended'
        // A blocked context stays suspended even after resume resolves.
        resume = () => Promise.resolve()
      },
    )

    await expect(unlockBubbleAudio()).resolves.toBe(false)
    expect(playBubblePops(5)).toBe(0)
  })
})

/** Records every note the module schedules so the wave can be inspected. */
function fakeAudioContext() {
  const starts: number[] = []
  const frequencies: number[] = []

  const param = (log?: number[]) => ({
    setValueAtTime: (value: number) => log?.push(value),
    exponentialRampToValueAtTime: () => undefined,
  })

  const node = () => {
    const self: Record<string, unknown> = {
      connect: (target: unknown) => target,
      start: (when: number) => starts.push(when),
      stop: () => undefined,
      gain: param(),
      frequency: param(frequencies),
      Q: param(),
      buffer: null,
      type: '',
    }
    return self
  }

  return {
    starts,
    frequencies,
    context: {
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
      destination: {},
      resume: () => Promise.resolve(),
      close: () => Promise.resolve(),
      createOscillator: node,
      createGain: node,
      createBufferSource: node,
      createBiquadFilter: node,
      createBuffer: (_channels: number, frames: number) => ({
        getChannelData: () => new Float32Array(frames),
      }),
    },
  }
}

describe('playBubblePops', () => {
  async function unlockWith(fake: ReturnType<typeof fakeAudioContext>) {
    vi.stubGlobal(
      'AudioContext',
      function AudioContextStub() {
        return fake.context
      },
    )
    await unlockBubbleAudio()
  }

  it('schedules one pop per bubble, spaced evenly', async () => {
    const fake = fakeAudioContext()
    await unlockWith(fake)

    expect(playBubblePops(4, { stagger: 0.1 })).toBe(4)

    // Two voices per pop — the pitch sweep and the click — so eight starts.
    expect(fake.starts).toHaveLength(8)
    const popTimes = [...new Set(fake.starts)].sort((a, b) => a - b)
    expect(popTimes).toHaveLength(4)
    popTimes.forEach((time, index) => {
      if (index === 0) return
      expect(time - popTimes[index - 1]).toBeCloseTo(0.1, 5)
    })
  })

  it('gives each bubble its own pitch', async () => {
    const fake = fakeAudioContext()
    await unlockWith(fake)
    playBubblePops(3)

    // The sweep start frequency of each pop, taken in scheduling order.
    const sweeps = fake.frequencies.filter((value) => value > 500 && value < 1100)
    expect(new Set(sweeps).size).toBe(3)
  })

  it('caps a wave so a large roster does not become a machine gun', async () => {
    const fake = fakeAudioContext()
    await unlockWith(fake)

    expect(playBubblePops(400)).toBe(60)
  })

  it('stays silent for an empty roster', async () => {
    const fake = fakeAudioContext()
    await unlockWith(fake)

    expect(playBubblePops(0)).toBe(0)
    expect(fake.starts).toHaveLength(0)
  })
})
