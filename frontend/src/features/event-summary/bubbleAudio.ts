/**
 * Synthesised bubble pops for the live debrief monitor.
 *
 * The sound is generated with the Web Audio API rather than shipped as a file:
 * it keeps the bundle asset-free and lets every bubble pop at its own pitch,
 * which is what stops fifty pops in a row from sounding like a machine gun.
 *
 * Browsers refuse to start audio until the viewer interacts with the page, so
 * nothing here makes noise until `unlockBubbleAudio` is called from a click.
 */

/** Seconds between consecutive pops in a wave. Mirrored by the CSS delay. */
export const POP_STAGGER_SECONDS = 0.06

/** Beyond this a wave stops being an effect and becomes noise. */
const MAX_POPS_PER_WAVE = 60

const POP_DURATION = 0.13
const CLICK_DURATION = 0.045

type AudioContextCtor = typeof AudioContext

let context: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const legacy = (window as { webkitAudioContext?: AudioContextCtor })
    .webkitAudioContext
  return window.AudioContext ?? legacy
}

export function isBubbleAudioSupported(): boolean {
  return Boolean(audioContextCtor())
}

/**
 * Opens (or resumes) the audio context. Must be called from a user gesture —
 * the returned boolean reports whether audio is actually allowed to play, so
 * the UI can stay honest instead of showing a speaker icon that does nothing.
 */
export async function unlockBubbleAudio(): Promise<boolean> {
  const Ctor = audioContextCtor()
  if (!Ctor) return false

  try {
    context ??= new Ctor()
    if (context.state === 'suspended') await context.resume()
    return context.state === 'running'
  } catch {
    return false
  }
}

export function closeBubbleAudio(): void {
  try {
    void context?.close()
  } catch {
    // Closing is best effort: a context that refuses to close is still dropped.
  }
  context = null
  noiseBuffer = null
}

/**
 * Spreads pitches across a wave deterministically, so the same roster always
 * pops the same way and neighbouring bubbles never share a pitch.
 */
export function popPitch(index: number): number {
  return 0.82 + ((index * 37) % 12) / 24
}

/** A short burst of white noise: the wet "click" at the front of a pop. */
function ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer

  const frames = Math.floor(ctx.sampleRate * CLICK_DURATION)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) {
    // Fade the noise out across the buffer so it reads as a click, not a hiss.
    channel[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }

  noiseBuffer = buffer
  return buffer
}

function schedulePop(
  ctx: AudioContext,
  when: number,
  pitch: number,
  volume: number,
) {
  // The body of the pop: a fast downward pitch sweep, the same shape as air
  // escaping a collapsing film.
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(760 * pitch, when)
  osc.frequency.exponentialRampToValueAtTime(150 * pitch, when + 0.085)
  oscGain.gain.setValueAtTime(0.0001, when)
  oscGain.gain.exponentialRampToValueAtTime(volume, when + 0.006)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, when + POP_DURATION)
  osc.connect(oscGain).connect(ctx.destination)
  osc.start(when)
  osc.stop(when + POP_DURATION + 0.02)

  const click = ctx.createBufferSource()
  const clickGain = ctx.createGain()
  const band = ctx.createBiquadFilter()
  click.buffer = ensureNoiseBuffer(ctx)
  band.type = 'bandpass'
  band.frequency.setValueAtTime(1700 * pitch, when)
  band.Q.setValueAtTime(1.3, when)
  clickGain.gain.setValueAtTime(volume * 0.45, when)
  clickGain.gain.exponentialRampToValueAtTime(0.0001, when + CLICK_DURATION)
  click.connect(band).connect(clickGain).connect(ctx.destination)
  click.start(when)
  click.stop(when + CLICK_DURATION)
}

type WaveOptions = { stagger?: number; volume?: number }

/**
 * Schedules a staggered wave of pops on the audio clock (not with timers), so
 * the rhythm stays even while React renders the bubbles.
 *
 * Returns how many pops were scheduled: zero when audio is unsupported or
 * still locked, which callers can treat as "stay quiet" rather than an error.
 */
export function playBubblePops(count: number, options: WaveOptions = {}): number {
  const ctx = context
  if (!ctx || ctx.state !== 'running' || count <= 0) return 0

  const { stagger = POP_STAGGER_SECONDS, volume = 0.14 } = options
  const scheduled = Math.min(count, MAX_POPS_PER_WAVE)
  const start = ctx.currentTime + 0.05

  for (let index = 0; index < scheduled; index += 1) {
    schedulePop(ctx, start + index * stagger, popPitch(index), volume)
  }

  return scheduled
}
